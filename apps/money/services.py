from __future__ import annotations

import uuid
from datetime import date, timedelta

from django.db import IntegrityError
from django.db import transaction as db
from django.db.models import Sum
from django.utils import timezone

from apps.core.dates import add_months
from apps.core.errors import DomainError
from apps.core.files import clean_private_image, delete_file
from apps.core.money import format_zar

from .models import Cap, Category, Goal, GoalContribution, MoneyAccount, Receipt, Recurring, Transaction
from .selectors import balance_of

SEED = [("Groceries", "#E07A3F", "G"), ("Transport", "#2B6CFF", "T"), ("Eating out", "#C2417A", "E"),
        ("Utilities", "#1C9C95", "U"), ("Health", "#3F9C4A", "H"), ("Entertainment", "#8A5CF0", "N"),
        ("Home", "#9A7B4F", "O"), ("Shopping", "#6B7280", "S")]


def ensure_categories(owner) -> bool:
    """Seed the 8 starter categories on a first visit. Returns True if it seeded."""
    if Category.objects.for_user(owner).exists():
        return False
    Category.objects.bulk_create([Category(owner=owner, name=n, colour=c, glyph=g) for n, c, g in SEED])
    return True


@db.atomic
def transfer(owner, *, source: MoneyAccount, target: MoneyAccount, cents: int, date, note: str = "") -> uuid.UUID:
    if source.pk == target.pk:
        raise DomainError("Pick two different accounts.", field="target")
    # Lock both rows, always in id order, so two transfers can't deadlock each other.
    list(MoneyAccount.objects.for_user(owner).select_for_update().filter(pk__in=[source.pk, target.pk]).order_by("pk"))
    available = balance_of(owner, source.pk)
    if source.kind != MoneyAccount.Kind.CREDIT and available < cents:
        raise DomainError(f"{source.name} has {format_zar(available)}. Move {format_zar(available)} or less, "
                          "or pick another account.", field="amount")
    group = uuid.uuid4()
    Transaction.objects.bulk_create([
        Transaction(owner=owner, account=source, date=date, amount_cents=-cents, transfer_group=group,
                    description=note or f"Transfer to {target.name}"),
        Transaction(owner=owner, account=target, date=date, amount_cents=cents, transfer_group=group,
                    description=note or f"Transfer from {source.name}"),
    ])
    return group


# --- Transactions ----------------------------------------------------------------------------


def create_transaction(owner, *, account, category, date, description: str, cents: int) -> Transaction:
    return Transaction.objects.create(owner=owner, account=account, category=category, date=date,
                                      description=description.strip(), amount_cents=cents)


def update_transaction(t: Transaction, *, account, category, date, description: str, cents: int) -> Transaction:
    if t.transfer_group:
        raise DomainError("Transfers can't be edited. Delete it and move the money again.")
    t.account, t.category, t.date, t.description, t.amount_cents = account, category, date, description.strip(), cents
    t.save()
    return t


@db.atomic
def delete_transaction(t: Transaction) -> int:
    """Delete a transaction (both halves, for a transfer) and any receipt file. Returns rows deleted."""
    rows = [t]
    if t.transfer_group:
        rows = list(Transaction.objects.for_user(t.owner).filter(transfer_group=t.transfer_group))
    files = [r.file for r in Receipt.objects.filter(transaction__in=rows)]
    for row in rows:
        row.delete()
    def remove_files() -> None:
        for f in files:
            delete_file(f)

    db.on_commit(remove_files)  # only once the rows are really gone
    return len(rows)


# --- Accounts and categories -----------------------------------------------------------------


def save_account(owner, data: dict, account: MoneyAccount | None = None) -> MoneyAccount:
    account = account or MoneyAccount(owner=owner)
    account.name, account.kind = data["name"].strip(), data["kind"]
    account.opening_cents, account.archived = data["opening"], data.get("archived", False)
    try:
        with db.atomic():
            account.save()
    except IntegrityError as exc:
        raise DomainError("You already have an account with that name.", field="name") from exc
    return account


def delete_account(account: MoneyAccount) -> str:
    """Delete an empty account; archive one with history (transactions PROTECT it). Returns what happened."""
    if account.transactions.exists():
        account.archived = True
        account.save(update_fields=["archived", "updated_at"])
        return "archived"
    account.delete()
    return "deleted"


def save_category(owner, data: dict, category: Category | None = None) -> Category:
    category = category or Category(owner=owner)
    category.name, category.colour, category.glyph = data["name"].strip(), data["colour"], data["glyph"][:1].upper()
    try:
        with db.atomic():
            category.save()
    except IntegrityError as exc:
        raise DomainError("You already have a category with that name.", field="name") from exc
    return category


def save_cap(owner, *, category: Category, cents: int, warn_at_pct: int = 90) -> Cap:
    cap, _ = Cap.objects.update_or_create(owner=owner, category=category,
                                          defaults={"amount_cents": cents, "warn_at_pct": warn_at_pct})
    return cap


# --- Goals (Stage 13) ------------------------------------------------------------------------


def save_goal(owner, *, name: str, target: int, target_date=None, goal: Goal | None = None) -> Goal:
    goal = goal or Goal(owner=owner)
    goal.name, goal.target_cents, goal.target_date = name.strip(), target, target_date
    try:
        with db.atomic():
            goal.save()
    except IntegrityError as exc:
        raise DomainError("You already have a goal with that name.", field="name") from exc
    _sync_goal(goal)
    return goal


def _sync_goal(goal: Goal) -> None:
    saved = goal.contributions.aggregate(s=Sum("amount_cents"))["s"] or 0
    done = saved >= goal.target_cents
    if done and goal.completed_at is None:
        goal.completed_at = timezone.now()
    elif not done and goal.completed_at is not None:
        goal.completed_at = None
    else:
        return
    goal.save(update_fields=["completed_at", "updated_at"])


@db.atomic
def contribute(owner, goal: Goal, *, cents: int, date: date) -> GoalContribution:
    saved = goal.contributions.aggregate(s=Sum("amount_cents"))["s"] or 0
    if saved + cents < 0:
        raise DomainError(f"Only {format_zar(saved)} is saved in this goal.", field="amount")
    c = GoalContribution.objects.create(owner=owner, goal=goal, amount_cents=cents, date=date)
    _sync_goal(goal)
    return c


# --- Recurring (Stage 13) --------------------------------------------------------------------


def advance(d: date, cadence: str) -> date:
    if cadence == Recurring.Cadence.WEEKLY:
        return d + timedelta(days=7)
    if cadence == Recurring.Cadence.YEARLY:
        return add_months(d, 12)
    return add_months(d, 1)


def _post(r: Recurring) -> Transaction | None:
    """Post the occurrence on r.next_date. The unique constraint makes a second post impossible."""
    try:
        with db.atomic():
            return Transaction.objects.create(owner=r.owner, account=r.account, category=r.category,
                                              date=r.next_date, description=r.name, amount_cents=r.amount_cents,
                                              recurring=r, due_date=r.next_date)
    except IntegrityError:
        return None  # already posted (the job ran twice, or two clicks) — skip


@db.atomic
def confirm(r: Recurring) -> Transaction | None:
    """The user says a due item really happened: post it and move to the next date."""
    r = Recurring.objects.select_for_update().get(pk=r.pk)
    t = _post(r)
    r.next_date = advance(r.next_date, r.cadence)
    r.save(update_fields=["next_date", "updated_at"])
    return t


@db.atomic
def skip(r: Recurring) -> None:
    """It didn't happen this time: move on without posting."""
    r = Recurring.objects.select_for_update().get(pk=r.pk)
    r.next_date = advance(r.next_date, r.cadence)
    r.save(update_fields=["next_date", "updated_at"])


def run_due(today: date | None = None) -> int:
    """Cron (daily): post every auto-post occurrence up to today. Safe to run twice."""
    today = today or timezone.localdate()
    posted = 0
    for r in Recurring.objects.filter(active=True, auto_post=True, next_date__lte=today).select_related("account"):
        with db.atomic():
            r = Recurring.objects.select_for_update().get(pk=r.pk)
            while r.next_date <= today:
                if _post(r) is not None:
                    posted += 1
                r.next_date = advance(r.next_date, r.cadence)
            r.save(update_fields=["next_date", "updated_at"])
    return posted


# --- Receipts (Stage 13) ---------------------------------------------------------------------


@db.atomic
def attach_receipt(owner, t: Transaction, upload) -> Receipt:
    content, content_type = clean_private_image(upload)  # raises ValidationError for bad files
    old = Receipt.objects.filter(transaction=t).first()
    if old:
        old_file = old.file
        old.delete()
        db.on_commit(lambda: delete_file(old_file))
    receipt = Receipt(owner=owner, transaction=t, content_type=content_type)
    receipt.file.save(content.name, content, save=False)
    receipt.save()
    return receipt


@db.atomic
def remove_receipt(receipt: Receipt) -> None:
    f = receipt.file
    receipt.delete()
    db.on_commit(lambda: delete_file(f))
