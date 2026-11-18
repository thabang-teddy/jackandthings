from __future__ import annotations

from calendar import monthrange
from datetime import date
from typing import Any

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth

from apps.core.dates import add_months
from apps.core.money import format_zar

from .models import Cap, Category, Goal, MoneyAccount, Recurring, Transaction


def balances(owner, *, include_archived: bool = False) -> list[dict]:
    sums = dict(Transaction.objects.for_user(owner).values("account_id")
                .annotate(s=Sum("amount_cents")).values_list("account_id", "s"))
    qs = MoneyAccount.objects.for_user(owner).order_by("archived", "name")
    if not include_archived:
        qs = qs.filter(archived=False)
    return [{"id": a.pk, "name": a.name, "kind": a.kind, "archived": a.archived,
             "opening_cents": a.opening_cents, "balance_cents": a.opening_cents + (sums.get(a.pk) or 0)}
            for a in qs]


def balance_of(owner, account_id: int) -> int:
    acc = MoneyAccount.objects.for_user(owner).get(pk=account_id)
    moved = Transaction.objects.for_user(owner).filter(account_id=account_id).aggregate(s=Sum("amount_cents"))["s"]
    return acc.opening_cents + (moved or 0)


def caps_for_month(owner, today: date) -> list[dict]:
    first, last = today.replace(day=1), today.replace(day=monthrange(today.year, today.month)[1])
    spent = dict(Transaction.objects.for_user(owner)
                 .filter(date__range=(first, last), amount_cents__lt=0, transfer_group__isnull=True)
                 .values("category_id").annotate(s=Sum("amount_cents")).values_list("category_id", "s"))
    out = []
    for cap in Cap.objects.for_user(owner).select_related("category").order_by("category__name"):
        used = -(spent.get(cap.category_id) or 0)
        pct = round(used * 100 / cap.amount_cents) if cap.amount_cents else 0
        out.append({"id": cap.pk, "category_id": cap.category_id, "category": cap.category.name,
                    "colour": cap.category.colour, "cap_cents": cap.amount_cents, "spent_cents": used,
                    "over_cents": max(0, used - cap.amount_cents), "pct": pct,
                    "warn": pct >= cap.warn_at_pct, "warn_at_pct": cap.warn_at_pct,
                    "pace": today.day / last.day})
    return out


def category_list(owner) -> list[dict]:
    rows = Category.objects.for_user(owner).annotate(uses=Count("transaction")).order_by("name")
    return [{"id": c.pk, "name": c.name, "colour": c.colour, "glyph": c.glyph, "uses": c.uses} for c in rows]


def account_choices(owner) -> list[dict]:
    return [{"id": a.pk, "name": a.name, "kind": a.kind}
            for a in MoneyAccount.objects.for_user(owner).filter(archived=False).order_by("name")]


def tx_dict(t: Transaction) -> dict:
    receipt = getattr(t, "receipt", None)  # reverse one-to-one: raises (an AttributeError) when missing
    return {"id": t.pk, "date": t.date.isoformat(), "description": t.description, "amount_cents": t.amount_cents,
            "account": {"id": t.account_id, "name": t.account.name},
            "category": None if t.category is None else
            {"id": t.category_id, "name": t.category.name, "colour": t.category.colour, "glyph": t.category.glyph},
            "transfer": t.transfer_group is not None, "recurring_id": t.recurring_id,
            "receipt_id": receipt.pk if receipt else None}


def ledger(owner, f: dict):
    qs = Transaction.objects.for_user(owner).select_related("account", "category", "receipt")
    if f.get("from_"):
        qs = qs.filter(date__gte=f["from_"])
    if f.get("to"):
        qs = qs.filter(date__lte=f["to"])
    if f.get("account"):
        qs = qs.filter(account=f["account"])
    if f.get("category"):
        qs = qs.filter(category=f["category"])
    if f.get("direction") == "out":
        qs = qs.filter(amount_cents__lt=0)
    elif f.get("direction") == "in":
        qs = qs.filter(amount_cents__gt=0)
    if f.get("q"):
        qs = qs.filter(description__icontains=f["q"])
    return qs


def totals(qs) -> dict:
    agg = qs.aggregate(out=Sum("amount_cents", filter=Q(amount_cents__lt=0, transfer_group__isnull=True)),
                       inn=Sum("amount_cents", filter=Q(amount_cents__gt=0, transfer_group__isnull=True)))
    return {"out_cents": -(agg["out"] or 0), "in_cents": agg["inn"] or 0}


def month_totals(owner, today: date) -> dict:
    first = today.replace(day=1)
    return totals(Transaction.objects.for_user(owner).filter(date__gte=first, date__lte=today))


# --- Stage 13: goals, recurring, reports ------------------------------------------------------


def months_between(today: date, target: date) -> int:
    """Whole months left, counting the current month: 18 Nov → 31 Dec = 2."""
    return max(1, (target.year - today.year) * 12 + (target.month - today.month) + 1)


def goal_list(owner, today: date) -> list[dict]:
    out = []
    for g in Goal.objects.for_user(owner).annotate(saved=Sum("contributions__amount_cents")):
        saved = g.saved or 0
        remaining = max(0, g.target_cents - saved)
        monthly = None
        if g.target_date and remaining:
            months = months_between(today, g.target_date)
            monthly = -(-remaining // months)  # ceil without floats: // rounds towards minus infinity
        out.append({"id": g.pk, "name": g.name, "target_cents": g.target_cents, "saved_cents": saved,
                    "remaining_cents": remaining, "monthly_cents": monthly,
                    "target_date": g.target_date.isoformat() if g.target_date else None,
                    "done": g.completed_at is not None,
                    "pct": min(100, round(saved * 100 / g.target_cents)) if g.target_cents else 0})
    return out


def recurring_dict(r: Recurring, today: date) -> dict:
    return {"id": r.pk, "name": r.name, "amount_cents": r.amount_cents, "cadence": r.cadence,
            "next_date": r.next_date.isoformat(), "account": {"id": r.account_id, "name": r.account.name},
            "category": None if r.category is None else {"id": r.category_id, "name": r.category.name},
            "auto_post": r.auto_post, "active": r.active,
            "due": r.active and not r.auto_post and r.next_date <= today}


def recurring_list(owner, today: date) -> list[dict]:
    return [recurring_dict(r, today) for r in
            Recurring.objects.for_user(owner).select_related("account", "category")]


def due_recurring(owner, today: date) -> list[Recurring]:
    return list(Recurring.objects.for_user(owner)
                .filter(active=True, auto_post=False, next_date__lte=today).select_related("account"))


def report(owner, today: date, months: int) -> dict:
    start = add_months(today.replace(day=1), -(months - 1))
    base = Transaction.objects.for_user(owner).filter(date__range=(start, today), transfer_group__isnull=True)
    by_month = {r["month"]: r for r in
                base.annotate(month=TruncMonth("date")).values("month")
                .annotate(spent=Sum("amount_cents", filter=Q(amount_cents__lt=0)),
                          earned=Sum("amount_cents", filter=Q(amount_cents__gt=0))).order_by("month")}
    per_month: list[dict[str, Any]] = []
    for i in range(months):
        m = add_months(start, i)
        row = by_month.get(m, {})
        per_month.append({"month": m.isoformat(), "spent_cents": -(row.get("spent") or 0),
                          "earned_cents": row.get("earned") or 0})
    per_category = [
        {"category": r["category__name"] or "Uncategorised", "colour": r["category__colour"] or "#8E887B",
         "spent_cents": -r["s"]}
        for r in base.filter(amount_cents__lt=0).values("category__name", "category__colour")
        .annotate(s=Sum("amount_cents")).order_by("s")
    ]
    spent = sum(m["spent_cents"] for m in per_month)
    earned = sum(m["earned_cents"] for m in per_month)
    return {"months": months, "from": start.isoformat(), "to": today.isoformat(), "per_month": per_month,
            "per_category": per_category, "spent_cents": spent, "earned_cents": earned,
            "net_cents": earned - spent, "average_spent_cents": spent // months}


# --- For Today and the Now line --------------------------------------------------------------


def alerts(owner, today: date) -> list[dict]:
    out = [{"kind": "over", "text": f"{c['category']} {format_zar(c['over_cents'])} over",
            "href": "/money/caps/"} for c in caps_for_month(owner, today) if c["over_cents"] > 0]
    for r in due_recurring(owner, today):
        out.append({"kind": "overdue" if r.next_date < today else "due",
                    "text": f"{r.name} {format_zar(abs(r.amount_cents))} due", "href": "/money/recurring/"})
    return out


def overview(owner, today: date) -> dict:
    accounts = balances(owner)
    recent = Transaction.objects.for_user(owner).select_related("account", "category", "receipt")[:6]
    return {
        "accounts": accounts,
        "total_cents": sum(a["balance_cents"] for a in accounts),
        "month": month_totals(owner, today),
        "caps": caps_for_month(owner, today),
        "recent": [tx_dict(t) for t in recent],
        "due": [recurring_dict(r, today) for r in due_recurring(owner, today)],
        "goals": goal_list(owner, today)[:3],
    }
