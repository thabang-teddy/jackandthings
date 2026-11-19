from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.errors import DomainError
from apps.core.http import int_param, page_of, payload, see_other
from apps.core.inertia import form_errors
from apps.core.models import get_owned

from . import selectors, services
from .forms import PresetForm, StartForm
from .models import Preset, Session


def _timer_props(request, errors: dict | None = None) -> dict:
    now = timezone.now()
    services.ensure_default_preset(request.user)
    running = selectors.running(request.user)
    props = {
        "presets": selectors.presets(request.user),
        "running": selectors.session_dict(running, now) if running else None,
        "next": None,
        "server_now": now.isoformat(),
        "today_minutes": selectors.today_minutes(request.user),
    }
    if running:
        phase, cycle = services.next_phase(running)
        props["next"] = {"phase": phase, "cycle_index": cycle}
    else:  # just finished one? offer the next phase (used when auto-start is off)
        last = Session.objects.for_user(request.user).filter(running_key__isnull=True, ended_at__isnull=False).first()
        if last and last.preset and (now - last.ended_at).total_seconds() < 30 * 60:
            phase, cycle = services.next_phase(last)
            props["next"] = {"phase": phase, "cycle_index": cycle}
    if errors:
        props["errors"] = errors
    return props


@login_required
@require_GET
def timer(request):
    return inertia_render(request, "Focus/Timer", props=_timer_props(request))


def _locked_running(request) -> Session | None:
    return Session.objects.select_for_update().filter(running_key=request.user.pk).first()


@login_required
@require_POST
def start(request):
    form = StartForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Focus/Timer", props=_timer_props(request, form_errors(form)))
    preset = get_owned(Preset, request.user, form.cleaned_data["preset_id"])
    try:
        services.start(request.user, preset, tag=form.cleaned_data["tag"].strip())
    except DomainError as exc:
        return inertia_render(request, "Focus/Timer", props=_timer_props(request, {exc.field: exc.message}))
    return see_other("focus:timer")


def _act(request, action):
    with transaction.atomic():
        s = _locked_running(request)
        if s is not None:
            action(s)
    return see_other("focus:timer")


@login_required
@require_POST
def pause(request):
    return _act(request, services.pause)


@login_required
@require_POST
def resume(request):
    return _act(request, services.resume)


@login_required
@require_POST
def stop(request):
    return _act(request, lambda s: services.finish(s, completed=False))


@login_required
@require_POST
def skip(request):
    return _act(request, services.skip)


@login_required
@require_POST
def start_next(request):
    """Start the phase after the last finished session (when auto-start is off)."""
    last = Session.objects.for_user(request.user).filter(running_key__isnull=True).first()
    if last is None or last.preset is None:
        return see_other("focus:timer")
    phase, cycle = services.next_phase(last)
    try:
        services.start(request.user, last.preset, phase=phase, tag=last.tag, cycle_index=cycle)
    except DomainError as exc:
        messages.error(request, exc.message)
    return see_other("focus:timer")


# --- Presets ---------------------------------------------------------------------------------


@login_required
@require_http_methods(["GET", "POST"])
def presets(request):
    services.ensure_default_preset(request.user)
    if request.method == "POST":
        form = PresetForm(payload(request))
        if form.is_valid():
            try:
                services.save_preset(request.user, form.cleaned_data)
            except DomainError as exc:
                return inertia_render(request, "Focus/Presets", props={
                    "presets": selectors.presets(request.user), "errors": {exc.field: exc.message}})
            messages.success(request, "Preset saved")
            return see_other("focus:presets")
        return inertia_render(request, "Focus/Presets", props={
            "presets": selectors.presets(request.user), "errors": form_errors(form)})
    return inertia_render(request, "Focus/Presets", props={"presets": selectors.presets(request.user)})


@login_required
@require_http_methods(["PUT", "DELETE"])
def preset_detail(request, pk: int):
    preset = get_owned(Preset, request.user, pk)
    try:
        if request.method == "DELETE":
            services.delete_preset(preset)
            messages.success(request, "Preset deleted")
            return see_other("focus:presets")
        form = PresetForm(payload(request), instance=preset)
        if not form.is_valid():
            return inertia_render(request, "Focus/Presets", props={
                "presets": selectors.presets(request.user), "errors": form_errors(form), "editing": pk})
        services.save_preset(request.user, form.cleaned_data, preset)
    except DomainError as exc:
        return inertia_render(request, "Focus/Presets", props={
            "presets": selectors.presets(request.user), "errors": {exc.field: exc.message}, "editing": pk})
    messages.success(request, "Preset saved")
    return see_other("focus:presets")


# --- History and stats -----------------------------------------------------------------------


@login_required
@require_GET
def sessions(request):
    data = page_of(request, selectors.history(request.user), selectors.history_row, per_page=30)
    return inertia_render(request, "Focus/Sessions", props=data)


@login_required
@require_http_methods(["DELETE"])
def session_detail(request, pk: int):
    s = get_owned(Session, request.user, pk)
    if s.running_key is not None:
        messages.error(request, "Stop the session before deleting it.")
    else:
        s.delete()
        messages.success(request, "Session deleted")
    return see_other("focus:sessions")


@login_required
@require_GET
def stats(request):
    days = 30 if int_param(request, "days", 7) == 30 else 7
    return inertia_render(request, "Focus/Stats", props=selectors.stats(request.user, days=days))
