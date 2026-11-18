import io
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.errors import DomainError
from apps.money import selectors, services
from apps.money.models import Category, MoneyAccount, Recurring, Transaction
from conftest import props


@pytest.fixture
def accounts(alice):
    cheque = MoneyAccount.objects.create(owner=alice, name="Cheque", kind="cheque", opening_cents=100_000)
    cash = MoneyAccount.objects.create(owner=alice, name="Cash", kind="cash", opening_cents=5_000)
    return cheque, cash


def test_transfer_moves_money_both_ways(alice, accounts):  # F-42
    cheque, cash = accounts
    services.transfer(alice, source=cheque, target=cash, cents=20_000, date=date(2026, 11, 18))
    assert selectors.balance_of(alice, cheque.pk) == 80_000
    assert selectors.balance_of(alice, cash.pk) == 25_000


def test_overdrawn_transfer_writes_nothing(alice, accounts):
    cheque, cash = accounts
    with pytest.raises(DomainError) as err:
        services.transfer(alice, source=cash, target=cheque, cents=6_000, date=date(2026, 11, 18))
    assert "Cash has R 50,00" in err.value.message
    assert Transaction.objects.count() == 0


def test_transfers_are_not_spending(alice, accounts):
    cheque, cash = accounts
    services.transfer(alice, source=cheque, target=cash, cents=1_000, date=date(2026, 11, 18))
    assert selectors.month_totals(alice, date(2026, 11, 18)) == {"out_cents": 0, "in_cents": 0}


def test_cap_over_by(alice, accounts):  # F-44
    cheque, _ = accounts
    services.ensure_categories(alice)
    groceries = Category.objects.get(owner=alice, name="Groceries")
    services.save_cap(alice, category=groceries, cents=456_000)
    services.create_transaction(alice, account=cheque, category=groceries, date=date(2026, 11, 3),
                                description="Shop", cents=-474_240)
    cap = selectors.caps_for_month(alice, date(2026, 11, 18))[0]
    assert cap["over_cents"] == 18_240 and cap["pct"] == 104


def test_form_refuses_other_users_account(as_bob, accounts):  # ISO-02
    cheque, _ = accounts
    r = as_bob.post("/money/transactions/", {"date": "2026-11-18", "description": "x", "amount": "10",
                                             "direction": "out", "account": cheque.pk})
    assert "account" in props(r)["errors"]
    assert Transaction.objects.count() == 0


def test_deleting_one_half_deletes_the_transfer(alice, as_alice, accounts):
    cheque, cash = accounts
    services.transfer(alice, source=cheque, target=cash, cents=1_000, date=date(2026, 11, 18))
    first = Transaction.objects.first()
    as_alice.delete(f"/money/transactions/{first.pk}/")
    assert Transaction.objects.count() == 0


def test_run_recurring_twice_posts_once(alice, accounts):  # F-47
    cheque, _ = accounts
    Recurring.objects.create(owner=alice, name="Salary", amount_cents=2_500_000, cadence="monthly",
                             next_date=date(2026, 10, 25), account=cheque, auto_post=True)
    assert services.run_due(today=date(2026, 11, 18)) == 1  # 25 Oct; 25 Nov isn't due yet
    assert services.run_due(today=date(2026, 11, 18)) == 0
    assert Transaction.objects.filter(recurring__isnull=False).count() == 1
    assert Recurring.objects.get().next_date == date(2026, 11, 25)


def test_goal_monthly_needed_rounds_up(alice):
    g = services.save_goal(alice, name="Trip", target=1_000_00, target_date=date(2027, 1, 31))
    services.contribute(alice, g, cents=1_00, date=date(2026, 11, 18))
    goal = selectors.goal_list(alice, date(2026, 11, 18))[0]
    assert goal["monthly_cents"] == 33_300  # R 999,00 left over Nov, Dec, Jan = R 333,00 a month


def _png() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, format="PNG")
    return buf.getvalue()


def test_receipt_is_private(client, alice, bob, accounts, settings, tmp_path):  # UPL-01, ISO-05
    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    cheque, _ = accounts
    t = services.create_transaction(alice, account=cheque, category=None, date=date(2026, 11, 18),
                                    description="Shop", cents=-100)
    receipt = services.attach_receipt(alice, t, SimpleUploadedFile("r.png", _png(), content_type="image/png"))
    assert receipt.file.name.startswith(f"u{alice.pk}/receipt/")
    client.force_login(alice)
    r = client.get(f"/files/receipt/{receipt.pk}/")
    assert r.status_code == 200 and r["Cache-Control"] == "private, no-store"
    client.force_login(bob)
    assert client.get(f"/files/receipt/{receipt.pk}/").status_code == 404


def test_non_image_is_refused(alice, accounts, settings, tmp_path):  # UPL-02
    from django.core.exceptions import ValidationError

    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    cheque, _ = accounts
    t = services.create_transaction(alice, account=cheque, category=None, date=date(2026, 11, 18),
                                    description="Shop", cents=-100)
    with pytest.raises(ValidationError):
        services.attach_receipt(alice, t, SimpleUploadedFile("r.png", b"<script>", content_type="image/png"))
