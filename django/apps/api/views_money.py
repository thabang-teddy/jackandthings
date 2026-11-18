"""`/api/v1` money: accounts, the ledger, transfers, categories, caps, goals, recurring, reports.

Amounts arrive as whole cents (`amount_cents`), never as rands and never as a float.
The clients name the direction with `type` — deposit, withdrawal, transfer_in,
transfer_out — while this database stores the sign on one column, so `type` and the
sign are converted here and in `serializers`.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Sum
from django.http import FileResponse, HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.core.models import get_owned
from apps.money import selectors, services
from apps.money.models import Cap, Category, Goal, MoneyAccount, Receipt, Recurring, Transaction

from . import serializers
from .http import ApiError, api_view, as_bool, as_int, collection, data, no_content, payload, required

OUTFLOW_TYPES = {serializers.WITHDRAWAL, serializers.TRANSFER_OUT}


def _date(body: dict, field: str, default=None):
    raw = body.get(field)
    if not raw:
        return default or timezone.localdate()
    parsed = parse_date(str(raw))
    if parsed is None:
        raise ApiError("The given data was invalid.", errors={field: ["Send a date as YYYY-MM-DD."]})
    return parsed


# --- Accounts -------------------------------------------------------------------------------------


@api_view(["GET", "POST"])
def accounts(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = MoneyAccount.objects.for_user(request.user).order_by("archived", "name")
        return collection(request, rows, serializers.account)
    body = payload(request)
    row = services.save_account(request.user, {
        "name": str(required(body, "name"))[:60],
        "kind": str(body.get("kind") or MoneyAccount.Kind.CHEQUE),
        "opening": as_int(body, "opening_balance_cents", 0) or 0,
        "archived": as_bool(body, "archived", False),
    })
    return data(serializers.account(row), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def account(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(MoneyAccount, request.user, pk)
    if request.method == "GET":
        return data(serializers.account(row))
    if request.method == "DELETE":
        # An account with history is archived rather than deleted: its transactions PROTECT it.
        outcome = services.delete_account(row)
        return no_content() if outcome == "deleted" else data({"outcome": outcome})
    body = payload(request)
    updated = services.save_account(request.user, {
        "name": str(body.get("name", row.name))[:60],
        "kind": str(body.get("kind", row.kind)),
        "opening": as_int(body, "opening_balance_cents", row.opening_cents),
        "archived": as_bool(body, "archived", row.archived),
    }, row)
    return data(serializers.account(updated))


# --- Transactions ---------------------------------------------------------------------------------


@api_view(["GET", "POST"])
def transactions(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = (Transaction.objects.for_user(request.user)
                .select_related("account", "category", "receipt").order_by("-date", "-id"))
        if request.GET.get("account_id"):
            rows = rows.filter(account_id=request.GET["account_id"])
        if request.GET.get("category_id"):
            rows = rows.filter(category_id=request.GET["category_id"])
        return collection(request, rows, serializers.transaction)

    body = payload(request)
    account_row = get_owned(MoneyAccount, request.user, required(body, "account_id"))
    category_row = (get_owned(Category, request.user, body["category_id"])
                    if body.get("category_id") else None)
    cents = abs(as_int(body, "amount_cents", 0) or 0)
    if cents == 0:
        raise ApiError("The given data was invalid.",
                       errors={"amount_cents": ["Send an amount other than zero, in cents."]})
    kind = str(body.get("type") or serializers.WITHDRAWAL)
    row = services.create_transaction(
        request.user, account=account_row, category=category_row, date=_date(body, "occurred_on"),
        description=str(body.get("description") or "")[:160],
        cents=-cents if kind in OUTFLOW_TYPES else cents)
    return data(serializers.transaction(row), status=201)


@api_view(["GET", "DELETE"])
def transaction(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Transaction, request.user, pk)
    if request.method == "DELETE":
        services.delete_transaction(row)      # a transfer takes its twin with it
        return no_content()
    return data(serializers.transaction(row))


@api_view(["POST"])
def transfers(request: HttpRequest) -> HttpResponse:
    body = payload(request)
    source = get_owned(MoneyAccount, request.user, required(body, "account_id"))
    target = get_owned(MoneyAccount, request.user, required(body, "related_account_id"))
    cents = abs(as_int(body, "amount_cents", 0) or 0)
    if cents == 0:
        raise ApiError("The given data was invalid.",
                       errors={"amount_cents": ["Send an amount other than zero, in cents."]})
    group = services.transfer(request.user, source=source, target=target, cents=cents,
                              date=_date(body, "occurred_on"), note=str(body.get("description") or "")[:160])
    rows = (Transaction.objects.for_user(request.user).filter(transfer_group=group)
            .select_related("account", "category"))
    return data([serializers.transaction(row) for row in rows], status=201)


# --- Receipts -------------------------------------------------------------------------------------


@api_view(["POST"])
def receipt_upload(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Transaction, request.user, pk)
    upload = request.FILES.get("file") or request.FILES.get("receipt")
    if upload is None:
        raise ApiError("The given data was invalid.", errors={"file": ["Attach an image."]})
    receipt = services.attach_receipt(request.user, row, upload)
    return data(serializers.receipt(receipt), status=201)


@api_view(["GET"])
def receipt_file(request: HttpRequest, pk: int) -> HttpResponse:
    """The only route to a stored receipt, and it authorizes before it opens the file."""
    row = get_owned(Receipt, request.user, pk)
    return FileResponse(row.file.open("rb"), content_type=row.content_type)


@api_view(["DELETE"])
def receipt(request: HttpRequest, pk: int) -> HttpResponse:
    services.remove_receipt(get_owned(Receipt, request.user, pk))
    return no_content()


# --- Categories, caps, goals ------------------------------------------------------------------------


@api_view(["GET", "POST"])
def categories(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        services.ensure_categories(request.user)
        return collection(request, Category.objects.for_user(request.user), serializers.category)
    body = payload(request)
    row = services.save_category(request.user, {
        "name": str(required(body, "name"))[:40],
        "colour": str(body.get("colour") or "#6B7280")[:7],
        "glyph": str(body.get("glyph") or body.get("name", "?"))[:1],
    })
    return data(serializers.category(row), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def category(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Category, request.user, pk)
    if request.method == "GET":
        return data(serializers.category(row))
    if request.method == "DELETE":
        row.delete()                       # transactions keep their history: category is SET_NULL
        return no_content()
    body = payload(request)
    updated = services.save_category(request.user, {
        "name": str(body.get("name", row.name))[:40],
        "colour": str(body.get("colour", row.colour))[:7],
        "glyph": str(body.get("glyph", row.glyph))[:1],
    }, row)
    return data(serializers.category(updated))


def _spent_this_month(owner, today) -> dict[int, int]:
    first = today.replace(day=1)
    rows = (Transaction.objects.for_user(owner)
            .filter(date__gte=first, date__lte=today, amount_cents__lt=0, category__isnull=False)
            .values("category_id").annotate(total=Sum("amount_cents")))
    return {row["category_id"]: -row["total"] for row in rows}


@api_view(["GET", "POST"])
def caps(request: HttpRequest) -> HttpResponse:
    """Laravel calls these budget limits; this build caps a category per calendar month."""
    today = timezone.localdate()
    spent = _spent_this_month(request.user, today)
    if request.method == "GET":
        rows = Cap.objects.for_user(request.user).select_related("category")
        return collection(request, rows, lambda row: serializers.cap(row, spent_cents=spent.get(row.category_id, 0)))
    body = payload(request)
    category_row = get_owned(Category, request.user, required(body, "category_id"))
    row = services.save_cap(request.user, category=category_row,
                            cents=abs(as_int(body, "limit_cents", 0) or 0),
                            warn_at_pct=as_int(body, "warn_at_pct", 90) or 90)
    return data(serializers.cap(row, spent_cents=spent.get(row.category_id, 0)), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def cap(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Cap, request.user, pk)
    spent = _spent_this_month(request.user, timezone.localdate()).get(row.category_id, 0)
    if request.method == "GET":
        return data(serializers.cap(row, spent_cents=spent))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    updated = services.save_cap(request.user, category=row.category,
                                cents=abs(as_int(body, "limit_cents", row.amount_cents) or 0),
                                warn_at_pct=as_int(body, "warn_at_pct", row.warn_at_pct) or 90)
    return data(serializers.cap(updated, spent_cents=spent))


def _saved(owner) -> dict[int, int]:
    rows = (Goal.objects.for_user(owner).values("pk")
            .annotate(total=Sum("contributions__amount_cents")))
    return {row["pk"]: row["total"] or 0 for row in rows}


@api_view(["GET", "POST"])
def goals(request: HttpRequest) -> HttpResponse:
    saved = _saved(request.user)
    if request.method == "GET":
        rows = Goal.objects.for_user(request.user)
        return collection(request, rows, lambda row: serializers.goal(row, saved_cents=saved.get(row.pk, 0)))
    body = payload(request)
    row = services.save_goal(request.user, name=str(required(body, "name"))[:60],
                             target=abs(as_int(body, "target_cents", 0) or 0),
                             target_date=parse_date(str(body.get("target_date") or "")) or None)
    return data(serializers.goal(row, saved_cents=0), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def goal(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Goal, request.user, pk)
    saved = _saved(request.user).get(row.pk, 0)
    if request.method == "GET":
        return data(serializers.goal(row, saved_cents=saved))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    updated = services.save_goal(request.user, name=str(body.get("name", row.name))[:60],
                                 target=abs(as_int(body, "target_cents", row.target_cents) or 0),
                                 target_date=(parse_date(str(body["target_date"])) if body.get("target_date")
                                              else row.target_date),
                                 goal=row)
    return data(serializers.goal(updated, saved_cents=saved))


@api_view(["POST"])
def goal_contribute(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Goal, request.user, pk)
    body = payload(request)
    cents = as_int(body, "amount_cents", 0) or 0
    if cents == 0:
        raise ApiError("The given data was invalid.",
                       errors={"amount_cents": ["Send an amount other than zero, in cents."]})
    services.contribute(request.user, row, cents=cents, date=_date(body, "occurred_on"))
    row.refresh_from_db()
    return data(serializers.goal(row, saved_cents=_saved(request.user).get(row.pk, 0)), status=201)


# --- Recurring ---------------------------------------------------------------------------------------


@api_view(["GET", "POST"])
def recurring_items(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = Recurring.objects.for_user(request.user).select_related("account")
        return collection(request, rows, serializers.recurring)

    body = payload(request)
    account_row = get_owned(MoneyAccount, request.user, required(body, "account_id"))
    category_row = (get_owned(Category, request.user, body["category_id"])
                    if body.get("category_id") else None)
    cents = abs(as_int(body, "amount_cents", 0) or 0)
    kind = str(body.get("type") or serializers.WITHDRAWAL)
    row = Recurring.objects.create(
        owner=request.user, account=account_row, category=category_row,
        name=str(body.get("description") or body.get("name") or "Recurring")[:80],
        amount_cents=-cents if kind in OUTFLOW_TYPES else cents,
        cadence=str(body.get("cadence") or Recurring.Cadence.MONTHLY),
        next_date=_date(body, "next_run_at"),
        auto_post=as_bool(body, "auto_post", kind not in OUTFLOW_TYPES),
        active=as_bool(body, "active", True))
    return data(serializers.recurring(row), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def recurring_item(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Recurring, request.user, pk)
    if request.method == "GET":
        return data(serializers.recurring(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    if body.get("account_id"):
        row.account = get_owned(MoneyAccount, request.user, body["account_id"])
    if "category_id" in body:
        row.category = (get_owned(Category, request.user, body["category_id"])
                        if body["category_id"] else None)
    if "amount_cents" in body or "type" in body:
        cents = abs(as_int(body, "amount_cents", abs(row.amount_cents)) or 0)
        kind = str(body.get("type") or (serializers.WITHDRAWAL if row.amount_cents < 0
                                        else serializers.DEPOSIT))
        row.amount_cents = -cents if kind in OUTFLOW_TYPES else cents
    row.name = str(body.get("description", row.name))[:80]
    row.cadence = str(body.get("cadence", row.cadence))
    row.next_date = _date(body, "next_run_at", row.next_date)
    row.active = as_bool(body, "active", row.active)
    row.auto_post = as_bool(body, "auto_post", row.auto_post)
    row.full_clean(exclude=["owner"])
    row.save()
    return data(serializers.recurring(row))


@api_view(["POST"])
def recurring_confirm(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Recurring, request.user, pk)
    posted = services.confirm(row)
    return data(serializers.transaction(posted) if posted else None, status=201 if posted else 200)


@api_view(["POST"])
def recurring_skip(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Recurring, request.user, pk)
    services.skip(row)
    row.refresh_from_db()
    return data(serializers.recurring(row))


# --- Reports and what is due ---------------------------------------------------------------------------


@api_view(["GET"])
def reports(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    months = max(1, min(24, as_int(request.GET, "months", 6) or 6))
    report = selectors.report(request.user, today, months)
    spent = _spent_this_month(request.user, today)
    caps_rows = Cap.objects.for_user(request.user).select_related("category")
    return data({
        "period": today.strftime("%Y-%m"),
        "currency": "ZAR",
        "months": report["months"],
        "from": report["from"],
        "to": report["to"],
        "categories": [{"name": row["category"], "kind": "expense", "spent_cents": row["spent_cents"],
                        "income_cents": 0} for row in report["per_category"]],
        "monthly": [{"period": row["month"], "income_cents": row["earned_cents"],
                     "expense_cents": row["spent_cents"]} for row in report["per_month"]],
        "totals": {"income_cents": report["earned_cents"], "expense_cents": report["spent_cents"],
                   "net_cents": report["net_cents"]},
        "limits": [serializers.cap(row, spent_cents=spent.get(row.category_id, 0)) for row in caps_rows],
    })


@api_view(["GET"])
def due(request: HttpRequest) -> HttpResponse:
    """What needs attention: recurring items coming up, and any cap at or over its warning."""
    today = timezone.localdate()
    horizon = today + timedelta(days=7)
    spent = _spent_this_month(request.user, today)
    bills = (Recurring.objects.for_user(request.user)
             .filter(active=True, next_date__lte=horizon).select_related("account"))
    caps_rows = Cap.objects.for_user(request.user).select_related("category")
    return data({
        "today": today.isoformat(),
        "bills": [{"id": serializers.sid(row.pk), "description": row.name, "account": row.account.name,
                   "amount_cents": abs(row.amount_cents), "next_run_at": row.next_date.isoformat(),
                   "days_until_due": (row.next_date - today).days}
                  for row in bills],
        "limits": [serializers.cap(row, spent_cents=spent.get(row.category_id, 0)) for row in caps_rows
                   if serializers.cap(row, spent_cents=spent.get(row.category_id, 0))["state"] != "ok"],
    })
