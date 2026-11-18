import pytest

from apps.notes.models import Note
from apps.today.selectors import deck, greeting
from conftest import props


@pytest.mark.parametrize(("counts", "text"), [
    ({"running": 0, "over": 0, "due": 0}, "All quiet."),
    ({"running": 1, "over": 0, "due": 0}, "One thing running."),
    ({"running": 1, "over": 1, "due": 0}, "One thing running and one cap broken."),
    ({"running": 2, "over": 1, "due": 3}, "Two things running, one cap broken and three items due soon."),
    ({"running": 0, "over": 0, "due": 7}, "7 items due soon."),
])
def test_deck(counts, text):
    assert deck(counts) == text


def test_greeting():
    assert greeting(8) == "Good morning." and greeting(20) == "Good evening."


def test_first_run_for_new_account(as_alice):
    assert props(as_alice.get("/"))["first_run"] is True


def test_not_first_run_once_there_is_data(alice, as_alice):
    Note.objects.create(owner=alice, title="Hello")
    p = props(as_alice.get("/"))
    assert p["first_run"] is False and p["notes"][0]["title"] == "Hello"


def test_today_query_budget(as_alice, django_assert_max_num_queries):  # Stage 15
    with django_assert_max_num_queries(40):
        as_alice.get("/")
