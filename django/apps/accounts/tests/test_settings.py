import time

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.money.models import MoneyAccount, Transaction
from apps.notes.models import Note


def _confirm(client):
    session = client.session
    session["password_confirmed_at"] = time.time()
    session.save()


def test_delete_needs_recent_password(as_alice):
    r = as_alice.get("/settings/delete/")
    assert r.status_code == 302 and "/password/confirm/" in r["Location"]


def test_delete_removes_everything(client, alice, as_alice, settings, tmp_path):  # F-70
    settings.PRIVATE_MEDIA_ROOT = tmp_path
    (tmp_path / f"u{alice.pk}").mkdir()
    Note.objects.create(owner=alice, title="x")
    acc = MoneyAccount.objects.create(owner=alice, name="Cheque", kind="cheque")
    Transaction.objects.create(owner=alice, account=acc, date=timezone.localdate(), description="x", amount_cents=-1)
    _confirm(client)
    r = as_alice.client.delete("/settings/delete/", data='{"confirm": "DELETE"}', content_type="application/json",
                               HTTP_X_INERTIA="true")
    assert r.status_code == 303
    assert not get_user_model().objects.filter(pk=alice.pk).exists()
    assert Note.objects.count() == Transaction.objects.count() == MoneyAccount.objects.count() == 0
    assert not (tmp_path / f"u{alice.pk}").exists()


def test_wrong_confirm_word_deletes_nothing(client, alice, as_alice):
    _confirm(client)
    as_alice.client.delete("/settings/delete/", data='{"confirm": "delete"}', content_type="application/json",
                           HTTP_X_INERTIA="true")
    assert get_user_model().objects.filter(pk=alice.pk).exists()


@pytest.mark.parametrize("theme", ["light", "dark", "system"])
def test_theme_saves(as_alice, alice, theme):
    as_alice.put("/settings/profile/", {"name": "Alice", "theme": theme})
    alice.refresh_from_db()
    assert alice.theme == theme
