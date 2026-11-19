import csv

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.errors import DomainError
from apps.core.http import back, int_param, page_of, payload, see_other
from apps.core.inertia import form_errors
from apps.core.models import get_owned
from apps.core.money import cents_to_csv, format_zar

from . import selectors, services
from .forms import (
    AccountForm,
    CapForm,
    CategoryForm,
    ContributionForm,
    GoalForm,
    LedgerFilterForm,
    ReceiptForm,
    RecurringForm,
    TransactionForm,
    TransferForm,
)
from .models import Cap, Category, Goal, MoneyAccount, Receipt, Recurring, Transaction


def _choices(owner) -> dict:
    """Options every money form needs."""
    return {"account_options": selectors.account_choices(owner),
            "category_options": [{"id": c["id"], "name": c["name"], "colour": c["colour"]}
                                 for c in selectors.category_list(owner)]}


def _with_errors(props: dict, errors: dict | None) -> dict:
    return {**props, "errors": errors} if errors else props


# --- Overview --------------------------------------------------------------------------------


@login_required
@require_GET
def overview(request):
    seeded = services.ensure_categories(request.user)
    if seeded:
        messages.info(request, "We added 8 starter categories. Rename or delete them any time.")
    today = timezone.localdate()
    return inertia_render(request, "Money/Overview", props={
        **selectors.overview(request.user, today), **_choices(request.user), "today": today.isoformat()})


# --- Transactions ----------------------------------------------------------------------------


def _ledger_props(request, errors: dict | None = None) -> dict:
    f = LedgerFilterForm(request.GET, owner=request.user).values()
    qs = selectors.ledger(request.user, f)
    return _with_errors({
        **page_of(request, qs, selectors.tx_dict, per_page=25),
        "totals": selectors.totals(qs),
        "filters": {"from": request.GET.get("from", ""), "to": request.GET.get("to", ""),
                    "account": request.GET.get("account", ""), "category": request.GET.get("category", ""),
                    "direction": request.GET.get("direction", ""), "q": request.GET.get("q", "")},
        "today": timezone.localdate().isoformat(),
        **_choices(request.user),
    }, errors)


@login_required
@require_http_methods(["GET", "POST"])
def transactions(request):
    if request.method == "POST":
        form = TransactionForm(payload(request), owner=request.user)
        if not form.is_valid():
            return inertia_render(request, "Money/Transactions", props=_ledger_props(request, form_errors(form)))
        d = form.cleaned_data
        services.create_transaction(request.user, account=d["account"], category=d["category"], date=d["date"],
                                    description=d["description"], cents=form.signed_cents())
        messages.success(request, f"Saved {format_zar(form.signed_cents())}")
        return back(request, "/money/transactions/")
    return inertia_render(request, "Money/Transactions", props=_ledger_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def transaction_detail(request, pk: int):
    t = get_owned(Transaction, request.user, pk)
    if request.method == "DELETE":
        n = services.delete_transaction(t)
        messages.success(request, "Transfer deleted (both sides)" if n == 2 else "Transaction deleted")
        return back(request, "/money/transactions/")
    form = TransactionForm(payload(request), owner=request.user)
    if not form.is_valid():
        return inertia_render(request, "Money/Transactions",
                              props={**_ledger_props(request, form_errors(form)), "editing": pk})
    d = form.cleaned_data
    try:
        services.update_transaction(t, account=d["account"], category=d["category"], date=d["date"],
                                    description=d["description"], cents=form.signed_cents())
    except DomainError as exc:
        messages.error(request, exc.message)
    else:
        messages.success(request, "Transaction saved")
    return back(request, "/money/transactions/")


@login_required
@require_POST  # multipart: Django parses files only on POST
def receipt_upload(request, pk: int):
    t = get_owned(Transaction, request.user, pk)
    form = ReceiptForm(request.POST, request.FILES)
    if not form.is_valid():
        messages.error(request, next(iter(form_errors(form).values())))
        return back(request, "/money/transactions/")
    try:
        services.attach_receipt(request.user, t, form.cleaned_data["receipt"])
    except ValidationError as exc:
        messages.error(request, exc.messages[0])
    else:
        messages.success(request, "Receipt attached")
    return back(request, "/money/transactions/")


@login_required
@require_http_methods(["DELETE"])
def receipt_delete(request, pk: int):
    services.remove_receipt(get_owned(Receipt, request.user, pk))
    messages.success(request, "Receipt removed")
    return back(request, "/money/transactions/")


@login_required
@require_GET
def transactions_csv(request):
    f = LedgerFilterForm(request.GET, owner=request.user).values()
    rows = selectors.ledger(request.user, f).order_by("date", "id")
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="transactions.csv"'
    w = csv.writer(response)
    w.writerow(["date", "description", "amount", "account", "category", "transfer"])
    for t in rows.iterator(chunk_size=500):
        w.writerow([t.date.isoformat(), t.description, cents_to_csv(t.amount_cents), t.account.name,
                    t.category.name if t.category else "", "yes" if t.transfer_group else ""])
    return response


# --- Accounts --------------------------------------------------------------------------------


def _accounts_props(request, errors: dict | None = None, editing: int | None = None) -> dict:
    return _with_errors({"accounts": selectors.balances(request.user, include_archived=True),
                         "kinds": [{"value": v, "label": label} for v, label in MoneyAccount.Kind.choices],
                         "editing": editing}, errors)


@login_required
@require_http_methods(["GET", "POST"])
def accounts(request):
    if request.method == "POST":
        form = AccountForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Money/Accounts", props=_accounts_props(request, form_errors(form)))
        try:
            services.save_account(request.user, form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Money/Accounts", props=_accounts_props(request, {exc.field: exc.message}))
        messages.success(request, "Account added")
        return see_other("money:accounts")
    return inertia_render(request, "Money/Accounts", props=_accounts_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def account_detail(request, pk: int):
    account = get_owned(MoneyAccount, request.user, pk)
    if request.method == "DELETE":
        result = services.delete_account(account)
        messages.success(request, "Account archived — it has history" if result == "archived" else "Account deleted")
        return see_other("money:accounts")
    form = AccountForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Money/Accounts", props=_accounts_props(request, form_errors(form), pk))
    try:
        services.save_account(request.user, form.cleaned_data, account)
    except DomainError as exc:
        return inertia_render(request, "Money/Accounts", props=_accounts_props(request, {exc.field: exc.message}, pk))
    messages.success(request, "Account saved")
    return see_other("money:accounts")


# --- Transfer --------------------------------------------------------------------------------


@login_required
@require_http_methods(["GET", "POST"])
def transfer(request):
    def props(errors=None):
        return _with_errors({"accounts": selectors.balances(request.user),
                             "today": timezone.localdate().isoformat()}, errors)

    if request.method == "POST":
        form = TransferForm(payload(request), owner=request.user)
        if not form.is_valid():
            return inertia_render(request, "Money/Transfer", props=props(form_errors(form)))
        d = form.cleaned_data
        try:
            services.transfer(request.user, source=d["source"], target=d["target"], cents=d["amount"],
                              date=d["date"], note=d["note"])
        except DomainError as exc:
            return inertia_render(request, "Money/Transfer", props=props({exc.field: exc.message}))
        messages.success(request, f"Moved {format_zar(d['amount'])} from {d['source'].name} to {d['target'].name}")
        return see_other("money:overview")
    return inertia_render(request, "Money/Transfer", props=props())


# --- Categories and caps ---------------------------------------------------------------------


def _categories_props(request, errors=None, editing=None) -> dict:
    return _with_errors({"categories": selectors.category_list(request.user), "editing": editing,
                         "seed_names": [n for n, _, _ in services.SEED]}, errors)


@login_required
@require_http_methods(["GET", "POST"])
def categories(request):
    services.ensure_categories(request.user)
    if request.method == "POST":
        form = CategoryForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Money/Categories", props=_categories_props(request, form_errors(form)))
        try:
            services.save_category(request.user, form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Money/Categories",
                                  props=_categories_props(request, {exc.field: exc.message}))
        messages.success(request, "Category added")
        return see_other("money:categories")
    return inertia_render(request, "Money/Categories", props=_categories_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def category_detail(request, pk: int):
    category = get_owned(Category, request.user, pk)
    if request.method == "DELETE":
        category.delete()  # transactions keep their history: category FK is SET_NULL
        messages.success(request, "Category deleted. Its transactions are now uncategorised.")
        return see_other("money:categories")
    form = CategoryForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Money/Categories", props=_categories_props(request, form_errors(form), pk))
    try:
        services.save_category(request.user, form.cleaned_data, category)
    except DomainError as exc:
        return inertia_render(request, "Money/Categories",
                              props=_categories_props(request, {exc.field: exc.message}, pk))
    messages.success(request, "Category saved")
    return see_other("money:categories")


@login_required
@require_http_methods(["GET", "POST"])
def caps(request):
    today = timezone.localdate()

    def props(errors=None):
        return _with_errors({"caps": selectors.caps_for_month(request.user, today), **_choices(request.user),
                             "month": today.replace(day=1).isoformat()}, errors)

    if request.method == "POST":
        form = CapForm(payload(request), owner=request.user)
        if not form.is_valid():
            return inertia_render(request, "Money/Caps", props=props(form_errors(form)))
        d = form.cleaned_data
        services.save_cap(request.user, category=d["category"], cents=d["amount"], warn_at_pct=d["warn_at_pct"])
        messages.success(request, f"Cap saved for {d['category'].name}")
        return see_other("money:caps")
    return inertia_render(request, "Money/Caps", props=props())


@login_required
@require_http_methods(["DELETE"])
def cap_detail(request, pk: int):
    get_owned(Cap, request.user, pk).delete()
    messages.success(request, "Cap removed")
    return see_other("money:caps")


# --- Goals (Stage 13) ------------------------------------------------------------------------


def _goals_props(request, errors=None, editing=None) -> dict:
    today = timezone.localdate()
    return _with_errors({"goals": selectors.goal_list(request.user, today), "today": today.isoformat(),
                         "editing": editing}, errors)


@login_required
@require_http_methods(["GET", "POST"])
def goals(request):
    if request.method == "POST":
        form = GoalForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Money/Goals", props=_goals_props(request, form_errors(form)))
        try:
            services.save_goal(request.user, **form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Money/Goals", props=_goals_props(request, {exc.field: exc.message}))
        messages.success(request, "Goal added")
        return see_other("money:goals")
    return inertia_render(request, "Money/Goals", props=_goals_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def goal_detail(request, pk: int):
    goal = get_owned(Goal, request.user, pk)
    if request.method == "DELETE":
        goal.delete()
        messages.success(request, "Goal deleted")
        return see_other("money:goals")
    form = GoalForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Money/Goals", props=_goals_props(request, form_errors(form), pk))
    try:
        services.save_goal(request.user, goal=goal, **form.cleaned_data)
    except DomainError as exc:
        return inertia_render(request, "Money/Goals", props=_goals_props(request, {exc.field: exc.message}, pk))
    messages.success(request, "Goal saved")
    return see_other("money:goals")


@login_required
@require_POST
def goal_contribute(request, pk: int):
    goal = get_owned(Goal, request.user, pk)
    form = ContributionForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Money/Goals", props=_goals_props(request, form_errors(form), pk))
    try:
        services.contribute(request.user, goal, cents=form.cleaned_data["amount"], date=form.cleaned_data["date"])
    except DomainError as exc:
        return inertia_render(request, "Money/Goals", props=_goals_props(request, {exc.field: exc.message}, pk))
    goal.refresh_from_db()
    messages.success(request, f"{goal.name}: goal reached!" if goal.completed_at else "Contribution added")
    return see_other("money:goals")


# --- Recurring (Stage 13) --------------------------------------------------------------------


def _recurring_props(request, errors=None, editing=None) -> dict:
    today = timezone.localdate()
    return _with_errors({"items": selectors.recurring_list(request.user, today), **_choices(request.user),
                         "today": today.isoformat(), "editing": editing,
                         "cadences": [{"value": v, "label": label} for v, label in Recurring.Cadence.choices]},
                        errors)


@login_required
@require_http_methods(["GET", "POST"])
def recurring(request):
    if request.method == "POST":
        form = RecurringForm(payload(request), owner=request.user)
        if not form.is_valid():
            return inertia_render(request, "Money/Recurring", props=_recurring_props(request, form_errors(form)))
        Recurring.objects.create(owner=request.user, **form.model_values())
        messages.success(request, "Recurring item added")
        return see_other("money:recurring")
    return inertia_render(request, "Money/Recurring", props=_recurring_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def recurring_detail(request, pk: int):
    item = get_owned(Recurring, request.user, pk)
    if request.method == "DELETE":
        item.delete()  # posted transactions stay: their FK is SET_NULL
        messages.success(request, "Recurring item deleted")
        return see_other("money:recurring")
    form = RecurringForm(payload(request), owner=request.user)
    if not form.is_valid():
        return inertia_render(request, "Money/Recurring", props=_recurring_props(request, form_errors(form), pk))
    for field, value in form.model_values().items():
        setattr(item, field, value)
    item.save()
    messages.success(request, "Recurring item saved")
    return see_other("money:recurring")


@login_required
@require_POST
def recurring_confirm(request, pk: int):
    item = get_owned(Recurring, request.user, pk)
    t = services.confirm(item)
    messages.success(request, f"Posted {item.name}" if t else f"{item.name} was already posted")
    return back(request, "/money/recurring/")


@login_required
@require_POST
def recurring_skip(request, pk: int):
    item = get_owned(Recurring, request.user, pk)
    services.skip(item)
    messages.success(request, f"Skipped {item.name} this time")
    return back(request, "/money/recurring/")


# --- Reports (Stage 13) ----------------------------------------------------------------------


@login_required
@require_GET
def reports(request):
    months = int_param(request, "months", 6)
    months = months if months in (3, 6, 12) else 6
    return inertia_render(request, "Money/Reports", props=selectors.report(request.user, timezone.localdate(), months))
