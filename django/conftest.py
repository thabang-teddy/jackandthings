"""Fixtures every app's tests can use. pytest finds this file automatically."""
import json

import pytest
from django.contrib.auth import get_user_model

INERTIA = {"HTTP_X_INERTIA": "true", "HTTP_X_INERTIA_VERSION": "1.0"}


@pytest.fixture
def alice(db):
    return get_user_model().objects.create_user("alice@example.com", "a-long-password-1", name="Alice")


@pytest.fixture
def bob(db):
    return get_user_model().objects.create_user("bob@example.com", "a-long-password-1", name="Bob")


class InertiaClient:
    """Small wrapper: every request carries the Inertia headers, bodies are JSON."""

    def __init__(self, client):
        self.client = client

    def get(self, url, **kw):
        return self.client.get(url, **INERTIA, **kw)

    def _send(self, method, url, data=None):
        return getattr(self.client, method)(url, data=json.dumps(data or {}),
                                            content_type="application/json", **INERTIA)

    def post(self, url, data=None):
        return self._send("post", url, data)

    def put(self, url, data=None):
        return self._send("put", url, data)

    def delete(self, url):
        return self.client.delete(url, **INERTIA)


@pytest.fixture
def as_alice(client, alice):
    client.force_login(alice)
    return InertiaClient(client)


@pytest.fixture
def as_bob(client, bob):
    client.force_login(bob)
    return InertiaClient(client)


def props(response) -> dict:
    return response.json()["props"]
