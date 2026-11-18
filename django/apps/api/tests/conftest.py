"""Fixtures for the token API.

These tests speak to `/api/v1/…` the way a phone does: a bearer token, JSON bodies and
no session cookie at all. `TokenClient` is the whole client in twenty lines, so a test
reads as the request it is making.
"""
import io
import json

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.library.tokens import issue_token

BASE = "/api/v1/"


class TokenClient:
    """One signed-in device. Every call carries the bearer token; nothing carries a cookie."""

    def __init__(self, user, raw: str) -> None:
        self.user = user
        self.raw = raw
        # enforce_csrf_checks proves these routes need no CSRF token: they read no cookie.
        self.client = Client(enforce_csrf_checks=True)
        self.headers = {"HTTP_AUTHORIZATION": f"Bearer {raw}"}

    def get(self, path: str, **params):
        return self.client.get(BASE + path, params, **self.headers)

    def post(self, path: str, body: dict | None = None):
        return self._send("post", path, body)

    def put(self, path: str, body: dict | None = None):
        return self._send("put", path, body)

    def patch(self, path: str, body: dict | None = None):
        return self._send("patch", path, body)

    def delete(self, path: str):
        return self.client.delete(BASE + path, **self.headers)

    def upload(self, path: str, **fields):
        return self.client.post(BASE + path, fields, **self.headers)

    def _send(self, method: str, path: str, body: dict | None):
        return getattr(self.client, method)(BASE + path, data=json.dumps(body or {}),
                                            content_type="application/json", **self.headers)


@pytest.fixture(autouse=True)
def _reset_throttle():
    """Throttle counters live in the cache, so one test's requests must not spill into the next."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api(alice):
    return TokenClient(alice, issue_token(alice, "Alice's phone"))


@pytest.fixture
def api_bob(bob):
    return TokenClient(bob, issue_token(bob, "Bob's phone"))


@pytest.fixture
def anon():
    return Client()


def data(response):
    """The `data` member of the envelope — the record, the list, or None."""
    return response.json()["data"]


def errors(response) -> dict:
    return response.json().get("errors", {})


def png_upload(name: str = "shot.png") -> SimpleUploadedFile:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")
