"""The JSON endpoint the browser extension posts visits to. No cookies: a bearer token only."""
import json

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from .models import Visit
from .tokens import user_for_token

HOURLY_LIMIT = 600


def _cors(response, request):
    origin = request.headers.get("Origin", "")
    if settings.EXTENSION_ORIGIN and origin == settings.EXTENSION_ORIGIN:  # exactly one origin, never "*"
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        response["Access-Control-Max-Age"] = "86400"
        response["Vary"] = "Origin"
    return response


def _error(request, status: int, code: str, message: str):
    return _cors(JsonResponse({"error": code, "message": message}, status=status), request)


@csrf_exempt  # safe: no cookies are used, authentication is the bearer token
def history_ingest(request):
    if request.method == "OPTIONS":  # CORS preflight
        return _cors(HttpResponse(status=204), request)
    if request.method != "POST":
        return _error(request, 405, "method_not_allowed", "Use POST.")
    auth = request.headers.get("Authorization", "")
    user = user_for_token(auth.removeprefix("Bearer ").strip()) if auth.startswith("Bearer ") else None
    if user is None:
        return _error(request, 401, "unauthorized", "Missing or invalid token.")
    hour_key = f"api:{user.pk}:{timezone.now():%Y%m%d%H}"          # one counter per user per hour
    if cache.get_or_set(hour_key, 0, 3600) >= HOURLY_LIMIT:
        return _error(request, 429, "rate_limited", "Too many requests.")
    cache.incr(hour_key)
    try:
        data = json.loads(request.body)
        url, title = str(data["url"])[:2048], str(data.get("title", ""))[:300]
        visited_at = parse_datetime(str(data["visited_at"]))
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        return _error(request, 400, "invalid", "Send url, title and visited_at (ISO 8601).")
    if visited_at is None or visited_at.tzinfo is None or not url.startswith(("http://", "https://")):
        return _error(request, 400, "invalid", "Only http(s) URLs with a valid timestamp (with time zone).")
    visit = Visit.objects.create(owner=user, url=url, title=title, visited_at=visited_at)
    return _cors(JsonResponse({"id": visit.pk}, status=201), request)
