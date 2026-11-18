"""Every record the token API returns, spelled in the wire names `api/v1` already uses.

The Django models here came from the Daybook build; the field names the Android client
and the add-on expect came from the Laravel app. This module is the one place the two
meet, so a rename on either side is a change in a single file. Where the Django domain
has no equivalent of a Laravel column the key is simply absent — the clients' DTOs give
every optional field a default — and `django/docs/API_V1.md` lists each of those gaps.

Ids go out as strings because the clients type them as strings; the user's own id is a
number there, so it stays a number here.
"""
from __future__ import annotations

from typing import Any

from django.urls import reverse

from apps.focus.models import Preset, Session
from apps.library.models import Visit, WatchItem, WatchList
from apps.money.models import Cap, Category, Goal, MoneyAccount, Receipt, Recurring, Transaction
from apps.money.selectors import balance_of
from apps.notes.models import Note
from apps.training.models import BodyEntry, Exercise, ProgressPhoto, Routine, WorkoutSession, WorkoutSet

GRAMS_PER_KG_TENTH = 100          # kg_x10 775 (77,5 kg) -> 77_500 g
MM_PER_CM = 10


def iso(value) -> str | None:
    return value.isoformat() if value else None


def sid(value) -> str | None:
    """A primary key as the clients type it: a string."""
    return None if value is None else str(value)


# --- Accounts ----------------------------------------------------------------------------------


def user(row) -> dict[str, Any]:
    return {"id": row.pk, "name": row.name, "email": row.email}


# --- Notes -------------------------------------------------------------------------------------


def note(row: Note) -> dict[str, Any]:
    return {"id": sid(row.pk), "title": row.title, "body": row.body,
            "created_at": iso(row.created_at), "updated_at": iso(row.updated_at)}


# --- Focus (Pomodoro) --------------------------------------------------------------------------

AUTO_START_BREAKS = {"breaks", "both"}
AUTO_START_FOCUS = {"focus", "both"}


def preset(row: Preset) -> dict[str, Any]:
    return {
        "id": sid(row.pk),
        "name": row.name,
        "focus_minutes": row.focus_min,
        "break_minutes": row.short_min,
        "long_break_minutes": row.long_min,
        "cycles_before_long_break": row.long_every,
        "auto_start_breaks": row.auto_start in AUTO_START_BREAKS,
        "auto_start_focus": row.auto_start in AUTO_START_FOCUS,
        "alarm_sound": row.sound,
        "strict_mode": row.strict,
        "is_default": row.is_default,
    }


def auto_start_value(*, breaks: bool, focus: bool) -> str:
    """The two client booleans collapsed back into the one stored choice."""
    if breaks and focus:
        return Preset.AutoStart.BOTH
    if breaks:
        return Preset.AutoStart.BREAKS
    if focus:
        return Preset.AutoStart.FOCUS
    return Preset.AutoStart.OFF


def session_seconds(row: Session) -> int:
    """How long the interval actually lasted, pauses removed; the plan if it never ended."""
    if row.ended_at is None:
        return row.planned_seconds
    return max(0, int((row.ended_at - row.started_at).total_seconds()) - row.paused_seconds)


def focus_session(row: Session) -> dict[str, Any]:
    return {
        "id": sid(row.pk),
        "pomodoro_preset_id": sid(row.preset_id),
        "preset_name": row.preset.name if row.preset_id else "",
        "tag": row.tag,
        "phase": row.phase,
        "started_at": iso(row.started_at),
        "ended_at": iso(row.ended_at),
        "duration_seconds": session_seconds(row),
        "completed": row.completed,
    }


# --- Library -----------------------------------------------------------------------------------


def watch_item(row: WatchItem) -> dict[str, Any]:
    return {"id": sid(row.pk), "watch_list_id": sid(row.watch_list_id), "title": row.title,
            "url": row.url, "note": row.note, "done": row.done_at is not None,
            "done_at": iso(row.done_at), "position": row.position}


def watch_list(row: WatchList, *, items: list[WatchItem] | None = None) -> dict[str, Any]:
    rows = row.items.all() if items is None else items
    return {"id": sid(row.pk), "name": row.name, "position": row.position,
            "items": [watch_item(item) for item in rows]}


def visit(row: Visit) -> dict[str, Any]:
    return {"id": sid(row.pk), "url": row.url, "title": row.title, "visited_at": iso(row.visited_at),
            "created_at": iso(row.created_at)}


# --- Training ----------------------------------------------------------------------------------


def exercise(row: Exercise) -> dict[str, Any]:
    return {"id": sid(row.pk), "name": row.name, "category": row.muscle,
            "category_label": row.get_muscle_display(), "metric": "weight_reps",
            "metric_label": "Weight and reps", "primary_muscle": row.muscle,
            "equipment": row.equipment, "is_custom": row.owner_id is not None}


def routine_item(row) -> dict[str, Any]:
    return {"id": sid(row.pk), "exercise_id": sid(row.exercise_id), "exercise_name": row.exercise.name,
            "category": row.exercise.muscle, "metric": "weight_reps", "position": row.position,
            "target_sets": row.target_sets, "target_reps": row.target_reps,
            "rest_seconds": row.rest_seconds}


def routine(row: Routine) -> dict[str, Any]:
    return {"id": sid(row.pk), "name": row.name, "notes": row.notes, "created_at": iso(row.created_at),
            "items": [routine_item(item) for item in row.items.select_related("exercise")]}


def workout_set(row: WorkoutSet) -> dict[str, Any]:
    grams = row.kg_x10 * GRAMS_PER_KG_TENTH
    return {"id": sid(row.pk), "workout_session_id": sid(row.session_id), "exercise_id": sid(row.exercise_id),
            "exercise_name": row.exercise.name, "metric": "weight_reps", "position": row.position,
            "reps": row.reps, "weight_grams": grams, "rest_seconds": row.rest_seconds,
            "volume_grams": grams * row.reps, "completed_at": iso(row.done_at)}


def workout_session(row: WorkoutSession, *, sets: list[WorkoutSet] | None = None) -> dict[str, Any]:
    rows = list(row.sets.select_related("exercise")) if sets is None else sets
    seconds = int((row.ended_at - row.started_at).total_seconds()) if row.ended_at else None
    return {
        "id": sid(row.pk),
        "workout_routine_id": sid(row.routine_id),
        "routine_name": row.name,
        "started_at": iso(row.started_at),
        "finished_at": iso(row.ended_at),
        "is_open": row.ended_at is None,
        "notes": row.notes,
        "duration_seconds": seconds,
        "set_count": len(rows),
        "volume_grams": sum(s.kg_x10 * GRAMS_PER_KG_TENTH * s.reps for s in rows),
        "sets": [workout_set(s) for s in rows],
    }


def body_metric(row: BodyEntry, *, photos: list[ProgressPhoto] | None = None) -> dict[str, Any]:
    measurements = {name: value // MM_PER_CM for name, value in
                    (("waist", row.waist_mm), ("chest", row.chest_mm), ("hips", row.hips_mm)) if value}
    return {"id": sid(row.pk), "measured_on": iso(row.date), "weight_grams": row.weight_g,
            "measurements": measurements, "notes": row.note,
            "photos": [progress_photo(photo) for photo in (photos or [])]}


def progress_photo(row: ProgressPhoto) -> dict[str, Any]:
    return {"id": sid(row.pk), "taken_on": iso(row.date), "mime": row.content_type,
            "size_bytes": _size(row), "url": reverse("v1:progress-photo-file", args=[row.pk])}


def _size(row) -> int:
    try:
        return row.file.size
    except (OSError, ValueError):   # the row outlived its file; report nothing rather than crash
        return 0


# --- Money -------------------------------------------------------------------------------------

DEPOSIT, WITHDRAWAL = "deposit", "withdrawal"
TRANSFER_IN, TRANSFER_OUT = "transfer_in", "transfer_out"


def account(row: MoneyAccount, *, balance: int | None = None) -> dict[str, Any]:
    cents = balance_of(row.owner, row.pk) if balance is None else balance
    return {"id": sid(row.pk), "name": row.name, "kind": row.kind,
            "opening_balance_cents": row.opening_cents, "balance_cents": cents,
            "archived_at": iso(row.updated_at) if row.archived else None}


def transaction_type(row: Transaction) -> str:
    """Laravel stores the direction; here it is the sign, and a transfer has a group id."""
    if row.transfer_group:
        return TRANSFER_IN if row.amount_cents > 0 else TRANSFER_OUT
    return DEPOSIT if row.amount_cents > 0 else WITHDRAWAL


def transaction(row: Transaction) -> dict[str, Any]:
    receipt_row = getattr(row, "receipt", None)
    return {
        "id": sid(row.pk),
        "type": transaction_type(row),
        "amount_cents": abs(row.amount_cents),
        "signed_amount_cents": row.amount_cents,
        "description": row.description,
        "account_id": sid(row.account_id),
        "account": row.account.name,
        "category_id": sid(row.category_id),
        "category": row.category.name if row.category_id else None,
        "occurred_on": iso(row.date),
        "transfer_group_id": str(row.transfer_group) if row.transfer_group else None,
        "receipt": receipt(receipt_row) if receipt_row else None,
        "created_at": iso(row.created_at),
    }


def receipt(row: Receipt) -> dict[str, Any]:
    return {"id": sid(row.pk), "transaction_id": sid(row.transaction_id), "mime": row.content_type,
            "size_bytes": _size(row), "url": reverse("v1:receipt-file", args=[row.pk])}


def category(row: Category) -> dict[str, Any]:
    return {"id": sid(row.pk), "name": row.name, "kind": "expense", "kind_label": "Expense",
            "colour": row.colour, "glyph": row.glyph}


def cap(row: Cap, *, spent_cents: int = 0) -> dict[str, Any]:
    """Laravel calls this a budget limit; the Daybook build calls it a cap on a category."""
    percent = min(999, round(spent_cents * 100 / row.amount_cents)) if row.amount_cents else 0
    if spent_cents > row.amount_cents:
        state = "over"
    elif percent >= row.warn_at_pct:
        state = "near"
    else:
        state = "ok"
    return {"id": sid(row.pk), "category_id": sid(row.category_id), "category": row.category.name,
            "period": "monthly", "limit_cents": row.amount_cents, "spent_cents": spent_cents,
            "state": state, "percent": percent}


def goal(row: Goal, *, saved_cents: int = 0) -> dict[str, Any]:
    remaining = max(0, row.target_cents - saved_cents)
    percent = min(100, round(saved_cents * 100 / row.target_cents)) if row.target_cents else 0
    return {"id": sid(row.pk), "name": row.name, "target_cents": row.target_cents,
            "saved_cents": saved_cents, "remaining_cents": remaining, "percent": percent,
            "complete": row.completed_at is not None or remaining == 0,
            "target_date": iso(row.target_date), "archived_at": iso(row.completed_at)}


def recurring(row: Recurring) -> dict[str, Any]:
    return {"id": sid(row.pk), "account_id": sid(row.account_id), "category_id": sid(row.category_id),
            "type": DEPOSIT if row.amount_cents > 0 else WITHDRAWAL,
            "amount_cents": abs(row.amount_cents), "description": row.name, "cadence": row.cadence,
            "next_run_at": iso(row.next_date), "active": row.active, "auto_post": row.auto_post,
            "account": {"id": sid(row.account_id), "name": row.account.name}}
