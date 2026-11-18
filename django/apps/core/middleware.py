from django.conf import settings
from inertia import share


def _user(request) -> dict | None:
    user = request.user
    if not user.is_authenticated:
        return None
    return {
        "id": user.pk,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified_at is not None,
        "theme": user.theme,
    }


def _now(request):
    from .now import now_payload  # lazy: only imported when a page renders

    return now_payload(request.user)


class InertiaShareMiddleware:
    """Props every page receives. Lambdas are evaluated only when a page actually renders."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        share(
            request,
            auth=lambda: {"user": _user(request)},
            now=lambda: _now(request),  # [Stage 9]
            app={"debug": settings.DEBUG},
        )
        return self.get_response(request)


class ContentSecurityPolicyMiddleware:  # [Stage 15] — added in production.py only
    POLICY = ("default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
              "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
              "form-action 'self'; object-src 'none'")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.POLICY)
        response.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response
