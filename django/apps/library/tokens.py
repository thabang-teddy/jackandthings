import hashlib
import secrets

from django.utils import timezone

from .models import ApiToken


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_token(owner, name: str = "Browser extension") -> str:
    raw = secrets.token_urlsafe(32)                       # shown to the user ONCE
    ApiToken.objects.create(owner=owner, name=name, token_hash=_hash(raw))
    return raw


def token_for_raw(raw: str) -> ApiToken | None:
    """The token row behind a bearer string, or None. Touches `last_used_at` at most every 5 min."""
    if not raw:
        return None
    token = ApiToken.objects.filter(token_hash=_hash(raw)).select_related("owner").first()
    if token is None or not token.owner.is_active:
        return None
    if token.last_used_at is None or (timezone.now() - token.last_used_at).total_seconds() > 300:
        ApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
    return token


def user_for_token(raw: str):
    token = token_for_raw(raw)
    return token.owner if token else None
