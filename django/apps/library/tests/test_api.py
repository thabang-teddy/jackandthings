import json
from datetime import timedelta

from django.test import Client
from django.utils import timezone

from apps.library import services
from apps.library.models import ApiToken, Visit
from apps.library.tokens import issue_token

BODY = {"url": "https://example.com", "title": "Example", "visited_at": "2026-11-18T07:00:00+02:00"}


def post(client, token, body):
    return client.post("/api/history/", data=json.dumps(body), content_type="application/json",
                       HTTP_AUTHORIZATION=f"Bearer {token}")


def test_valid_token_creates_visit(alice):
    raw = issue_token(alice)
    r = post(Client(enforce_csrf_checks=True), raw, BODY)  # no CSRF needed: no cookies involved
    assert r.status_code == 201
    assert Visit.objects.get().owner == alice


def test_token_is_stored_hashed(alice):
    raw = issue_token(alice)
    assert raw not in ApiToken.objects.get().token_hash


def test_wrong_token_is_401(db):  # AUTH-04
    assert post(Client(), "nope", BODY).status_code == 401


def test_javascript_url_is_400(alice):  # VAL-04
    raw = issue_token(alice)
    assert post(Client(), raw, {**BODY, "url": "javascript:alert(1)"}).status_code == 400


def test_retention_purges_old_rows(alice):
    now = timezone.now()
    Visit.objects.create(owner=alice, url="https://a.example", visited_at=now - timedelta(days=100))
    Visit.objects.create(owner=alice, url="https://b.example", visited_at=now - timedelta(days=1))
    assert services.purge_all(now) == 1
    assert Visit.objects.count() == 1


def test_bob_cannot_delete_alices_visit(alice, as_bob):
    v = Visit.objects.create(owner=alice, url="https://a.example", visited_at=timezone.now())
    assert as_bob.delete(f"/library/history/{v.pk}/").status_code == 404
