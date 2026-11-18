"""Token issue, who-am-I and revoke — the three routes every other endpoint depends on."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import HttpRequest, HttpResponse

from apps.library.models import ApiToken
from apps.library.tokens import issue_token

from . import serializers
from .http import ApiError, api_view, data, no_content, payload, required

AUTH_LIMIT = 6          # Laravel: throttle:6,1 — this is the password-guessing surface
SAME_MESSAGE = "These credentials do not match our records."


@api_view(["POST"], auth=False, limit=AUTH_LIMIT)
def token(request: HttpRequest) -> HttpResponse:
    body = payload(request)
    email = str(required(body, "email")).strip().lower()
    password = str(required(body, "password"))
    device = str(body.get("device_name") or "Unnamed device")[:60]

    user = get_user_model().objects.filter(email=email).first()
    # One message either way, so this cannot be used to find out which addresses have accounts.
    if user is None or not user.is_active or not user.check_password(password):
        raise ApiError("The given data was invalid.", errors={"email": [SAME_MESSAGE]})

    raw = issue_token(user, name=device)
    return data({"token": raw, "user": serializers.user(user)}, status=201)


@api_view(["GET"])
def me(request: HttpRequest) -> HttpResponse:
    return data(serializers.user(request.user))


@api_view(["DELETE"])
def revoke(request: HttpRequest) -> HttpResponse:
    """Revokes only the token this request used, leaving the user's other devices signed in."""
    ApiToken.objects.filter(pk=request.api_token.pk).delete()
    return no_content()


def token_endpoint(request: HttpRequest) -> HttpResponse:
    """One path, two routes, as in Laravel: POST issues a token, DELETE revokes this one.

    They cannot share a decorator — issuing is open and throttled hard, revoking needs
    the token it is about to delete — so the dispatch happens here instead.
    """
    return revoke(request) if request.method == "DELETE" else token(request)
