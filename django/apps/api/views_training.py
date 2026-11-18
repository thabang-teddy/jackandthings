"""`/api/v1` training: the exercise library, routines, workouts, sets, body entries and photos.

Weights travel as grams because that is what the clients send; they are stored as tenths
of a kilogram, which is what the web UI and the database use. The conversion lives here
and in `serializers`, nowhere else.
"""
from __future__ import annotations

from django.http import FileResponse, HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.core.models import get_owned
from apps.training import services
from apps.training.models import BodyEntry, Exercise, ProgressPhoto, Routine, WorkoutSession, WorkoutSet

from . import serializers
from .http import ApiError, api_view, as_bool, as_int, collection, data, no_content, payload, required
from .serializers import GRAMS_PER_KG_TENTH
from .stats import one_rep_max_grams, workout_stats


def _visible_exercise(user, pk) -> Exercise:
    """The shared library plus the caller's own rows — anybody else's custom row is a 404."""
    exercise = Exercise.objects.visible_to(user).filter(pk=pk).first()
    if exercise is None:
        raise ApiError("Not found.", status=404)
    return exercise


def _owned_session(user, pk) -> WorkoutSession:
    return get_owned(WorkoutSession, user, pk)


# --- Exercises ----------------------------------------------------------------------------------


@api_view(["GET", "POST"])
def exercises(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        return collection(request, Exercise.objects.visible_to(request.user), serializers.exercise,
                          per_page=200)
    body = payload(request)
    row = services.create_exercise(request.user, name=str(required(body, "name"))[:80],
                                   muscle=str(body.get("category") or body.get("primary_muscle") or "full"),
                                   equipment=str(body.get("equipment") or "other"))
    return data(serializers.exercise(row), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def exercise(request: HttpRequest, pk: int) -> HttpResponse:
    row = _visible_exercise(request.user, pk)
    if request.method == "GET":
        return data(serializers.exercise(row))
    if row.owner_id != request.user.pk:
        raise ApiError("The shared exercise library is read-only.", status=403)
    if request.method == "DELETE":
        services.delete_exercise(row)
        return no_content()
    body = payload(request)
    row.name = str(body.get("name", row.name))[:80]
    row.muscle = str(body.get("category", body.get("primary_muscle", row.muscle)))
    row.equipment = str(body.get("equipment", row.equipment))
    row.full_clean()
    row.save()
    return data(serializers.exercise(row))


@api_view(["GET"])
def exercise_history(request: HttpRequest, pk: int) -> HttpResponse:
    """Every finished session that included this exercise, newest first, with its bests."""
    row = _visible_exercise(request.user, pk)
    sets = (WorkoutSet.objects.for_user(request.user)
            .filter(exercise=row, done_at__isnull=False, session__ended_at__isnull=False)
            .select_related("session").order_by("-session__started_at", "position"))

    sessions: dict[int, dict] = {}
    best = {"best_one_rep_max_grams": 0, "best_weight_grams": 0, "best_reps": 0, "best_volume_grams": 0}
    for item in sets:
        bucket = sessions.setdefault(item.session_id, {
            "session_id": str(item.session_id),
            "performed_at": serializers.iso(item.session.started_at),
            "routine_name": item.session.name,
            "sets": [],
        })
        grams = item.kg_x10 * GRAMS_PER_KG_TENTH
        bucket["sets"].append({"id": str(item.pk), "position": item.position, "reps": item.reps,
                               "weight_grams": grams,
                               "one_rep_max_grams": one_rep_max_grams(item.kg_x10, item.reps)})
        best["best_one_rep_max_grams"] = max(best["best_one_rep_max_grams"],
                                             one_rep_max_grams(item.kg_x10, item.reps))
        best["best_weight_grams"] = max(best["best_weight_grams"], grams)
        best["best_reps"] = max(best["best_reps"], item.reps)
        best["best_volume_grams"] = max(best["best_volume_grams"], grams * item.reps)

    return data({"exercise_id": str(row.pk), "metric": "weight_reps",
                 "sessions": list(sessions.values()), "best": best})


# --- Routines -----------------------------------------------------------------------------------


def _routine_items(body: dict) -> list[dict]:
    return [{"exercise_id": item.get("exercise_id"),
             "target_sets": item.get("target_sets", 3),
             "target_reps": item.get("target_reps", 8),
             "rest_seconds": item.get("rest_seconds", 90)}
            for item in body.get("items") or []]


@api_view(["GET", "POST"])
def routines(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = Routine.objects.for_user(request.user).prefetch_related("items__exercise")
        return collection(request, rows, serializers.routine)
    body = payload(request)
    row = services.save_routine(request.user, name=str(required(body, "name"))[:60],
                                notes=str(body.get("notes") or ""), items=_routine_items(body))
    return data(serializers.routine(row), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def routine(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Routine, request.user, pk)
    if request.method == "GET":
        return data(serializers.routine(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    items = _routine_items(body) or [
        {"exercise_id": item.exercise_id, "target_sets": item.target_sets,
         "target_reps": item.target_reps, "rest_seconds": item.rest_seconds}
        for item in row.items.all()]
    updated = services.save_routine(request.user, name=str(body.get("name", row.name))[:60],
                                    notes=str(body.get("notes", row.notes) or ""), items=items, routine=row)
    return data(serializers.routine(updated))


# --- Workout sessions -----------------------------------------------------------------------------


@api_view(["GET", "POST"])
def workout_sessions(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = WorkoutSession.objects.for_user(request.user).prefetch_related("sets__exercise")
        return collection(request, rows, serializers.workout_session)
    body = payload(request)
    routine_row = (get_owned(Routine, request.user, body["workout_routine_id"])
                   if body.get("workout_routine_id") else None)
    session = services.start_session(request.user, routine_row)
    return data(serializers.workout_session(session), status=201)


@api_view(["GET"])
def current_workout(request: HttpRequest) -> HttpResponse:
    """The workout that is running now, or `data: null` when nothing is."""
    row = WorkoutSession.objects.filter(running_key=request.user.pk).prefetch_related("sets__exercise").first()
    return data(serializers.workout_session(row) if row else None)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def workout_session(request: HttpRequest, pk: int) -> HttpResponse:
    row = _owned_session(request.user, pk)
    if request.method == "GET":
        return data(serializers.workout_session(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    row.notes = str(body.get("notes", row.notes) or "")
    row.save(update_fields=["notes", "updated_at"])
    return data(serializers.workout_session(row))


@api_view(["POST"])
def finish_workout(request: HttpRequest, pk: int) -> HttpResponse:
    row = _owned_session(request.user, pk)
    services.finish_session(row, notes=str(payload(request).get("notes") or row.notes or ""))
    row.refresh_from_db()
    return data(serializers.workout_session(row))


# --- Sets ------------------------------------------------------------------------------------------


@api_view(["GET", "POST"])
def session_sets(request: HttpRequest, pk: int) -> HttpResponse:
    session = _owned_session(request.user, pk)
    if request.method == "GET":
        rows = session.sets.select_related("exercise")
        return collection(request, list(rows), serializers.workout_set, per_page=200)

    body = payload(request)
    exercise_row = _visible_exercise(request.user, required(body, "exercise_id"))
    row = services.add_set(request.user, session, exercise_row)
    kg_x10, reps = _set_values(body, row)
    row = services.update_set(row, kg_x10=kg_x10, reps=reps, done=True)
    return data({**serializers.workout_set(row), "is_record": _is_record(request.user, row)}, status=201)


def _set_values(body: dict, row: WorkoutSet) -> tuple[int, int]:
    grams = as_int(body, "weight_grams", row.kg_x10 * GRAMS_PER_KG_TENTH) or 0
    reps = as_int(body, "reps", row.reps) or 0
    return max(0, round(grams / GRAMS_PER_KG_TENTH)), max(0, reps)


def _is_record(owner, row: WorkoutSet) -> bool:
    """True when this set beats every earlier one-rep max for the exercise."""
    this = one_rep_max_grams(row.kg_x10, row.reps)
    if this <= 0:
        return False
    earlier = (WorkoutSet.objects.for_user(owner)
               .filter(exercise_id=row.exercise_id, done_at__isnull=False).exclude(pk=row.pk))
    return all(one_rep_max_grams(other.kg_x10, other.reps) < this for other in earlier)


@api_view(["PUT", "PATCH", "DELETE"])
def workout_set(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(WorkoutSet, request.user, pk)
    if request.method == "DELETE":
        services.delete_set(row)
        return no_content()
    body = payload(request)
    kg_x10, reps = _set_values(body, row)
    done = as_bool(body, "completed", row.done_at is not None)
    row = services.update_set(row, kg_x10=kg_x10, reps=reps, done=done)
    return data({**serializers.workout_set(row), "is_record": _is_record(request.user, row)})


# --- Body entries and photos --------------------------------------------------------------------


@api_view(["GET", "POST"])
def body_metrics(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        return collection(request, BodyEntry.objects.for_user(request.user), serializers.body_metric)
    body = payload(request)
    measured = parse_date(str(required(body, "measured_on")))
    if measured is None:
        raise ApiError("The given data was invalid.", errors={"measured_on": ["Send a date as YYYY-MM-DD."]})
    sizes = body.get("measurements") or {}
    row = services.save_body_entry(request.user, {
        "date": measured,
        "weight_g": as_int(body, "weight_grams"),
        "waist_mm": _mm(sizes.get("waist")),
        "chest_mm": _mm(sizes.get("chest")),
        "hips_mm": _mm(sizes.get("hips")),
        "note": str(body.get("notes") or "")[:200],
    })
    return data(serializers.body_metric(row), status=201)


def _mm(centimetres) -> int | None:
    """The clients send whole centimetres; the column is millimetres."""
    if centimetres in (None, ""):
        return None
    return int(centimetres) * 10


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def body_metric(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(BodyEntry, request.user, pk)
    if request.method == "DELETE":
        row.delete()
        return no_content()
    if request.method == "GET":
        return data(serializers.body_metric(row, photos=_photos_on(request.user, row.date)))
    body = payload(request)
    sizes = body.get("measurements") or {}
    updated = services.save_body_entry(request.user, {
        "date": row.date,
        "weight_g": as_int(body, "weight_grams", row.weight_g),
        "waist_mm": _mm(sizes.get("waist")) if "waist" in sizes else row.waist_mm,
        "chest_mm": _mm(sizes.get("chest")) if "chest" in sizes else row.chest_mm,
        "hips_mm": _mm(sizes.get("hips")) if "hips" in sizes else row.hips_mm,
        "note": str(body.get("notes", row.note) or "")[:200],
    })
    return data(serializers.body_metric(updated))


def _photos_on(owner, day) -> list[ProgressPhoto]:
    return list(ProgressPhoto.objects.for_user(owner).filter(date=day))


@api_view(["GET", "POST"])
def progress_photos(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        return collection(request, ProgressPhoto.objects.for_user(request.user), serializers.progress_photo)
    upload = request.FILES.get("file") or request.FILES.get("photo")
    if upload is None:
        raise ApiError("The given data was invalid.", errors={"file": ["Attach an image."]})
    taken = parse_date(str(request.POST.get("taken_on") or "")) or timezone.localdate()
    row = services.add_photo(request.user, upload=upload, date=taken)
    return data(serializers.progress_photo(row), status=201)


@api_view(["GET", "DELETE"])
def progress_photo(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(ProgressPhoto, request.user, pk)
    if request.method == "DELETE":
        services.delete_photo(row)
        return no_content()
    return data(serializers.progress_photo(row))


@api_view(["GET"])
def progress_photo_file(request: HttpRequest, pk: int) -> HttpResponse:
    """The only route to a stored photo, and it authorizes before it opens the file."""
    row = get_owned(ProgressPhoto, request.user, pk)
    return FileResponse(row.file.open("rb"), content_type=row.content_type)


@api_view(["GET"])
def stats(request: HttpRequest) -> HttpResponse:
    return data(workout_stats(request.user, timezone_name=request.GET.get("tz")))
