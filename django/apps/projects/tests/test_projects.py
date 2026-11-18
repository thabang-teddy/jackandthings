from datetime import UTC, datetime, timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.projects import services as s
from apps.projects.models import Card, TimeEntry
from conftest import props

T0 = datetime(2026, 11, 17, 7, 0, tzinfo=UTC)


@pytest.fixture
def board(alice):
    p = s.create_project(alice, name="Q4 offsite")
    todo = p.columns.get(name="To do")
    a = s.create_card(alice, p, title="A", column=todo)
    b = s.create_card(alice, p, title="B", column=todo)
    return p, todo, a, b


def test_new_project_has_five_columns(board):
    p, *_ = board
    assert list(p.columns.values_list("name", flat=True)) == ["Backlog", "To do", "Doing", "Review", "Done"]


def test_start_b_stops_a(alice, board):
    _, _, a, b = board
    s.start(alice, a, now=T0)
    entry, stopped = s.start(alice, b, now=T0 + timedelta(minutes=47))
    assert stopped.card == a and stopped.seconds == 47 * 60 and entry.card == b
    assert TimeEntry.objects.filter(running_key__isnull=False).count() == 1


def test_pause_is_not_counted(alice, board):
    _, _, a, _ = board
    e, _ = s.start(alice, a, now=T0)
    s.pause(e, now=T0 + timedelta(minutes=10))
    s.resume(e, now=T0 + timedelta(minutes=15))
    s.stop(e, now=T0 + timedelta(minutes=20))
    assert e.seconds == 15 * 60


@pytest.mark.django_db(transaction=True)
def test_database_refuses_second_running_entry(alice):
    p = s.create_project(alice, name="P")
    card = s.create_card(alice, p, title="C")
    TimeEntry.objects.create(owner=alice, card=card, started_at=T0, local_date=T0.date(), running_key=alice.pk)
    with pytest.raises(IntegrityError), transaction.atomic():
        TimeEntry.objects.create(owner=alice, card=card, started_at=T0, local_date=T0.date(), running_key=alice.pk)


def test_move_to_done_completes_and_back_reopens(alice, board):
    p, todo, a, b = board
    done = p.columns.get(name="Done")
    s.move_card(alice, a, done, 0)
    a.refresh_from_db()
    assert a.completed_at is not None
    s.move_card(alice, a, todo, 0)
    a.refresh_from_db()
    assert a.completed_at is None
    assert list(Card.objects.filter(column=todo).values_list("title", flat=True)) == ["A", "B"]


def test_move_within_column_renumbers(alice, board):
    _, todo, a, b = board
    s.move_card(alice, a, todo, 5)  # past the end: clamps
    assert list(Card.objects.filter(column=todo).values_list("title", "position")) == [("B", 0), ("A", 1)]


def test_bob_cannot_see_or_move_alices_card(as_bob, board):  # ISO-03
    _, todo, a, _ = board
    assert as_bob.get(f"/projects/cards/{a.pk}/").status_code == 404
    assert as_bob.post(f"/projects/cards/{a.pk}/move/", {"column_id": todo.pk, "position": 0}).status_code == 404
    assert as_bob.post(f"/projects/cards/{a.pk}/timer/start/").status_code == 404


def test_bob_cannot_move_his_card_into_alices_column(bob, as_bob, board):  # ISO-04
    _, alice_todo, *_ = board
    mine = s.create_project(bob, name="Mine")
    card = s.create_card(bob, mine, title="Mine")
    r = as_bob.post(f"/projects/cards/{card.pk}/move/", {"column_id": alice_todo.pk, "position": 0})
    assert r.status_code == 404


def test_all_projects_board_groups_by_column_name(as_alice, board):
    r = as_alice.get("/projects/")
    cols = {c["name"]: [card["title"] for card in c["cards"]] for c in props(r)["columns"]}
    assert cols["To do"] == ["A", "B"]


def test_timesheet_csv(alice, as_alice, board):
    _, _, a, _ = board
    s.add_manual_entry(alice, a, started_at=timezone.now() - timedelta(hours=2), minutes=30)
    body = as_alice.client.get("/projects/time.csv").content.decode()
    assert body.splitlines()[0] == "date,start,stop,minutes,card,project"
    assert ",30,A,Q4 offsite" in body
