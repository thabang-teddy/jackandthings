from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.errors import DomainError
from apps.core.http import page_of, payload, see_other
from apps.core.inertia import form_errors
from apps.core.models import get_owned

from . import selectors, services
from .forms import BodyForm, ExerciseForm, PhotoForm, RoutineForm, SetForm
from .models import Exercise, ProgressPhoto, Routine, WorkoutSession, WorkoutSet


def _visible_exercise(request, pk) -> Exercise:
    try:
        return Exercise.objects.visible_to(request.user).get(pk=pk)
    except (Exercise.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _live_or_404(request) -> WorkoutSession:
    session = selectors.live(request.user)
    if session is None:
        raise Http404
    return session


# --- Today -----------------------------------------------------------------------------------


@login_required
@require_GET
def index(request):
    today = timezone.localdate()
    live = selectors.live(request.user)
    recent = [selectors.session_summary(s) for s in selectors.history(request.user)[:3]]
    return inertia_render(request, "Training/Index", props={
        "live": None if live is None else {"id": live.pk, "name": live.name, "started_at": live.started_at.isoformat()},
        "routines": selectors.routines(request.user),
        "recent": recent,
        **selectors.today_summary(request.user, today),
        "consistency": selectors.consistency(request.user, today, weeks=6),
    })


@login_required
@require_POST
def start(request):
    routine_id = payload(request).get("routine_id")
    routine = get_owned(Routine, request.user, routine_id) if routine_id else None
    try:
        services.start_session(request.user, routine)
    except DomainError as exc:
        messages.error(request, exc.message)
    return see_other("training:live")


# --- Live session ----------------------------------------------------------------------------


@login_required
@require_GET
def live(request):
    session = selectors.live(request.user)
    if session is None:
        return see_other("training:index")
    return inertia_render(request, "Training/Live", props=selectors.live_page(request.user, session))


@login_required
@require_POST
def live_add_set(request):
    session = _live_or_404(request)
    exercise = _visible_exercise(request, payload(request).get("exercise_id"))
    services.add_set(request.user, session, exercise)
    return see_other("training:live")


@login_required
@require_http_methods(["PUT", "DELETE"])
def live_set(request, pk: int):
    s = get_owned(WorkoutSet, request.user, pk)
    try:
        if request.method == "DELETE":
            services.delete_set(s)
        else:
            form = SetForm(payload(request))
            if not form.is_valid():
                return inertia_render(request, "Training/Live", props={
                    **selectors.live_page(request.user, s.session), "errors": form_errors(form), "editing": pk})
            d = form.cleaned_data
            services.update_set(s, kg_x10=d["kg"] or 0, reps=d["reps"], done=d["done"])
    except DomainError as exc:
        messages.error(request, exc.message)
    return see_other("training:live")


@login_required
@require_POST
def live_skip_rest(request):
    services.skip_rest(_live_or_404(request))
    return see_other("training:live")


@login_required
@require_POST
def live_finish(request):
    session = _live_or_404(request)
    try:
        kept = services.finish_session(session, notes=str(payload(request).get("notes", ""))[:2000])
    except DomainError as exc:
        messages.error(request, exc.message)
        return see_other("training:live")
    messages.success(request, f"Workout saved — {kept} sets")
    return see_other("training:sessions")


@login_required
@require_POST
def live_discard(request):
    with transaction.atomic():
        session = _live_or_404(request)
        session.delete()
    messages.success(request, "Workout discarded")
    return see_other("training:index")


# --- Library ---------------------------------------------------------------------------------


def _exercise_props(request, errors=None) -> dict:
    props = {"exercises": selectors.exercises(request.user),
             "muscles": [{"value": v, "label": label} for v, label in Exercise.Muscle.choices],
             "equipment": [{"value": v, "label": label} for v, label in Exercise.Equipment.choices]}
    return {**props, "errors": errors} if errors else props


@login_required
@require_http_methods(["GET", "POST"])
def exercises(request):
    if request.method == "POST":
        form = ExerciseForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Training/Exercises", props=_exercise_props(request, form_errors(form)))
        try:
            services.create_exercise(request.user, **form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Training/Exercises",
                                  props=_exercise_props(request, {exc.field: exc.message}))
        messages.success(request, "Exercise added")
        return see_other("training:exercises")
    return inertia_render(request, "Training/Exercises", props=_exercise_props(request))


@login_required
@require_http_methods(["DELETE"])
def exercise_detail(request, pk: int):
    # Only custom exercises can be deleted: filter by owner, so library rows are "not found".
    try:
        exercise = Exercise.objects.get(pk=pk, owner=request.user)
    except Exercise.DoesNotExist as exc:
        raise Http404 from exc
    try:
        services.delete_exercise(exercise)
    except DomainError as exc:
        messages.error(request, exc.message)
    else:
        messages.success(request, "Exercise deleted")
    return see_other("training:exercises")


# --- Routines --------------------------------------------------------------------------------


@login_required
@require_http_methods(["GET", "POST"])
def routines(request):
    if request.method == "POST":
        form = RoutineForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Training/RoutineEdit", props={
                "routine": None, "exercises": selectors.exercises(request.user), "errors": form_errors(form)})
        try:
            routine = services.save_routine(request.user, **form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Training/RoutineEdit", props={
                "routine": None, "exercises": selectors.exercises(request.user), "errors": {exc.field: exc.message}})
        messages.success(request, "Routine saved")
        return see_other("training:routine", pk=routine.pk)
    return inertia_render(request, "Training/Routines", props={"routines": selectors.routines(request.user)})


@login_required
@require_GET
def routine_new(request):
    return inertia_render(request, "Training/RoutineEdit",
                          props={"routine": None, "exercises": selectors.exercises(request.user)})


@login_required
@require_http_methods(["GET", "PUT", "DELETE"])
def routine_detail(request, pk: int):
    routine = get_owned(Routine, request.user, pk)
    if request.method == "DELETE":
        routine.delete()  # past sessions keep their sets: the routine FK is SET_NULL
        messages.success(request, "Routine deleted")
        return see_other("training:routines")
    if request.method == "PUT":
        form = RoutineForm(payload(request))
        errors = None
        if form.is_valid():
            try:
                services.save_routine(request.user, routine=routine, **form.cleaned_data)
            except DomainError as exc:
                errors = {exc.field: exc.message}
        else:
            errors = form_errors(form)
        if errors is None:
            messages.success(request, "Routine saved")
            return see_other("training:routine", pk=pk)
        return inertia_render(request, "Training/RoutineEdit", props={
            "routine": selectors.routine_dict(routine), "exercises": selectors.exercises(request.user),
            "errors": errors})
    return inertia_render(request, "Training/RoutineEdit", props={
        "routine": selectors.routine_dict(routine), "exercises": selectors.exercises(request.user)})


# --- History, body, stats --------------------------------------------------------------------


@login_required
@require_GET
def sessions(request):
    return inertia_render(request, "Training/Sessions",
                          props=page_of(request, selectors.history(request.user), selectors.session_summary, 20))


@login_required
@require_http_methods(["DELETE"])
def session_detail(request, pk: int):
    session = get_owned(WorkoutSession, request.user, pk)
    session.delete()
    messages.success(request, "Workout deleted")
    return see_other("training:sessions")


def _body_props(request, errors=None) -> dict:
    props = {"entries": selectors.body_entries(request.user), "photo_count":
             ProgressPhoto.objects.for_user(request.user).count(), "today": timezone.localdate().isoformat()}
    return {**props, "errors": errors} if errors else props


@login_required
@require_http_methods(["GET", "POST"])
def body(request):
    if request.method == "POST":
        form = BodyForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Training/Body", props=_body_props(request, form_errors(form)))
        services.save_body_entry(request.user, form.model_values())
        messages.success(request, "Measurements saved")
        return see_other("training:body")
    return inertia_render(request, "Training/Body", props=_body_props(request))


@login_required
@require_http_methods(["DELETE"])
def body_detail(request, pk: int):
    from .models import BodyEntry

    get_owned(BodyEntry, request.user, pk).delete()
    messages.success(request, "Entry deleted")
    return see_other("training:body")


@login_required
@require_GET
def photos(request):
    """Fetched only after the user presses "Show photos" (a partial reload of the Body page)."""
    return inertia_render(request, "Training/Body", props={**_body_props(request), "photos": selectors.photos(request.user)})


@login_required
@require_POST  # multipart
def photo_upload(request):
    form = PhotoForm(request.POST, request.FILES)
    if not form.is_valid():
        messages.error(request, next(iter(form_errors(form).values())))
        return see_other("training:body")
    try:
        services.add_photo(request.user, upload=form.cleaned_data["photo"], date=form.cleaned_data["date"])
    except ValidationError as exc:
        messages.error(request, exc.messages[0])
    else:
        messages.success(request, "Photo saved privately")
    return see_other("training:body")


@login_required
@require_http_methods(["DELETE"])
def photo_detail(request, pk: int):
    services.delete_photo(get_owned(ProgressPhoto, request.user, pk))
    messages.success(request, "Photo deleted")
    return see_other("training:photos")


@login_required
@require_GET
def stats(request):
    today = timezone.localdate()
    return inertia_render(request, "Training/Stats", props={
        "records": selectors.records(request.user),
        "consistency": selectors.consistency(request.user, today, weeks=12),
        **selectors.today_summary(request.user, today),
    })
