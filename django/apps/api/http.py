"""The plumbing every `api/v1` endpoint shares: tokens, throttling, envelopes and errors.

This is the Django half of the contract `laravel/routes/api.php` serves. The envelope,
status codes and error bodies are Laravel's, so a client written against the PHP app
reads the same shapes here: `{"data": …}` for one record, `{"data": […], "meta": …}`
for a page, 204 with no body for a delete, and `{"message": …, "errors": {…}}` for a
rejected write.

The .NET comparison: `api_view` does the job of `[Authorize]`, `[HttpGet]` and a
rate-limiting filter on a controller action, and `ApiError` is the exception an action
throws to return a ProblemDetails-style body.
"""
from __future__ import annotations

import json
from collections.abc import Callable, Iterable
from functools import wraps
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db.models import QuerySet
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.errors import DomainError
from apps.library.tokens import token_for_raw

PER_PAGE = 50
WINDOW_SECONDS = 60


class ApiError(Exception):
    """A reply the client should see, not a crash. Mirrors Laravel's ValidationException."""

    def __init__(self, message: str, *, status: int = 422, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.errors = errors or {}


def problem(message: str, *, status: int, errors: dict[str, list[str]] | None = None) -> JsonResponse:
    body: dict[str, Any] = {"message": message}
    if errors:
        body["errors"] = errors
    return JsonResponse(body, status=status)


def data(obj: Any, *, status: int = 200) -> JsonResponse:
    """One record (or one computed object) in Laravel's `data` envelope."""
    return JsonResponse({"data": obj}, status=status, safe=False)


def no_content() -> HttpResponse:
    return HttpResponse(status=204)


def collection(request: HttpRequest, rows: QuerySet | list, serialize: Callable[[Any], dict],
               *, per_page: int = PER_PAGE) -> JsonResponse:
    """A page of records shaped like Laravel's paginated resource collection."""
    try:
        page = max(1, int(request.GET.get("page", "1")))
    except ValueError:
        page = 1
    total = rows.count() if isinstance(rows, QuerySet) else len(rows)
    start = (page - 1) * per_page
    window = list(rows[start:start + per_page])
    last_page = max(1, -(-total // per_page))
    path = request.build_absolute_uri(request.path)
    return JsonResponse({
        "data": [serialize(row) for row in window],
        "links": {
            "first": f"{path}?page=1",
            "last": f"{path}?page={last_page}",
            "prev": f"{path}?page={page - 1}" if page > 1 else None,
            "next": f"{path}?page={page + 1}" if page < last_page else None,
        },
        "meta": {"current_page": page, "from": start + 1 if window else None, "last_page": last_page,
                 "path": path, "per_page": per_page, "to": start + len(window) if window else None,
                 "total": total},
    })


# --- Request body ------------------------------------------------------------------------------


def payload(request: HttpRequest) -> dict:
    """The request body as a dict, whether it arrived as JSON or as a form/multipart post."""
    if request.content_type and request.content_type.startswith("multipart/"):
        return request.POST.dict()
    if not request.body:
        return {}
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError as exc:
        raise ApiError("The request body is not valid JSON.", status=400) from exc
    if not isinstance(body, dict):
        raise ApiError("The request body must be a JSON object.", status=400)
    return body


def required(body: dict, field: str) -> Any:
    if body.get(field) in (None, ""):
        raise ApiError("The given data was invalid.", errors={field: ["This field is required."]})
    return body[field]


def as_int(body: dict, field: str, default: int | None = None) -> int | None:
    value = body.get(field, default)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ApiError("The given data was invalid.",
                       errors={field: ["This field must be a whole number."]}) from exc


def as_bool(body: dict, field: str, default: bool = False) -> bool:
    value = body.get(field, default)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


# --- The decorator -----------------------------------------------------------------------------


def _cors(response: HttpResponse, request: HttpRequest) -> HttpResponse:
    """One configured origin (the browser add-on), never `*`, and only when it is set."""
    origin = request.headers.get("Origin", "")
    if settings.EXTENSION_ORIGIN and origin == settings.EXTENSION_ORIGIN:
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
        response["Access-Control-Max-Age"] = "86400"
        response["Vary"] = "Origin"
    return response


def _throttled(key: str, limit: int) -> bool:
    """A fixed window per minute, held in the shared cache table — Laravel's `throttle:n,1`."""
    used = cache.get_or_set(key, 0, WINDOW_SECONDS)
    if used >= limit:
        return True
    try:
        cache.incr(key)
    except ValueError:  # the window expired between the read and the increment
        cache.set(key, 1, WINDOW_SECONDS)
    return False


def api_view(methods: Iterable[str], *, auth: bool = True, limit: int = 60) -> Callable:
    """Wrap a function so it behaves like one `api/v1` route.

    Checks the method, authenticates the bearer token, throttles per caller and turns
    the exceptions the services raise into the JSON bodies the clients expect.
    """
    allowed = {m.upper() for m in methods}

    def decorator(view: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
        @csrf_exempt  # safe: these endpoints never read a session cookie, only a bearer token
        @wraps(view)
        def wrapper(request: HttpRequest, *args, **kwargs) -> HttpResponse:
            if request.method == "OPTIONS":
                return _cors(HttpResponse(status=204), request)
            if request.method not in allowed:
                return _cors(problem("Method not allowed.", status=405), request)

            request.api_token = None
            if auth:
                header = request.headers.get("Authorization", "")
                token = token_for_raw(header.removeprefix("Bearer ").strip()) if header.startswith("Bearer ") else None
                if token is None:
                    return _cors(problem("Unauthenticated.", status=401), request)
                request.api_token = token
                request.user = token.owner
                throttle_key = f"apiv1:{token.owner_id}:{request.method}"
            else:
                throttle_key = f"apiv1:anon:{request.META.get('REMOTE_ADDR', '-')}"

            if _throttled(throttle_key, limit):
                response = problem("Too Many Attempts.", status=429)
                response["Retry-After"] = str(WINDOW_SECONDS)
                return _cors(response, request)

            try:
                return _cors(view(request, *args, **kwargs), request)
            except ApiError as exc:
                return _cors(problem(exc.message, status=exc.status, errors=exc.errors), request)
            except DomainError as exc:
                field = getattr(exc, "field", None) or "base"
                return _cors(problem("The given data was invalid.", status=422,
                                     errors={field: [str(exc)]}), request)
            except ValidationError as exc:
                errors = exc.message_dict if hasattr(exc, "message_dict") else {"base": list(exc.messages)}
                return _cors(problem("The given data was invalid.", status=422, errors=errors), request)
            except Http404:
                # 404 and never 403: a record owned by somebody else must not be detectable.
                return _cors(problem("Not found.", status=404), request)

        return wrapper

    return decorator
