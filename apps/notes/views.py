from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from inertia import render as inertia_render

from apps.core.http import payload, see_other
from apps.core.inertia import form_errors

from . import selectors, services
from .forms import NoteForm
from .models import Note


@login_required
@require_http_methods(["GET", "POST"])
def index(request):
    if request.method == "POST":
        form = NoteForm(payload(request))
        if form.is_valid():
            note = services.create_note(request.user, **form.cleaned_data)
            messages.success(request, "Note saved")
            return see_other("notes:detail", pk=note.pk)
        return inertia_render(request, "Notes/Edit", props={"note": None, "errors": form_errors(form)})
    data = selectors.list_notes(request.user, q=request.GET.get("q", "").strip(),
                                page=request.GET.get("page", 1))
    return inertia_render(request, "Notes/Index", props=data)


@login_required
def new(request):
    return inertia_render(request, "Notes/Edit", props={"note": None})


@login_required
@require_http_methods(["GET", "PUT", "DELETE"])
def detail(request, pk: int):
    note = get_object_or_404(Note.objects.for_user(request.user), pk=pk)  # 404 for other users' notes
    if request.method == "PUT":
        form = NoteForm(payload(request), instance=note)
        if form.is_valid():
            services.update_note(note, **form.cleaned_data)
            messages.success(request, "Note saved")
            return see_other("notes:detail", pk=note.pk)
        return inertia_render(request, "Notes/Edit", props={"note": selectors.note_dict(note), "errors": form_errors(form)})
    if request.method == "DELETE":
        note.delete()
        messages.success(request, "Note deleted")
        return see_other("notes:index")
    return inertia_render(request, "Notes/Edit", props={"note": selectors.note_dict(note)})
