"""Reading Inertia requests. Inertia sends JSON; file uploads arrive as multipart form data."""
from __future__ import annotations

import json
from typing import Any

from django.core.exceptions import BadRequest
from django.core.paginator import Paginator
from django.shortcuts import redirect


def payload(request) -> dict[str, Any]:
    """Return submitted data as a dict, whether it came as JSON or as form data.

    Django fills request.POST only for form-encoded POSTs. Inertia sends JSON, and also
    uses PUT/PATCH/DELETE, so we read the body ourselves.
    """
    if request.content_type == "application/json":
        try:
            data = json.loads(request.body or b"{}")
        except json.JSONDecodeError as exc:
            raise BadRequest("Invalid JSON") from exc
        return data if isinstance(data, dict) else {}
    return request.POST.dict()


def see_other(to, *args, **kwargs):
    """Redirect with 303 so the browser follows with GET. Inertia requires it after PUT/PATCH/DELETE."""
    response = redirect(to, *args, **kwargs)
    response.status_code = 303
    return response


def back(request, fallback: str = "/"):
    """303 back to the page the request came from (same host only)."""
    from django.utils.http import url_has_allowed_host_and_scheme

    referer = request.META.get("HTTP_REFERER", "")
    ok = url_has_allowed_host_and_scheme(referer, allowed_hosts={request.get_host()})
    return see_other(referer if ok and referer else fallback)


def int_param(request, name: str, default: int, *, lo: int | None = None, hi: int | None = None) -> int:
    """Read ?name= as an int, falling back to default for junk, clamped to [lo, hi]."""
    try:
        value = int(request.GET.get(name, default))
    except (TypeError, ValueError):
        value = default
    if lo is not None:
        value = max(lo, value)
    if hi is not None:
        value = min(hi, value)
    return value


def page_of(request, queryset, serialize, per_page: int = 25) -> dict[str, Any]:
    """Paginate a queryset and return {items, page, pages, total} for an Inertia prop."""
    paginator = Paginator(queryset, per_page)
    page = paginator.get_page(request.GET.get("page"))
    return {
        "items": [serialize(obj) for obj in page.object_list],
        "page": page.number,
        "pages": paginator.num_pages,
        "total": paginator.count,
    }
