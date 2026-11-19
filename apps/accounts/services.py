import shutil

from django.conf import settings
from django.db import transaction

DEFAULT_PREFS = {"email_weekly_summary": False, "email_cap_breached": True, "email_recurring_due": True}


def prefs_of(user) -> dict:
    """Stored toggles merged over the defaults, so new toggles appear without a migration."""
    return {**DEFAULT_PREFS, **{k: bool(v) for k, v in (user.prefs or {}).items() if k in DEFAULT_PREFS}}


def save_prefs(user, data: dict) -> dict:
    user.prefs = {k: bool(data.get(k, v)) for k, v in prefs_of(user).items()}
    user.save(update_fields=["prefs"])
    return user.prefs


def delete_account(user) -> None:
    """Remove the user and everything they own, rows then files (F-70).

    Most owned rows go with the user through CASCADE. Two relations are PROTECT on purpose,
    so that the UI cannot delete a money account that still has transactions, or a board
    column that still holds cards. Those children have to go first or the cascade refuses.
    """
    from apps.money.models import Transaction
    from apps.projects.models import Card

    folder = settings.PRIVATE_MEDIA_ROOT / f"u{user.pk}"
    with transaction.atomic():
        Transaction.objects.filter(owner=user).delete()   # PROTECTs MoneyAccount
        Card.objects.filter(owner=user).delete()          # PROTECTs Column
        user.delete()               # CASCADE removes every remaining owned row (see DATABASE.md)
    shutil.rmtree(folder, ignore_errors=True)   # files are not in the database; remove them explicitly
