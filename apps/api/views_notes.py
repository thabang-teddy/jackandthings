"""`/api/v1/notes` — the simplest resource, and the shape the others follow."""
from __future__ import annotations

from django.http import HttpRequest, HttpResponse

from apps.core.models import get_owned
from apps.notes import services
from apps.notes.models import Note

from . import serializers
from .http import api_view, collection, data, no_content, payload, required


@api_view(["GET", "POST"])
def notes(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        return collection(request, Note.objects.for_user(request.user), serializers.note)
    body = payload(request)
    note = services.create_note(request.user, title=str(required(body, "title"))[:120],
                                body=str(body.get("body") or ""))
    return data(serializers.note(note), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def note(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Note, request.user, pk)
    if request.method == "GET":
        return data(serializers.note(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    # PATCH-like semantics on both verbs: a client that sends one field keeps the rest.
    title = str(body.get("title", row.title))[:120]
    text = str(body.get("body", row.body) or "")
    return data(serializers.note(services.update_note(row, title=title, body=text)))
