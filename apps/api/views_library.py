"""`/api/v1/watch-lists`, `watch-list-items` and `history-entries`.

The add-on's existing ingest endpoint (`/api/history/`) stays where it is; this module
is the rest of the Library module expressed as the same token API the phone uses.
"""
from __future__ import annotations

from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.core.models import get_owned
from apps.library import services
from apps.library.models import Visit, WatchItem, WatchList

from . import serializers
from .http import ApiError, api_view, as_bool, collection, data, no_content, payload, required


@api_view(["GET", "POST"])
def watch_lists(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = WatchList.objects.for_user(request.user).prefetch_related("items")
        return collection(request, rows, serializers.watch_list)
    name = str(required(payload(request), "name"))[:60]
    return data(serializers.watch_list(services.create_list(request.user, name), items=[]), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def watch_list(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(WatchList, request.user, pk)
    if request.method == "GET":
        return data(serializers.watch_list(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    name = str(payload(request).get("name", row.name))[:60]
    return data(serializers.watch_list(services.rename_list(row, name)))


@api_view(["GET", "POST"])
def watch_items(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        rows = WatchItem.objects.for_user(request.user).order_by("watch_list_id", "position")
        list_id = request.GET.get("watch_list_id")
        if list_id:
            rows = rows.filter(watch_list_id=list_id)
        return collection(request, rows, serializers.watch_item)

    body = payload(request)
    parent = get_owned(WatchList, request.user, required(body, "watch_list_id"))
    item = services.add_item(request.user, parent, title=str(required(body, "title"))[:200],
                             url=str(body.get("url") or "")[:2048], note=str(body.get("note") or "")[:300])
    return data(serializers.watch_item(item), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def watch_item(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(WatchItem, request.user, pk)
    if request.method == "GET":
        return data(serializers.watch_item(row))
    if request.method == "DELETE":
        row.delete()
        return no_content()
    body = payload(request)
    moved = get_owned(WatchList, request.user, body["watch_list_id"]) if body.get("watch_list_id") else None
    updated = services.update_item(
        row,
        title=str(body.get("title", row.title))[:200],
        url=str(body.get("url", row.url) or "")[:2048],
        note=str(body.get("note", row.note) or "")[:300],
        done=as_bool(body, "done", row.done_at is not None),
        watch_list=moved,
    )
    return data(serializers.watch_item(updated))


@api_view(["GET", "POST"])
def history_entries(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        return collection(request, Visit.objects.for_user(request.user), serializers.visit)

    body = payload(request)
    url = str(required(body, "url"))[:2048]
    if not url.startswith(("http://", "https://")):
        raise ApiError("The given data was invalid.", errors={"url": ["Only http(s) URLs are stored."]})
    visited_at = parse_datetime(str(body.get("visited_at") or "")) or timezone.now()
    if visited_at.tzinfo is None:
        raise ApiError("The given data was invalid.",
                       errors={"visited_at": ["Send an ISO 8601 timestamp with a time zone."]})
    row = Visit.objects.create(owner=request.user, url=url, title=str(body.get("title") or "")[:300],
                               visited_at=visited_at)
    return data(serializers.visit(row), status=201)


@api_view(["GET", "DELETE"])
def history_entry(request: HttpRequest, pk: int) -> HttpResponse:
    row = get_owned(Visit, request.user, pk)
    if request.method == "DELETE":
        row.delete()
        return no_content()
    return data(serializers.visit(row))
