from datetime import UTC, datetime, timedelta

import pytest

from apps.core.errors import DomainError
from apps.training import selectors, services
from apps.training.models import Exercise

T0 = datetime(2026, 11, 10, 5, 0, tzinfo=UTC)


@pytest.fixture
def squat(db):
    return Exercise.objects.create(name="Test squat", muscle="legs", equipment="barbell")


def _routine(alice, squat):
    return services.save_routine(alice, name="Legs", notes="", items=[
        {"exercise_id": squat.pk, "target_sets": 2, "target_reps": 5, "rest_seconds": 120}])


def test_routine_session_prefills_from_last_time(alice, squat):
    routine = _routine(alice, squat)
    s1 = services.start_session(alice, routine, now=T0)
    for st in s1.sets.all():
        services.update_set(st, kg_x10=1000, reps=5, done=True, now=T0 + timedelta(minutes=5))
    services.finish_session(s1, now=T0 + timedelta(minutes=30))
    s2 = services.start_session(alice, routine, now=T0 + timedelta(days=2))
    assert [(x.kg_x10, x.reps) for x in s2.sets.all()] == [(1000, 5), (1000, 5)]


def test_only_one_live_session(alice):
    services.start_session(alice, now=T0)
    with pytest.raises(DomainError):
        services.start_session(alice, now=T0)


def test_done_set_starts_rest(alice, squat):
    routine = _routine(alice, squat)
    s = services.start_session(alice, routine, now=T0)
    first = s.sets.first()
    services.update_set(first, kg_x10=1000, reps=5, done=True, now=T0)
    s.refresh_from_db()
    assert s.rest_until == T0 + timedelta(seconds=120)


def test_heavier_set_is_a_pr(alice, squat):
    routine = _routine(alice, squat)
    s1 = services.start_session(alice, routine, now=T0)
    for st in s1.sets.all():
        services.update_set(st, kg_x10=1000, reps=5, done=True, now=T0)
    services.finish_session(s1, now=T0 + timedelta(minutes=30))
    s2 = services.start_session(alice, routine, now=T0 + timedelta(days=2))
    services.update_set(s2.sets.first(), kg_x10=1050, reps=5, done=True, now=T0 + timedelta(days=2))
    page = selectors.live_page(alice, s2)
    assert page["groups"][0]["sets"][0]["pr"] is True


def test_bobs_routine_cannot_use_alices_custom_exercise(alice, bob):  # ISO
    mine = services.create_exercise(alice, name="Secret lift", muscle="full", equipment="other")
    with pytest.raises(DomainError):
        services.save_routine(bob, name="X", notes="", items=[{"exercise_id": mine.pk}])


def test_photo_is_hidden_from_others(client, alice, bob):  # ISO-05
    from apps.training.models import ProgressPhoto

    photo = ProgressPhoto.objects.create(owner=alice, date=T0.date(), file="u1/progressphoto/x.png",
                                         content_type="image/png")
    client.force_login(bob)
    assert client.get(f"/files/photo/{photo.pk}/").status_code == 404
