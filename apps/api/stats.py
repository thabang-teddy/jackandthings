"""The two computed blocks `api/v1` serves: focus analytics and training analytics.

Both are read-only summaries of rows the user already owns. They are grouped by the
stored `local_date` column rather than by converting a timestamp in SQL — see
DATABASE.md: shared hosting has no time-zone tables for CONVERT_TZ.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.utils import timezone

from apps.focus.models import Session
from apps.training.models import WorkoutSession, WorkoutSet

HISTORY_DAYS = 90
CHART_DAYS = 7
GRAMS_PER_KG_TENTH = 100


def _day_labels(start: date, days: int) -> list[date]:
    return [start + timedelta(days=offset) for offset in range(days)]


# --- Focus --------------------------------------------------------------------------------------


def _focus_totals(rows) -> dict[str, int]:
    seconds = 0
    intervals = 0
    for row in rows:
        seconds += _focus_seconds(row)
        intervals += 1
    return {"focus_seconds": seconds, "intervals": intervals}


def _focus_seconds(row: Session) -> int:
    if row.ended_at is None:
        return row.planned_seconds
    return max(0, int((row.ended_at - row.started_at).total_seconds()) - row.paused_seconds)


def focus_stats(owner, *, timezone_name: str | None = None) -> dict[str, Any]:
    """Today, this week and the last 90 days of finished focus intervals."""
    today = timezone.localdate()
    start = today - timedelta(days=HISTORY_DAYS - 1)
    rows = list(Session.objects.for_user(owner)
                .filter(phase=Session.Phase.FOCUS, running_key__isnull=True, local_date__gte=start)
                .select_related("preset"))

    week_start = today - timedelta(days=today.weekday())
    by_day: dict[date, list[Session]] = {}
    by_hour: dict[int, list[Session]] = {}
    by_tag: dict[str, list[Session]] = {}
    for row in rows:
        by_day.setdefault(row.local_date, []).append(row)
        by_hour.setdefault(timezone.localtime(row.started_at).hour, []).append(row)
        by_tag.setdefault(row.tag, []).append(row)

    days = [{"date": day.isoformat(), "label": day.strftime("%a"), **_focus_totals(by_day.get(day, []))}
            for day in _day_labels(today - timedelta(days=CHART_DAYS - 1), CHART_DAYS)]
    hours = [{"hour": hour, **_focus_totals(sessions)} for hour, sessions in sorted(by_hour.items())]
    tags = [{"tag": tag or None, **_focus_totals(sessions)} for tag, sessions in
            sorted(by_tag.items(), key=lambda item: -_focus_totals(item[1])["focus_seconds"])]

    completed = sum(1 for row in rows if row.completed)
    busiest = max(hours, key=lambda bucket: bucket["focus_seconds"], default=None)

    return {
        "timezone": timezone_name or timezone.get_current_timezone_name(),
        "today": _focus_totals(by_day.get(today, [])),
        "week": _focus_totals([row for row in rows if row.local_date >= week_start]),
        "history": _focus_totals(rows),
        "days": days,
        "hours": hours,
        "tags": tags,
        "most_productive_hour": busiest["hour"] if busiest else None,
        "streak_days": _streak(set(by_day), today),
        "completion_rate": round(completed / len(rows), 4) if rows else None,
        "history_days": HISTORY_DAYS,
    }


def _streak(days: set[date], today: date) -> int:
    """Days in a row up to today (or up to yesterday, if nothing has been logged yet today)."""
    cursor = today if today in days else today - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def _longest_streak(days: set[date]) -> int:
    longest = 0
    for day in days:
        if day - timedelta(days=1) in days:
            continue                                   # not the start of a run
        length = 0
        cursor = day
        while cursor in days:
            length += 1
            cursor += timedelta(days=1)
        longest = max(longest, length)
    return longest


# --- Training -----------------------------------------------------------------------------------


def _set_volume(row: WorkoutSet) -> int:
    return row.kg_x10 * GRAMS_PER_KG_TENTH * row.reps


def _workout_totals(sets: list[WorkoutSet], sessions: int) -> dict[str, int]:
    return {"sets": len(sets), "volume_grams": sum(_set_volume(s) for s in sets),
            "reps": sum(s.reps for s in sets), "distance_metres": 0, "duration_seconds": 0,
            "sessions": sessions}


def workout_stats(owner, *, timezone_name: str | None = None) -> dict[str, Any]:
    """Volume, sets and streaks over the last 90 days, plus a personal best per exercise."""
    today = timezone.localdate()
    start = today - timedelta(days=HISTORY_DAYS - 1)
    sessions = list(WorkoutSession.objects.for_user(owner).filter(local_date__gte=start))
    session_days = {s.pk: s.local_date for s in sessions}
    sets = list(WorkoutSet.objects.for_user(owner)
                .filter(session_id__in=session_days, done_at__isnull=False)
                .select_related("exercise"))

    by_day: dict[date, list[WorkoutSet]] = {}
    for row in sets:
        by_day.setdefault(session_days[row.session_id], []).append(row)
    sessions_by_day: dict[date, int] = {}
    for row in sessions:
        sessions_by_day[row.local_date] = sessions_by_day.get(row.local_date, 0) + 1

    week_start = today - timedelta(days=today.weekday())
    week_sets = [row for row in sets if session_days[row.session_id] >= week_start]

    by_category: dict[str, list[WorkoutSet]] = {}
    for row in sets:
        by_category.setdefault(row.exercise.muscle, []).append(row)

    trained_days = {day for day, rows in by_day.items() if rows}

    return {
        "timezone": timezone_name or timezone.get_current_timezone_name(),
        "today": _workout_totals(by_day.get(today, []), sessions_by_day.get(today, 0)),
        "week": _workout_totals(week_sets, sum(count for day, count in sessions_by_day.items()
                                               if day >= week_start)),
        "history": _workout_totals(sets, len(sessions)),
        "days": [{"date": day.isoformat(), "label": day.strftime("%a"), "sets": len(by_day.get(day, [])),
                  "volume_grams": sum(_set_volume(s) for s in by_day.get(day, []))}
                 for day in _day_labels(today - timedelta(days=CHART_DAYS - 1), CHART_DAYS)],
        "categories": [{"category": muscle, "sets": len(rows),
                        "volume_grams": sum(_set_volume(s) for s in rows)}
                       for muscle, rows in sorted(by_category.items())],
        "calendar": [{"date": day.isoformat(), "trained": day in trained_days,
                      "sets": len(by_day.get(day, [])),
                      "volume_grams": sum(_set_volume(s) for s in by_day.get(day, []))}
                     for day in _day_labels(start, HISTORY_DAYS)],
        "streak_days": _streak(trained_days, today),
        "longest_streak_days": _longest_streak(trained_days),
        "sessions_this_week": sum(count for day, count in sessions_by_day.items() if day >= week_start),
        "history_days": HISTORY_DAYS,
        "chart_days": CHART_DAYS,
        "records": _records(owner),
    }


def one_rep_max_grams(kg_x10: int, reps: int) -> int:
    """Epley: a weight lifted for several reps, expressed as a one-rep maximum."""
    if kg_x10 <= 0 or reps <= 0:
        return 0
    return round(kg_x10 * GRAMS_PER_KG_TENTH * (1 + reps / 30))


def _records(owner) -> list[dict[str, Any]]:
    """One row per exercise with its bests. SQL can group, but the bests (a one-rep max is
    weight and reps together) need the rows themselves, so this is one ordered pass in Python."""
    best: dict[int, dict[str, Any]] = {}
    for row in (WorkoutSet.objects.for_user(owner).filter(done_at__isnull=False)
                .select_related("exercise").order_by("done_at")):
        entry = best.setdefault(row.exercise_id, {
            "exercise_id": str(row.exercise_id), "exercise_name": row.exercise.name,
            "category": row.exercise.muscle, "metric": "weight_reps", "sets_logged": 0,
            "last_performed_at": None, "best_one_rep_max_grams": 0, "best_weight_grams": 0,
            "best_reps": 0, "best_volume_grams": 0,
        })
        entry["sets_logged"] += 1
        entry["last_performed_at"] = row.done_at.isoformat()
        entry["best_one_rep_max_grams"] = max(entry["best_one_rep_max_grams"],
                                              one_rep_max_grams(row.kg_x10, row.reps))
        entry["best_weight_grams"] = max(entry["best_weight_grams"], row.kg_x10 * GRAMS_PER_KG_TENTH)
        entry["best_reps"] = max(entry["best_reps"], row.reps)
        entry["best_volume_grams"] = max(entry["best_volume_grams"], _set_volume(row))
    return sorted(best.values(), key=lambda entry: entry["exercise_name"])
