from datetime import UTC, datetime, timedelta

import pytest

from apps.core.errors import DomainError
from apps.focus import services
from apps.focus.models import Session

T0 = datetime(2026, 11, 17, 5, 11, tzinfo=UTC)


@pytest.mark.django_db
def test_pause_does_not_count(alice):
    p = services.ensure_default_preset(alice)
    s = services.start(alice, p, now=T0)
    services.pause(s, now=T0 + timedelta(minutes=5))
    services.resume(s, now=T0 + timedelta(minutes=8))
    assert services.remaining_seconds(s, T0 + timedelta(minutes=10)) == 25 * 60 - 7 * 60


@pytest.mark.django_db
def test_cannot_start_twice(alice):
    p = services.ensure_default_preset(alice)
    services.start(alice, p, now=T0)
    with pytest.raises(DomainError):
        services.start(alice, p, now=T0)


@pytest.mark.django_db
def test_stale_session_is_closed(alice):
    p = services.ensure_default_preset(alice)
    services.start(alice, p, now=T0)
    assert services.close_stale(now=T0 + timedelta(minutes=26)) == 1
    assert Session.objects.filter(running_key__isnull=False).count() == 0


@pytest.mark.django_db
def test_fourth_focus_is_followed_by_long_break(alice):
    p = services.ensure_default_preset(alice)
    s = services.start(alice, p, cycle_index=4, now=T0)
    assert services.next_phase(s) == ("long", 4)


@pytest.mark.django_db
def test_bob_cannot_delete_alices_preset(client, alice, bob):  # ISO
    p = services.ensure_default_preset(alice)
    client.force_login(bob)
    assert client.delete(f"/focus/presets/{p.pk}/", HTTP_X_INERTIA="true").status_code == 404
