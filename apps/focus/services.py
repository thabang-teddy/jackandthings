from __future__ import annotations

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.errors import DomainError

from .models import Preset, Session


def ensure_default_preset(owner) -> Preset:
    preset, _ = Preset.objects.get_or_create(
        owner=owner, name="Classic", defaults={"is_default": True}
    )
    return preset


def elapsed_seconds(s: Session, now: datetime) -> int:
    end = s.paused_at or s.ended_at or now
    return max(0, int((end - s.started_at).total_seconds()) - s.paused_seconds)


def remaining_seconds(s: Session, now: datetime) -> int:
    return max(0, s.planned_seconds - elapsed_seconds(s, now))


def _minutes_for(preset: Preset, phase: str) -> int:
    return {"focus": preset.focus_min, "short": preset.short_min, "long": preset.long_min}[phase]


@transaction.atomic
def start(owner, preset: Preset, *, phase: str = "focus", tag: str = "", cycle_index: int = 1,
          now: datetime | None = None) -> Session:
    now = now or timezone.now()
    if Session.objects.filter(running_key=owner.pk).exists():
        raise DomainError("A session is already running.")
    try:
        return Session.objects.create(
            owner=owner, preset=preset, phase=phase, tag=tag, cycle_index=cycle_index,
            started_at=now, local_date=timezone.localdate(now),
            planned_seconds=_minutes_for(preset, phase) * 60, running_key=owner.pk,
        )
    except IntegrityError as exc:          # two tabs pressed Start at the same instant
        raise DomainError("A session is already running.") from exc


def pause(s: Session, *, now: datetime | None = None) -> None:
    if s.paused_at is None and s.ended_at is None:
        s.paused_at = now or timezone.now()
        s.save(update_fields=["paused_at", "updated_at"])


def resume(s: Session, *, now: datetime | None = None) -> None:
    now = now or timezone.now()
    if s.paused_at is not None:
        s.paused_seconds += int((now - s.paused_at).total_seconds())
        s.paused_at = None
        s.save(update_fields=["paused_at", "paused_seconds", "updated_at"])


def finish(s: Session, *, completed: bool, now: datetime | None = None) -> None:
    now = now or timezone.now()
    resume(s, now=now)
    s.ended_at = min(now, s.started_at + timedelta(seconds=s.planned_seconds + s.paused_seconds))
    s.completed, s.running_key = completed, None
    s.save(update_fields=["ended_at", "completed", "running_key", "updated_at"])


def close_stale(now: datetime | None = None) -> int:
    """Cron: close sessions whose planned end has passed (the tab was closed)."""
    now, closed = now or timezone.now(), 0
    for s in Session.objects.filter(running_key__isnull=False, paused_at__isnull=True):
        if remaining_seconds(s, now) == 0:
            finish(s, completed=True, now=now)
            closed += 1
    return closed


# --- Added for the views (Stage 8, step 4) ---------------------------------------------------


def next_phase(s: Session) -> tuple[str, int]:
    """What comes after `s`: (phase, cycle_index). Focus → break; break → the next focus."""
    long_every = s.preset.long_every if s.preset else 4
    if s.phase == Session.Phase.FOCUS:
        return ("long" if s.cycle_index % max(1, long_every) == 0 else "short"), s.cycle_index
    next_cycle = 1 if s.phase == Session.Phase.LONG else s.cycle_index + 1
    return "focus", next_cycle


def should_auto_start(preset: Preset, phase: str) -> bool:
    mode = preset.auto_start
    if mode == Preset.AutoStart.BOTH:
        return True
    if mode == Preset.AutoStart.BREAKS:
        return phase in {"short", "long"}
    if mode == Preset.AutoStart.FOCUS:
        return phase == "focus"
    return False


@transaction.atomic
def skip(s: Session, *, now: datetime | None = None) -> Session | None:
    """Finish the running phase as completed; start the next one if the preset says so."""
    now = now or timezone.now()
    finish(s, completed=True, now=now)
    phase, cycle = next_phase(s)
    if s.preset and should_auto_start(s.preset, phase):
        return start(s.owner, s.preset, phase=phase, tag=s.tag, cycle_index=cycle, now=now)
    return None


def save_preset(owner, data: dict, preset: Preset | None = None) -> Preset:
    """Create or update a preset from cleaned form data. Only one preset can be the default."""
    with transaction.atomic():
        preset = preset or Preset(owner=owner)
        for field, value in data.items():
            setattr(preset, field, value)
        try:
            preset.save()
        except IntegrityError as exc:
            raise DomainError("You already have a preset with that name.", field="name") from exc
        if preset.is_default:
            Preset.objects.for_user(owner).exclude(pk=preset.pk).update(is_default=False)
        return preset


def delete_preset(preset: Preset) -> None:
    owner = preset.owner
    if Preset.objects.for_user(owner).count() <= 1:
        raise DomainError("Keep at least one preset.")
    was_default = preset.is_default
    preset.delete()  # sessions keep their history: preset FK is SET_NULL
    if was_default:
        first = Preset.objects.for_user(owner).order_by("name").first()
        if first:
            first.is_default = True
            first.save(update_fields=["is_default", "updated_at"])
