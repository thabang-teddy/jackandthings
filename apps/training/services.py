from __future__ import annotations

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.core.errors import DomainError
from apps.core.files import clean_private_image, delete_file

from .models import BodyEntry, Exercise, ProgressPhoto, Routine, RoutineItem, WorkoutSession, WorkoutSet
from .selectors import last_time

DEFAULT_REST = 90


# --- Exercises and routines ------------------------------------------------------------------


def create_exercise(owner, *, name: str, muscle: str, equipment: str) -> Exercise:
    name = name.strip()
    if Exercise.objects.visible_to(owner).filter(name__iexact=name).exists():
        raise DomainError("That exercise is already in your library.", field="name")
    return Exercise.objects.create(owner=owner, name=name, muscle=muscle, equipment=equipment)


def delete_exercise(exercise: Exercise) -> None:
    if (RoutineItem.objects.filter(exercise=exercise).exists()
            or WorkoutSet.objects.filter(exercise=exercise).exists()):
        raise DomainError("This exercise is used in a routine or a logged session, so it can't be deleted.")
    exercise.delete()


@transaction.atomic
def save_routine(owner, *, name: str, notes: str, items: list[dict], routine: Routine | None = None) -> Routine:
    """Create or update a routine and REPLACE its items in the given order.

    items: [{"exercise_id": 3, "target_sets": 3, "target_reps": 8, "rest_seconds": 90}, ...]
    """
    name = name.strip()
    clash = Routine.objects.for_user(owner).filter(name__iexact=name)
    if routine is not None:
        clash = clash.exclude(pk=routine.pk)
    if clash.exists():
        raise DomainError("You already have a routine with that name.", field="name")
    allowed = set(Exercise.objects.visible_to(owner).values_list("pk", flat=True))
    cleaned = []
    for i, item in enumerate(items):
        try:
            ex_id = int(item["exercise_id"])
            sets = max(1, min(10, int(item.get("target_sets", 3))))
            reps = max(1, min(50, int(item.get("target_reps", 8))))
            rest = max(0, min(600, int(item.get("rest_seconds", DEFAULT_REST))))
        except (KeyError, TypeError, ValueError) as exc:
            raise DomainError(f"Row {i + 1} isn't complete.", field="items") from exc
        if ex_id not in allowed:  # isolation: someone else's custom exercise is "not found"
            raise DomainError(f"Row {i + 1}: pick an exercise from your library.", field="items")
        cleaned.append((ex_id, sets, reps, rest))
    if not cleaned:
        raise DomainError("Add at least one exercise.", field="items")
    routine = routine or Routine(owner=owner)
    routine.name, routine.notes = name, notes
    routine.save()
    routine.items.all().delete()
    RoutineItem.objects.bulk_create([
        RoutineItem(owner=owner, routine=routine, exercise_id=ex, position=i, target_sets=s, target_reps=r,
                    rest_seconds=rest)
        for i, (ex, s, r, rest) in enumerate(cleaned)])
    return routine


# --- The live session ------------------------------------------------------------------------


@transaction.atomic
def start_session(owner, routine: Routine | None = None, *, now: datetime | None = None) -> WorkoutSession:
    now = now or timezone.now()
    if WorkoutSession.objects.filter(running_key=owner.pk).exists():
        raise DomainError("A workout is already in progress.")
    try:
        session = WorkoutSession.objects.create(
            owner=owner, routine=routine, name=routine.name if routine else "Workout",
            started_at=now, local_date=timezone.localdate(now), running_key=owner.pk)
    except IntegrityError as exc:
        raise DomainError("A workout is already in progress.") from exc
    if routine is not None:
        items = list(routine.items.all())
        previous = last_time(owner, [i.exercise_id for i in items])
        sets, pos = [], 0
        for item in items:
            prev = previous.get(item.exercise_id, [])
            for n in range(item.target_sets):
                guess = prev[n] if n < len(prev) else (prev[-1] if prev else {"kg_x10": 0, "reps": item.target_reps})
                sets.append(WorkoutSet(owner=owner, session=session, exercise_id=item.exercise_id, position=pos,
                                       kg_x10=guess["kg_x10"], reps=guess["reps"], rest_seconds=item.rest_seconds))
                pos += 1
        WorkoutSet.objects.bulk_create(sets)
    return session


def add_set(owner, session: WorkoutSession, exercise: Exercise) -> WorkoutSet:
    """Append a set, pre-filled from this session's last set of the exercise, else from last time."""
    if session.ended_at is not None:
        raise DomainError("This workout is finished.")
    last_here = session.sets.filter(exercise=exercise).order_by("-position").first()
    if last_here:
        kg, reps, rest = last_here.kg_x10, last_here.reps, last_here.rest_seconds
    else:
        prev = last_time(owner, [exercise.pk]).get(exercise.pk, [])
        kg, reps, rest = (prev[0]["kg_x10"], prev[0]["reps"], DEFAULT_REST) if prev else (0, 8, DEFAULT_REST)
    top = session.sets.order_by("-position").first()
    position = (top.position + 1) if top else 0
    if last_here:  # keep an exercise's sets together: insert right after its last set
        position = last_here.position + 1
        session.sets.filter(position__gte=position).update(position=F("position") + 1)
    return WorkoutSet.objects.create(owner=owner, session=session, exercise=exercise, position=position,
                                     kg_x10=kg, reps=reps, rest_seconds=rest)


def update_set(s: WorkoutSet, *, kg_x10: int, reps: int, done: bool, now: datetime | None = None) -> WorkoutSet:
    now = now or timezone.now()
    if s.session.ended_at is not None:
        raise DomainError("This workout is finished.")
    was_done = s.done_at is not None
    s.kg_x10, s.reps = kg_x10, reps
    s.done_at = (s.done_at or now) if done else None
    s.save(update_fields=["kg_x10", "reps", "done_at", "updated_at"])
    if done and not was_done and s.rest_seconds:
        session = s.session
        session.rest_until = now + timedelta(seconds=s.rest_seconds)
        session.save(update_fields=["rest_until", "updated_at"])
    return s


def skip_rest(session: WorkoutSession) -> None:
    session.rest_until = None
    session.save(update_fields=["rest_until", "updated_at"])


def delete_set(s: WorkoutSet) -> None:
    if s.session.ended_at is not None:
        raise DomainError("This workout is finished.")
    s.delete()


@transaction.atomic
def finish_session(session: WorkoutSession, *, notes: str = "", now: datetime | None = None) -> int:
    """End the workout. Sets never ticked off are removed. Returns the number of sets kept."""
    session.sets.filter(done_at__isnull=True).delete()
    kept = session.sets.count()
    if kept == 0:
        raise DomainError("Tick off at least one set, or discard the workout.")
    session.ended_at, session.running_key, session.rest_until = now or timezone.now(), None, None
    session.notes = notes
    session.save(update_fields=["ended_at", "running_key", "rest_until", "notes", "updated_at"])
    return kept


# --- Body and photos -------------------------------------------------------------------------


def save_body_entry(owner, data: dict) -> BodyEntry:
    entry, _ = BodyEntry.objects.update_or_create(owner=owner, date=data["date"], defaults={
        k: data.get(k) for k in ("weight_g", "waist_mm", "chest_mm", "hips_mm")} | {"note": data.get("note", "")})
    return entry


def add_photo(owner, *, upload, date) -> ProgressPhoto:
    content, content_type = clean_private_image(upload)
    photo = ProgressPhoto(owner=owner, date=date, content_type=content_type)
    photo.file.save(content.name, content, save=False)
    photo.save()
    return photo


@transaction.atomic
def delete_photo(photo: ProgressPhoto) -> None:
    f = photo.file
    photo.delete()
    transaction.on_commit(lambda: delete_file(f))
