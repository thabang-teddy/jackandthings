import csv
from datetime import date

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.dates import iso_week, parse_date, parse_iso_week, week_start
from apps.core.errors import DomainError
from apps.core.http import back, int_param, payload, see_other
from apps.core.inertia import form_errors
from apps.core.models import get_owned

from . import selectors, services
from .forms import CardCreateForm, CardForm, ColumnForm, EntryForm, MoveForm, NoteForm, ProjectForm
from .models import Card, CardNote, Column, Project, TimeEntry


def _flash_stopped(request, stopped) -> None:
    if stopped is not None:
        messages.info(request, f"Stopped the timer on {stopped.card.title}")


def _error_back(request, exc: DomainError, fallback: str):
    messages.error(request, exc.message)
    return back(request, fallback)


# --- Projects and boards ---------------------------------------------------------------------


def _all_props(request, errors: dict | None = None) -> dict:
    # Inertia sends arrays as p[]=1&p[]=2; a hand-typed URL may use p=1&p=2. Accept both.
    project_ids = [int(x) for x in request.GET.getlist("p") + request.GET.getlist("p[]") if x.isdigit()]
    props = {
        "projects": selectors.project_list(request.user, include_archived=request.GET.get("archived") == "1"),
        "columns": selectors.all_board(request.user, selectors.running_card_id(request.user), project_ids),
        "columns_by_project": selectors.columns_by_project(request.user),
        "filter": project_ids,
    }
    if errors:
        props["errors"] = errors
    return props


@login_required
@require_http_methods(["GET", "POST"])
def index(request):
    """GET: all-projects board. POST: create a project."""
    if request.method == "POST":
        form = ProjectForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Projects/Boards", props=_all_props(request, form_errors(form)))
        d = form.cleaned_data
        try:
            project = services.create_project(request.user, name=d["name"], colour=d["colour"],
                                              due_date=d["due_date"])
        except DomainError as exc:
            return inertia_render(request, "Projects/Boards", props=_all_props(request, {exc.field: exc.message}))
        messages.success(request, f"Created {project.name}")
        return see_other("projects:board", pk=project.pk)
    return inertia_render(request, "Projects/Boards", props=_all_props(request))


def _board_props(request, project: Project, errors: dict | None = None) -> dict:
    props = {
        "project": selectors.project_dict(project),
        "columns": selectors.project_board(request.user, project, selectors.running_card_id(request.user)),
        "projects": selectors.project_list(request.user),
    }
    if errors:
        props["errors"] = errors
    return props


@login_required
@require_http_methods(["GET", "PUT", "DELETE"])
def board(request, pk: int):
    project = get_owned(Project, request.user, pk)
    if request.method == "PUT":
        form = ProjectForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Projects/Board", props=_board_props(request, project, form_errors(form)))
        try:
            services.update_project(project, **form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Projects/Board",
                                  props=_board_props(request, project, {exc.field: exc.message}))
        messages.success(request, "Project saved")
        return see_other("projects:board", pk=pk)
    if request.method == "DELETE":
        name = project.name
        services.delete_project(project)
        messages.success(request, f"Deleted {name}")
        return see_other("projects:index")
    return inertia_render(request, "Projects/Board", props=_board_props(request, project))


@login_required
@require_POST
def card_create(request, pk: int):
    project = get_owned(Project, request.user, pk)
    form = CardCreateForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Projects/Board", props=_board_props(request, project, form_errors(form)))
    d = form.cleaned_data
    column = get_owned(Column, request.user, d["column_id"]) if d["column_id"] else None
    try:
        services.create_card(request.user, project, title=d["title"], column=column, due_date=d["due_date"])
    except DomainError as exc:
        return inertia_render(request, "Projects/Board", props=_board_props(request, project, {exc.field: exc.message}))
    return back(request, f"/projects/{pk}/")


@login_required
@require_POST
def column_create(request, pk: int):
    project = get_owned(Project, request.user, pk)
    form = ColumnForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Projects/Board", props=_board_props(request, project, form_errors(form)))
    try:
        services.add_column(request.user, project, name=form.cleaned_data["name"],
                            wip_limit=form.cleaned_data["wip_limit"])
    except DomainError as exc:
        return inertia_render(request, "Projects/Board", props=_board_props(request, project, {exc.field: exc.message}))
    return see_other("projects:board", pk=pk)


@login_required
@require_http_methods(["PUT", "DELETE"])
def column_detail(request, pk: int):
    column = get_owned(Column, request.user, pk)
    try:
        if request.method == "DELETE":
            services.delete_column(column)
        else:
            form = ColumnForm(payload(request))
            if not form.is_valid():
                return inertia_render(request, "Projects/Board",
                                      props=_board_props(request, column.project, form_errors(form)))
            services.update_column(column, **form.cleaned_data)
    except DomainError as exc:
        return _error_back(request, exc, f"/projects/{column.project_id}/")
    return see_other("projects:board", pk=column.project_id)


# --- Cards -----------------------------------------------------------------------------------


@login_required
@require_http_methods(["GET", "PUT", "DELETE"])
def card_detail(request, pk: int):
    card = get_owned(Card, request.user, pk)
    if request.method == "PUT":
        form = CardForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Projects/Card",
                                  props={**selectors.card_page(request.user, card), "errors": form_errors(form)})
        try:
            services.update_card(card, **form.cleaned_data)
        except DomainError as exc:
            return inertia_render(request, "Projects/Card",
                                  props={**selectors.card_page(request.user, card), "errors": {exc.field: exc.message}})
        messages.success(request, "Card saved")
        return see_other("projects:card", pk=pk)
    if request.method == "DELETE":
        project_id = card.project_id
        services.delete_card(card)
        messages.success(request, "Card deleted")
        return see_other("projects:board", pk=project_id)
    return inertia_render(request, "Projects/Card", props=selectors.card_page(request.user, card))


@login_required
@require_POST
def card_move(request, pk: int):
    card = get_owned(Card, request.user, pk)
    form = MoveForm(payload(request))
    if not form.is_valid():
        messages.error(request, "Couldn't move that card.")
        return back(request, f"/projects/{card.project_id}/")
    column = get_owned(Column, request.user, form.cleaned_data["column_id"])
    try:
        services.move_card(request.user, card, column, form.cleaned_data["position"])
    except DomainError as exc:
        return _error_back(request, exc, f"/projects/{card.project_id}/")
    return back(request, f"/projects/{card.project_id}/")


# --- Card notes ------------------------------------------------------------------------------


@login_required
@require_POST
def note_create(request, pk: int):
    card = get_owned(Card, request.user, pk)
    form = NoteForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Projects/Card",
                              props={**selectors.card_page(request.user, card), "errors": form_errors(form)})
    services.add_note(request.user, card, form.cleaned_data["body"])
    return see_other("projects:card", pk=pk)


@login_required
@require_http_methods(["PUT", "DELETE"])
def note_detail(request, pk: int):
    note = get_owned(CardNote, request.user, pk)
    card_id = note.card_id
    if request.method == "DELETE":
        note.delete()
        messages.success(request, "Note deleted")
        return see_other("projects:card", pk=card_id)
    form = NoteForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Projects/Card",
                              props={**selectors.card_page(request.user, note.card), "errors": form_errors(form)})
    services.update_note(note, form.cleaned_data["body"])
    return see_other("projects:card", pk=card_id)


# --- Timer -----------------------------------------------------------------------------------


@login_required
@require_POST
def card_timer(request, pk: int, action: str):
    if action not in {"start", "pause", "resume", "stop"}:
        raise Http404
    card = get_owned(Card, request.user, pk)
    try:
        with transaction.atomic():
            if action == "start":
                _, stopped = services.start(request.user, card)
                _flash_stopped(request, stopped)
            else:
                entry = (TimeEntry.objects.select_for_update()
                         .filter(running_key=request.user.pk, card=card).first())
                if entry is not None:
                    {"pause": services.pause, "resume": services.resume, "stop": services.stop}[action](entry)
    except DomainError as exc:
        return _error_back(request, exc, f"/projects/cards/{pk}/")
    return back(request, f"/projects/cards/{pk}/")


@login_required
@require_POST
def stop_running(request):
    """The Now line's Stop button: stop whatever is running."""
    entry = services.running_entry(request.user)
    if entry:
        services.stop(entry)
        messages.success(request, f"Stopped the timer on {entry.card.title}")
    return back(request, "/projects/")


# --- Time entries ----------------------------------------------------------------------------


@login_required
@require_POST
def entry_create(request, pk: int):
    card = get_owned(Card, request.user, pk)
    form = EntryForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Projects/Card",
                              props={**selectors.card_page(request.user, card), "errors": form_errors(form)})
    try:
        services.add_manual_entry(request.user, card, **form.cleaned_data)
    except DomainError as exc:
        return inertia_render(request, "Projects/Card",
                              props={**selectors.card_page(request.user, card), "errors": {exc.field: exc.message}})
    messages.success(request, "Time logged")
    return see_other("projects:card", pk=pk)


@login_required
@require_http_methods(["PUT", "DELETE"])
def entry_detail(request, pk: int):
    entry = get_owned(TimeEntry, request.user, pk)
    if request.method == "DELETE":
        if entry.running_key is not None:
            messages.error(request, "Stop the timer before deleting this entry.")
        else:
            entry.delete()
            messages.success(request, "Entry deleted")
        return back(request, f"/projects/cards/{entry.card_id}/")
    form = EntryForm(payload(request))
    if not form.is_valid():
        messages.error(request, next(iter(form_errors(form).values())))
        return back(request, f"/projects/cards/{entry.card_id}/")
    try:
        services.update_entry(entry, **form.cleaned_data)
    except DomainError as exc:
        return _error_back(request, exc, f"/projects/cards/{entry.card_id}/")
    messages.success(request, "Entry saved")
    return back(request, f"/projects/cards/{entry.card_id}/")


# --- Calendar and timesheet ------------------------------------------------------------------


@login_required
@require_GET
def calendar(request):
    today = timezone.localdate()
    year = int_param(request, "y", today.year, lo=2000, hi=2100)
    month = int_param(request, "m", today.month, lo=1, hi=12)
    data = selectors.calendar_month(request.user, year, month)
    return inertia_render(request, "Projects/Calendar", props={**data, "today": today.isoformat()})


@login_required
@require_GET
def timesheet(request):
    week = request.GET.get("week")
    picked = parse_iso_week(week) or parse_date(week)  # "2026-W47" or any date in the week
    monday = week_start(picked or timezone.localdate())
    data = selectors.week_timesheet(request.user, monday)
    running = services.running_entry(request.user)
    now = timezone.now()
    return inertia_render(request, "Projects/Time", props={
        **data,
        "week": iso_week(monday),
        "prev_week": iso_week(date.fromordinal(monday.toordinal() - 7)),
        "next_week": iso_week(date.fromordinal(monday.toordinal() + 7)),
        "running": None if running is None else {
            **selectors.entry_dict(running, now), "card": running.card.title,
            "project": running.card.project.name},
        "server_now": now.isoformat(),
    })


@login_required
@require_GET
def time_csv(request):
    rows = (TimeEntry.objects.for_user(request.user).filter(seconds__isnull=False)
            .select_related("card__project").order_by("started_at"))
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="time.csv"'
    w = csv.writer(response)
    w.writerow(["date", "start", "stop", "minutes", "card", "project"])
    for e in rows.iterator():
        start, stop = timezone.localtime(e.started_at), timezone.localtime(e.stopped_at)
        w.writerow([e.local_date.isoformat(), f"{start:%H:%M}", f"{stop:%H:%M}", round(e.seconds / 60),
                    e.card.title, e.card.project.name])
    return response
