from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from django.utils import timezone

from .models import BodyEntry, Exercise, ProgressPhoto, Routine, WorkoutSession, WorkoutSet
from .units import e1rm_x10


def exercise_dict(e: Exercise) -> dict:
    return {"id": e.pk, "name": e.name, "muscle": e.muscle, "equipment": e.equipment, "custom": e.owner_id is not None}


def exercises(owner) -> list[dict]:
    return [exercise_dict(e) for e in Exercise.objects.visible_to(owner)]


def routine_dict(r: Routine) -> dict:
    return {"id": r.pk, "name": r.name, "notes": r.notes,
            "items": [{"id": i.pk, "exercise_id": i.exercise_id, "exercise": i.exercise.name,
                       "target_sets": i.target_sets, "target_reps": i.target_reps, "rest_seconds": i.rest_seconds}
                      for i in r.items.all()]}


def routines(owner) -> list[dict]:
    qs = Routine.objects.for_user(owner).prefetch_related("items__exercise")
    return [routine_dict(r) for r in qs]


def live(owner) -> WorkoutSession | None:
    return WorkoutSession.objects.filter(running_key=owner.pk).first()


def last_time(owner, exercise_ids: list[int], *, before: WorkoutSession | None = None) -> dict[int, list[dict]]:
    """For each exercise: the done sets from the most recent FINISHED session that had it. One query."""
    qs = (WorkoutSet.objects.for_user(owner)
          .filter(exercise_id__in=exercise_ids, done_at__isnull=False, session__ended_at__isnull=False)
          .select_related("session").order_by("-session__started_at", "position"))
    if before is not None:
        qs = qs.exclude(session=before)
    found: dict[int, int] = {}          # exercise_id -> session_id we picked
    out: dict[int, list[dict]] = defaultdict(list)
    for s in qs[:500]:
        picked = found.setdefault(s.exercise_id, s.session_id)
        if picked == s.session_id:
            out[s.exercise_id].append({"kg_x10": s.kg_x10, "reps": s.reps})
    return dict(out)


def best_e1rm(owner, exercise_ids: list[int], *, exclude_session=None) -> dict[int, int]:
    qs = WorkoutSet.objects.for_user(owner).filter(exercise_id__in=exercise_ids, done_at__isnull=False)
    if exclude_session is not None:
        qs = qs.exclude(session=exclude_session)
    best: dict[int, int] = {}
    for ex_id, kg, reps in qs.values_list("exercise_id", "kg_x10", "reps"):
        best[ex_id] = max(best.get(ex_id, 0), e1rm_x10(kg, reps))
    return best


def live_page(owner, session: WorkoutSession) -> dict:
    now = timezone.now()
    sets = list(session.sets.select_related("exercise"))
    ids = sorted({s.exercise_id for s in sets})
    previous = last_time(owner, ids, before=session)
    best_before = best_e1rm(owner, ids, exclude_session=session)
    groups: dict[int, dict] = {}
    for s in sets:
        g = groups.setdefault(s.exercise_id, {"exercise": exercise_dict(s.exercise), "sets": [],
                                              "last_time": previous.get(s.exercise_id, [])})
        e1 = e1rm_x10(s.kg_x10, s.reps)
        g["sets"].append({"id": s.pk, "position": s.position, "kg_x10": s.kg_x10, "reps": s.reps,
                          "rest_seconds": s.rest_seconds, "done": s.done_at is not None,
                          "pr": s.done_at is not None and e1 > best_before.get(s.exercise_id, 0) > 0})
    return {
        "session": {"id": session.pk, "name": session.name, "started_at": session.started_at.isoformat(),
                    "notes": session.notes,
                    "rest_until": session.rest_until.isoformat() if session.rest_until else None},
        "groups": list(groups.values()),
        "exercises": exercises(owner),
        "server_now": now.isoformat(),
    }


def session_summary(s: WorkoutSession) -> dict:
    sets = [x for x in s.sets.all() if x.done_at is not None]
    volume = sum(x.kg_x10 * x.reps for x in sets)  # kg×10 × reps
    names: list[str] = []
    for x in sets:
        if x.exercise.name not in names:
            names.append(x.exercise.name)
    minutes = int(((s.ended_at or timezone.now()) - s.started_at).total_seconds() // 60)
    return {"id": s.pk, "name": s.name, "date": s.local_date.isoformat(), "started_at": s.started_at.isoformat(),
            "minutes": minutes, "sets": len(sets), "volume_kg": volume // 10, "exercises": names,
            "notes": s.notes,
            "detail": [{"exercise": x.exercise.name, "kg_x10": x.kg_x10, "reps": x.reps} for x in sets]}


def history(owner):
    return (WorkoutSession.objects.for_user(owner).filter(ended_at__isnull=False)
            .prefetch_related("sets__exercise"))


def streak_weeks(owner, today: date) -> int:
    """Consecutive weeks (ending this week or last) with at least one finished session."""
    days = set(WorkoutSession.objects.for_user(owner).filter(ended_at__isnull=False,
                                                             local_date__gte=today - timedelta(weeks=52))
               .values_list("local_date", flat=True))
    weeks = {d - timedelta(days=d.weekday()) for d in days}
    monday = today - timedelta(days=today.weekday())
    if monday not in weeks:
        monday -= timedelta(weeks=1)  # this week hasn't been trained yet — don't break the streak
    count = 0
    while monday in weeks:
        count += 1
        monday -= timedelta(weeks=1)
    return count


def consistency(owner, today: date, weeks: int = 12) -> list[dict]:
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)
    trained = set(WorkoutSession.objects.for_user(owner).filter(ended_at__isnull=False, local_date__gte=start)
                  .values_list("local_date", flat=True))
    return [{"date": (start + timedelta(days=i)).isoformat(), "trained": (start + timedelta(days=i)) in trained,
             "future": (start + timedelta(days=i)) > today} for i in range(weeks * 7)]


def records(owner) -> list[dict]:
    best: dict[int, dict] = {}
    rows = (WorkoutSet.objects.for_user(owner).filter(done_at__isnull=False)
            .select_related("exercise", "session"))
    for s in rows:
        e1 = e1rm_x10(s.kg_x10, s.reps)
        cur = best.get(s.exercise_id)
        if cur is None or e1 > cur["e1rm_x10"]:
            best[s.exercise_id] = {"exercise": s.exercise.name, "e1rm_x10": e1, "kg_x10": s.kg_x10,
                                   "reps": s.reps, "date": s.session.local_date.isoformat()}
    return sorted(best.values(), key=lambda r: r["exercise"])


def body_dict(b: BodyEntry) -> dict:
    return {"id": b.pk, "date": b.date.isoformat(), "weight_g": b.weight_g, "waist_mm": b.waist_mm,
            "chest_mm": b.chest_mm, "hips_mm": b.hips_mm, "note": b.note}


def body_entries(owner, limit: int = 60) -> list[dict]:
    return [body_dict(b) for b in BodyEntry.objects.for_user(owner)[:limit]]


def photos(owner) -> list[dict]:
    return [{"id": p.pk, "date": p.date.isoformat(), "url": f"/files/photo/{p.pk}/"}
            for p in ProgressPhoto.objects.for_user(owner)[:60]]


def today_summary(owner, today: date) -> dict:
    week_start = today - timedelta(days=today.weekday())
    return {"streak_weeks": streak_weeks(owner, today),
            "this_week": WorkoutSession.objects.for_user(owner).filter(
                ended_at__isnull=False, local_date__gte=week_start).count()}
