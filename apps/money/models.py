from django.db import models

from apps.core.files import user_upload_path  # [Stage 13]
from apps.core.models import OwnedModel


class MoneyAccount(OwnedModel):
    class Kind(models.TextChoices):
        CHEQUE = "cheque", "Cheque"
        SAVINGS = "savings", "Savings"
        CREDIT = "credit", "Credit"
        CASH = "cash", "Cash"

    name = models.CharField(max_length=60)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    opening_cents = models.BigIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_account_name")]

    def __str__(self) -> str:
        return self.name


class Category(OwnedModel):
    name = models.CharField(max_length=40)
    colour = models.CharField(max_length=7)
    glyph = models.CharField(max_length=1)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_category_name")]

    def __str__(self) -> str:
        return self.name


class Transaction(OwnedModel):
    account = models.ForeignKey(MoneyAccount, on_delete=models.PROTECT, related_name="transactions")
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    date = models.DateField()
    description = models.CharField(max_length=160)
    amount_cents = models.BigIntegerField()  # negative = money out
    transfer_group = models.UUIDField(null=True, blank=True, db_index=True)
    recurring = models.ForeignKey("money.Recurring", null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="postings")  # [Stage 13]
    due_date = models.DateField(null=True, blank=True)  # [Stage 13] which occurrence of `recurring`

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["owner", "date"]), models.Index(fields=["owner", "category", "date"])]
        constraints = [
            models.CheckConstraint(condition=~models.Q(amount_cents=0), name="amount_not_zero"),
            models.UniqueConstraint(fields=["recurring", "due_date"], name="uniq_recurring_occurrence"),  # [Stage 13]
        ]


class Cap(OwnedModel):
    category = models.OneToOneField(Category, on_delete=models.CASCADE, related_name="cap")
    amount_cents = models.BigIntegerField()
    warn_at_pct = models.PositiveSmallIntegerField(default=90)


# --- Stage 13 --------------------------------------------------------------------------------


class Goal(OwnedModel):
    name = models.CharField(max_length=60)
    target_cents = models.BigIntegerField()
    target_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["completed_at", "target_date", "name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_goal_name")]


class GoalContribution(OwnedModel):
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name="contributions")
    amount_cents = models.BigIntegerField()  # may be negative: taking money back out of a goal
    date = models.DateField()

    class Meta:
        ordering = ["-date", "-id"]


class Recurring(OwnedModel):
    class Cadence(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    name = models.CharField(max_length=80)
    amount_cents = models.BigIntegerField()  # negative = spend, positive = income
    cadence = models.CharField(max_length=8, choices=Cadence.choices)
    next_date = models.DateField()
    account = models.ForeignKey(MoneyAccount, on_delete=models.CASCADE, related_name="recurring")
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    auto_post = models.BooleanField(default=False)  # income: True; spend: held as "due" until confirmed
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["next_date", "name"]


class Receipt(OwnedModel):
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name="receipt")
    file = models.FileField(upload_to=user_upload_path, max_length=200)
    content_type = models.CharField(max_length=40)
