"""Focus presets and logged intervals, including the two spellings of auto-start.

A client runs its own countdown and logs the interval afterwards, so these routes take a
start, an end and a duration rather than driving the server-side timer the website uses.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.focus.models import Preset, Session

from .conftest import data, errors

START = "2026-11-18T08:00:00+02:00"
STOP = "2026-11-18T08:25:00+02:00"
INTERVAL = {"phase": "focus", "tag": "Writing", "started_at": START, "ended_at": STOP,
            "duration_seconds": 1500}


@pytest.fixture
def preset(alice):
    return Preset.objects.create(owner=alice, name="Classic", is_default=True)


def test_create_preset_maps_the_client_names_to_the_stored_ones(api, alice):
    body = data(api.post("pomodoro-presets", {
        "name": "Deep work", "focus_minutes": 50, "break_minutes": 10, "long_break_minutes": 25,
        "cycles_before_long_break": 3, "alarm_sound": "chime", "strict_mode": True}))
    row = Preset.objects.get(owner=alice, name="Deep work")
    assert (row.focus_min, row.short_min, row.long_min, row.long_every) == (50, 10, 25, 3)
    assert row.sound == "chime" and row.strict is True
    assert body["focus_minutes"] == 50 and body["cycles_before_long_break"] == 3


@pytest.mark.parametrize(("breaks", "focus", "stored"), [
    (False, False, "off"), (True, False, "breaks"), (False, True, "focus"), (True, True, "both"),
])
def test_two_auto_start_booleans_become_one_stored_choice(api, alice, breaks, focus, stored):
    body = data(api.post("pomodoro-presets", {"name": f"P{breaks}{focus}", "focus_minutes": 25,
                                              "auto_start_breaks": breaks, "auto_start_focus": focus}))
    assert Preset.objects.get(owner=alice, name=f"P{breaks}{focus}").auto_start == stored
    assert (body["auto_start_breaks"], body["auto_start_focus"]) == (breaks, focus)


def test_only_one_preset_can_be_the_default(api, preset):
    data(api.post("pomodoro-presets", {"name": "Second", "focus_minutes": 30, "is_default": True}))
    preset.refresh_from_db()
    assert preset.is_default is False


def test_a_duplicate_name_is_422(api, preset):
    response = api.post("pomodoro-presets", {"name": "Classic", "focus_minutes": 25})
    assert response.status_code == 422 and "name" in errors(response)


def test_the_last_preset_cannot_be_deleted(api, preset):
    response = api.delete(f"pomodoro-presets/{preset.pk}")
    assert response.status_code == 422
    assert Preset.objects.count() == 1


def test_another_users_preset_is_404(api, bob):
    theirs = Preset.objects.create(owner=bob, name="Theirs")
    assert api.get(f"pomodoro-presets/{theirs.pk}").status_code == 404
    assert api.put(f"pomodoro-presets/{theirs.pk}", {"name": "Mine"}).status_code == 404


def test_logging_an_interval_stores_the_local_day(api, alice, preset):
    body = data(api.post("pomodoro-sessions", {**INTERVAL, "pomodoro_preset_id": str(preset.pk)}))
    row = Session.objects.get(owner=alice)
    assert row.local_date.isoformat() == "2026-11-18"      # 08:00 in Johannesburg, not UTC
    assert row.planned_seconds == 1500 and row.preset_id == preset.pk
    assert body["duration_seconds"] == 1500 and body["preset_name"] == "Classic"


def test_an_interval_without_an_end_takes_its_duration(api, alice):
    body = data(api.post("pomodoro-sessions", {"phase": "focus", "started_at": START,
                                               "duration_seconds": 600}))
    assert body["ended_at"].startswith("2026-11-18T08:10")


def test_a_start_without_a_time_zone_is_422(api):
    response = api.post("pomodoro-sessions", {**INTERVAL, "started_at": "2026-11-18T08:00:00"})
    assert response.status_code == 422 and "started_at" in errors(response)


def test_an_unknown_phase_is_422(api):
    response = api.post("pomodoro-sessions", {**INTERVAL, "phase": "nap"})
    assert response.status_code == 422 and "phase" in errors(response)


def test_another_users_preset_cannot_be_borrowed(api, bob):
    theirs = Preset.objects.create(owner=bob, name="Theirs")
    assert api.post("pomodoro-sessions", {**INTERVAL,
                                          "pomodoro_preset_id": str(theirs.pk)}).status_code == 404
    assert Session.objects.count() == 0


def test_a_running_interval_is_not_in_the_history(api, alice, preset):
    now = timezone.now()
    Session.objects.create(owner=alice, preset=preset, phase="focus", started_at=now,
                           local_date=timezone.localdate(), planned_seconds=1500,
                           running_key=alice.pk)
    assert api.get("pomodoro-sessions").json()["meta"]["total"] == 0


def test_stats_count_today_and_the_week(api, alice, preset):
    now = timezone.now()
    for days_ago in (0, 0, 3):
        started = now - timedelta(days=days_ago, hours=1)
        Session.objects.create(owner=alice, preset=preset, phase="focus", tag="Writing",
                               started_at=started, local_date=timezone.localtime(started).date(),
                               planned_seconds=1500, ended_at=started + timedelta(seconds=1500),
                               completed=True)
    body = data(api.get("pomodoro-sessions/stats"))
    assert body["today"] == {"focus_seconds": 3000, "intervals": 2}
    assert body["history"]["intervals"] == 3
    assert body["completion_rate"] == 1.0 and body["streak_days"] >= 1
    assert body["tags"][0]["tag"] == "Writing"
    assert len(body["days"]) == 7 and body["history_days"] == 90


def test_stats_of_an_empty_account_are_zeroes(api):
    body = data(api.get("pomodoro-sessions/stats"))
    assert body["today"] == {"focus_seconds": 0, "intervals": 0}
    assert body["completion_rate"] is None and body["most_productive_hour"] is None


def test_deleting_an_interval(api, alice, preset):
    body = data(api.post("pomodoro-sessions", INTERVAL))
    assert api.delete(f"pomodoro-sessions/{body['id']}").status_code == 204
    assert Session.objects.count() == 0
