"""Accounts, the ledger, transfers, categories, caps, goals, recurring items and reports.

Amounts are whole cents and the direction is a `type` on the wire but a sign in the
database, so most of these tests check that the translation holds in both directions.
"""
from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.money import services
from apps.money.models import Cap, Category, Goal, MoneyAccount, Receipt, Recurring, Transaction

from .conftest import data, errors, png_upload


@pytest.fixture
def cheque(alice):
    return MoneyAccount.objects.create(owner=alice, name="Cheque", kind="cheque", opening_cents=100_000)


@pytest.fixture
def savings(alice):
    return MoneyAccount.objects.create(owner=alice, name="Savings", kind="savings", opening_cents=500_000)


@pytest.fixture
def groceries(alice):
    return Category.objects.create(owner=alice, name="Groceries", colour="#E07A3F", glyph="G")


def spend(api, account, cents: int, **extra):
    return data(api.post("budget-transactions", {"account_id": str(account.pk), "type": "withdrawal",
                                                 "amount_cents": cents, "description": "Shop", **extra}))


# --- Accounts -------------------------------------------------------------------------------------


def test_an_account_reports_its_balance(api, cheque):
    spend(api, cheque, 25_000)
    body = data(api.get(f"budget-accounts/{cheque.pk}"))
    assert body["opening_balance_cents"] == 100_000 and body["balance_cents"] == 75_000


def test_creating_an_account(api, alice):
    body = data(api.post("budget-accounts", {"name": "Cash", "kind": "cash",
                                             "opening_balance_cents": 5_000}))
    assert body["balance_cents"] == 5_000
    assert MoneyAccount.objects.get(owner=alice, name="Cash").opening_cents == 5_000


def test_a_duplicate_account_name_is_422(api, cheque):
    assert api.post("budget-accounts", {"name": "Cheque", "kind": "cash"}).status_code == 422


def test_an_empty_account_is_deleted(api, cheque):
    assert api.delete(f"budget-accounts/{cheque.pk}").status_code == 204
    assert MoneyAccount.objects.count() == 0


def test_an_account_with_history_is_archived_instead(api, cheque):
    spend(api, cheque, 1_000)
    response = api.delete(f"budget-accounts/{cheque.pk}")
    assert response.status_code == 200 and data(response)["outcome"] == "archived"
    cheque.refresh_from_db()
    assert cheque.archived is True and Transaction.objects.count() == 1


def test_another_users_account_is_404(api, bob):
    theirs = MoneyAccount.objects.create(owner=bob, name="Theirs", kind="cash")
    assert api.get(f"budget-accounts/{theirs.pk}").status_code == 404
    assert api.delete(f"budget-accounts/{theirs.pk}").status_code == 404


# --- Transactions ---------------------------------------------------------------------------------


def test_a_withdrawal_is_stored_as_a_negative_amount(api, alice, cheque, groceries):
    body = spend(api, cheque, 84_250, category_id=str(groceries.pk), occurred_on="2026-11-18")
    assert body["type"] == "withdrawal" and body["amount_cents"] == 84_250
    assert body["signed_amount_cents"] == -84_250 and body["category"] == "Groceries"
    assert Transaction.objects.get(owner=alice).amount_cents == -84_250


def test_a_deposit_is_stored_as_a_positive_amount(api, cheque):
    body = data(api.post("budget-transactions", {"account_id": str(cheque.pk), "type": "deposit",
                                                 "amount_cents": 4_200_000, "description": "Salary"}))
    assert body["signed_amount_cents"] == 4_200_000
    assert Transaction.objects.get().amount_cents == 4_200_000


def test_a_zero_amount_is_422(api, cheque):
    response = api.post("budget-transactions", {"account_id": str(cheque.pk), "type": "withdrawal",
                                                "amount_cents": 0})
    assert response.status_code == 422 and "amount_cents" in errors(response)
    assert Transaction.objects.count() == 0


def test_a_transaction_cannot_be_posted_to_another_users_account(api, bob):
    theirs = MoneyAccount.objects.create(owner=bob, name="Theirs", kind="cash")
    response = api.post("budget-transactions", {"account_id": str(theirs.pk), "type": "withdrawal",
                                                "amount_cents": 500})
    assert response.status_code == 404 and Transaction.objects.count() == 0


def test_the_ledger_can_be_filtered_by_account(api, cheque, savings):
    spend(api, cheque, 1_000)
    spend(api, savings, 2_000)
    body = data(api.get("budget-transactions", account_id=savings.pk))
    assert [row["amount_cents"] for row in body] == [2_000]


# --- Transfers ------------------------------------------------------------------------------------


def test_a_transfer_writes_both_halves(api, cheque, savings):
    rows = data(api.post("budget-transfers", {"account_id": str(savings.pk),
                                              "related_account_id": str(cheque.pk),
                                              "amount_cents": 50_000}))
    assert {row["type"] for row in rows} == {"transfer_in", "transfer_out"}
    assert rows[0]["transfer_group_id"] == rows[1]["transfer_group_id"]
    assert data(api.get(f"budget-accounts/{cheque.pk}"))["balance_cents"] == 150_000
    assert data(api.get(f"budget-accounts/{savings.pk}"))["balance_cents"] == 450_000


def test_deleting_half_a_transfer_removes_the_other_half(api, cheque, savings):
    rows = data(api.post("budget-transfers", {"account_id": str(savings.pk),
                                              "related_account_id": str(cheque.pk),
                                              "amount_cents": 10_000}))
    assert api.delete(f"budget-transactions/{rows[0]['id']}").status_code == 204
    assert Transaction.objects.count() == 0


def test_a_transfer_to_the_same_account_is_422(api, cheque):
    response = api.post("budget-transfers", {"account_id": str(cheque.pk),
                                             "related_account_id": str(cheque.pk),
                                             "amount_cents": 1_000})
    assert response.status_code == 422


def test_a_transfer_beyond_the_balance_is_refused(api, cheque, savings):
    response = api.post("budget-transfers", {"account_id": str(cheque.pk),
                                             "related_account_id": str(savings.pk),
                                             "amount_cents": 900_000})
    assert response.status_code == 422 and Transaction.objects.count() == 0


# --- Receipts -------------------------------------------------------------------------------------


def test_a_receipt_is_attached_and_private(api, api_bob, cheque, settings, tmp_path):
    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    tx = spend(api, cheque, 12_345)
    body = data(api.upload(f"budget-transactions/{tx['id']}/receipt", file=png_upload()))
    assert body["transaction_id"] == tx["id"] and body["mime"] == "image/png"
    assert api.get(f"budget-receipts/{body['id']}/file").status_code == 200
    assert api_bob.get(f"budget-receipts/{body['id']}/file").status_code == 404      # ISO-05
    assert api.delete(f"budget-receipts/{body['id']}").status_code == 204
    assert Receipt.objects.count() == 0


def test_the_transaction_carries_its_receipt(api, cheque, settings, tmp_path):
    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    tx = spend(api, cheque, 500)
    api.upload(f"budget-transactions/{tx['id']}/receipt", file=png_upload())
    assert data(api.get(f"budget-transactions/{tx['id']}"))["receipt"]["mime"] == "image/png"


# --- Categories and caps ----------------------------------------------------------------------------


def test_the_starter_categories_appear_on_the_first_read(api, alice):
    assert Category.objects.count() == 0
    assert len(data(api.get("budget-categories"))) == 8


def test_deleting_a_category_leaves_its_transactions(api, cheque, groceries):
    spend(api, cheque, 1_000, category_id=str(groceries.pk))
    assert api.delete(f"budget-categories/{groceries.pk}").status_code == 204
    assert Transaction.objects.get().category_id is None


def test_a_cap_reports_what_has_been_spent_against_it(api, cheque, groceries):
    spend(api, cheque, 100_000, category_id=str(groceries.pk))
    body = data(api.post("budget-limits", {"category_id": str(groceries.pk), "limit_cents": 400_000}))
    assert body["spent_cents"] == 100_000 and body["percent"] == 25 and body["state"] == "ok"
    assert body["category"] == "Groceries" and body["period"] == "monthly"


def test_a_cap_that_is_passed_says_over(api, cheque, groceries):
    services.save_cap(api.user, category=groceries, cents=50_000)
    spend(api, cheque, 60_000, category_id=str(groceries.pk))
    body = data(api.get("budget-limits"))[0]
    assert body["state"] == "over" and body["percent"] == 120


def test_a_cap_near_its_warning_says_near(api, cheque, groceries):
    services.save_cap(api.user, category=groceries, cents=100_000)
    spend(api, cheque, 95_000, category_id=str(groceries.pk))
    assert data(api.get("budget-limits"))[0]["state"] == "near"


def test_a_cap_cannot_be_put_on_another_users_category(api, bob):
    theirs = Category.objects.create(owner=bob, name="Theirs", colour="#000000", glyph="T")
    assert api.post("budget-limits", {"category_id": str(theirs.pk),
                                      "limit_cents": 1_000}).status_code == 404
    assert Cap.objects.count() == 0


# --- Goals ------------------------------------------------------------------------------------------


def test_a_goal_tracks_what_has_been_put_into_it(api, alice):
    goal = data(api.post("budget-goals", {"name": "Emergency fund", "target_cents": 1_000_000}))
    assert goal["saved_cents"] == 0 and goal["percent"] == 0

    after = data(api.post(f"budget-goals/{goal['id']}/contribute", {"amount_cents": 250_000}))
    assert after["saved_cents"] == 250_000 and after["percent"] == 25
    assert after["remaining_cents"] == 750_000 and after["complete"] is False


def test_a_goal_that_is_reached_is_complete(api):
    goal = data(api.post("budget-goals", {"name": "Laptop", "target_cents": 100_000}))
    after = data(api.post(f"budget-goals/{goal['id']}/contribute", {"amount_cents": 100_000}))
    assert after["complete"] is True and after["remaining_cents"] == 0


def test_another_users_goal_is_404(api, bob):
    theirs = Goal.objects.create(owner=bob, name="Theirs", target_cents=1_000)
    assert api.get(f"budget-goals/{theirs.pk}").status_code == 404
    assert api.post(f"budget-goals/{theirs.pk}/contribute",
                    {"amount_cents": 100}).status_code == 404


# --- Recurring ----------------------------------------------------------------------------------------


def test_a_recurring_spend_is_stored_as_a_negative_amount(api, alice, cheque):
    body = data(api.post("recurring-transactions", {
        "account_id": str(cheque.pk), "type": "withdrawal", "amount_cents": 89_900,
        "description": "Streaming", "cadence": "monthly", "next_run_at": "2026-12-01"}))
    assert body["type"] == "withdrawal" and body["amount_cents"] == 89_900
    assert Recurring.objects.get(owner=alice).amount_cents == -89_900


def test_skipping_moves_the_next_date_on(api, cheque):
    row = data(api.post("recurring-transactions", {
        "account_id": str(cheque.pk), "type": "withdrawal", "amount_cents": 10_000,
        "description": "Gym", "cadence": "monthly", "next_run_at": "2026-12-01"}))
    after = data(api.post(f"recurring-transactions/{row['id']}/skip"))
    assert after["next_run_at"] == "2027-01-01"
    assert Transaction.objects.count() == 0      # skipping posts nothing


def test_confirming_posts_the_transaction(api, cheque):
    row = data(api.post("recurring-transactions", {
        "account_id": str(cheque.pk), "type": "withdrawal", "amount_cents": 10_000,
        "description": "Gym", "cadence": "monthly",
        "next_run_at": timezone.localdate().isoformat()}))
    posted = data(api.post(f"recurring-transactions/{row['id']}/confirm"))
    assert posted["amount_cents"] == 10_000
    assert Transaction.objects.get().amount_cents == -10_000


def test_pausing_a_recurring_item(api, cheque):
    row = data(api.post("recurring-transactions", {
        "account_id": str(cheque.pk), "type": "withdrawal", "amount_cents": 10_000,
        "description": "Gym", "cadence": "monthly", "next_run_at": "2026-12-01"}))
    assert data(api.put(f"recurring-transactions/{row['id']}", {"active": False}))["active"] is False


# --- Reports and what is due ------------------------------------------------------------------------------


def test_the_report_adds_up_the_month(api, cheque, groceries):
    spend(api, cheque, 84_250, category_id=str(groceries.pk), occurred_on=date.today().isoformat())
    data(api.post("budget-transactions", {"account_id": str(cheque.pk), "type": "deposit",
                                          "amount_cents": 4_200_000, "description": "Salary"}))
    body = data(api.get("budget-reports", months=3))
    assert body["currency"] == "ZAR" and body["months"] == 3
    assert body["totals"] == {"income_cents": 4_200_000, "expense_cents": 84_250,
                              "net_cents": 4_115_750}
    assert body["categories"][0]["name"] == "Groceries"
    assert len(body["monthly"]) == 3


def test_transfers_are_not_spending_in_the_report(api, cheque, savings):
    api.post("budget-transfers", {"account_id": str(cheque.pk), "related_account_id": str(savings.pk),
                                  "amount_cents": 20_000})
    body = data(api.get("budget-reports"))
    assert body["totals"] == {"income_cents": 0, "expense_cents": 0, "net_cents": 0}


def test_due_lists_the_bills_of_the_next_week(api, cheque):
    soon = (timezone.localdate() + timedelta(days=3)).isoformat()
    api.post("recurring-transactions", {"account_id": str(cheque.pk), "type": "withdrawal",
                                        "amount_cents": 10_000, "description": "Gym",
                                        "cadence": "monthly", "next_run_at": soon})
    api.post("recurring-transactions", {"account_id": str(cheque.pk), "type": "withdrawal",
                                        "amount_cents": 20_000, "description": "Insurance",
                                        "cadence": "monthly",
                                        "next_run_at": (timezone.localdate()
                                                        + timedelta(days=30)).isoformat()})
    body = data(api.get("budget-due"))
    assert [bill["description"] for bill in body["bills"]] == ["Gym"]
    assert body["bills"][0]["days_until_due"] == 3


def test_due_lists_only_the_caps_that_need_attention(api, cheque, groceries):
    services.save_cap(api.user, category=groceries, cents=50_000)
    body = data(api.get("budget-due"))
    assert body["limits"] == []
    spend(api, cheque, 60_000, category_id=str(groceries.pk))
    assert data(api.get("budget-due"))["limits"][0]["state"] == "over"


def test_another_users_money_is_not_in_any_list(api, bob):
    theirs = MoneyAccount.objects.create(owner=bob, name="Theirs", kind="cash", opening_cents=999)
    Transaction.objects.create(owner=bob, account=theirs, date=timezone.localdate(),
                               description="Theirs", amount_cents=-100)
    assert data(api.get("budget-accounts")) == []
    assert data(api.get("budget-transactions")) == []
