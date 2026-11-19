"""`/api/v1/pomodoro-*` — presets, logged intervals, and the stats block the phone draws.

A client here logs an interval that has already happened (it ran the countdown itself),
which is why POST takes `started_at`, `ended_at` and `duration_seconds` rather than
driving the server-side timer the website uses.
"""
from __future__ import annotations

from datetime import timedelta

from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.core.models import get_owned
from apps.focus import services
from apps.focus.models import Preset, Session

from . import serializers
from .http import ApiError, api_view, as_bool, as_int, collection, data, no_content, payload, required
from .stats import focus_stats

PHASES = {Session.Phase.FOCUS, Session.Phase.SHORT, Session.Phase.LONG}


def _preset_fields(body: dict, current: Preset | None = None) -> dict:
    base = current or Preset()
    breaks = as_bool(body, "auto_start_breaks", base.auto_start in serializers.AUTO_START_BREAKS)
    focus = as_bool(body, "auto_start_focus", base.auto_start in serializers.AUTO_START_FOCUS)
    return {
        "name": str(body.get("name", base.name) or "")[:60],
        "focus_min": as_int(body, "focus_minutes", base.focus_min or 25),
        "short_min": as_int(body, "break_minutes", base.short_min or 5),
        "long_min": as_int(body, "long_break_minutes", base.long_min or 15),
        "long_every": as_int(body, "cycles_before_long_break", base.long_every or 4),
        "auto_start": serializers.auto_start_value(breaks=breaks, focus=focus),
        "sound": str(body.get("alarm_sound", base.sound) or "bell")[:20],
        "strict": as_bool(body, "strict_mode", base.strict),
        "is_default": as_bool(body, "is_default", base.is_default),
    }


@api_view(["GET", "POST"])
def presets(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = Preset.objects.for_user(request.user).order_by("-is_default", "name")
        return collection(request, rows, serializers.preset)
    body = payload(request)
    required(body, "name")
    preset = services.save_preset(request.user, _preset_fields(body))
    return data(serializers.preset(preset), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def preset(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Preset, request.user, pk)
    if request.method == "GET":
        return data(serializers.preset(row))
    if request.method == "DELETE":
        services.delete_preset(row)
        return no_content()
    updated = services.save_preset(request.user, _preset_fields(payload(request), row), row)
    return data(serializers.preset(updated))


@api_view(["GET", "POST"])
def sessions(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = Session.objects.for_user(request.user).filter(running_key__isnull=True).select_related("preset")
        return collection(request, rows, serializers.focus_session)

    body = payload(request)
    phase = str(body.get("phase") or Session.Phase.FOCUS)
    if phase not in PHASES:
        raise ApiError("The given data was invalid.",
                       errors={"phase": [f"Use one of: {', '.join(sorted(PHASES))}."]})
    started = parse_datetime(str(required(body, "started_at")))
    if started is None or started.tzinfo is None:
        raise ApiError("The given data was invalid.",
                       errors={"started_at": ["Send an ISO 8601 timestamp with a time zone."]})
    seconds = as_int(body, "duration_seconds", 0) or 0
    ended_raw = body.get("ended_at")
    ended = parse_datetime(str(ended_raw)) if ended_raw else started + timedelta(seconds=seconds)

    preset_row = None
    if body.get("pomodoro_preset_id"):
        preset_row = get_owned(Preset, request.user, body["pomodoro_preset_id"])

    row = Session.objects.create(
        owner=request.user, preset=preset_row, phase=phase, tag=str(body.get("tag") or "")[:40],
        started_at=started, local_date=timezone.localtime(started).date(),
        planned_seconds=max(0, seconds), ended_at=ended,
        completed=as_bool(body, "completed", True),
    )
    return data(serializers.focus_session(row), status=201)


@api_view(["GET", "DELETE"])
def session(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Session, request.user, pk)
    if request.method == "DELETE":
        row.delete()
        return no_content()
    return data(serializers.focus_session(row))


@api_view(["GET"])
def stats(request: HttpRequest) -> HttpResponse:
    return data(focus_stats(request.user, timezone_name=request.GET.get("tz")))
