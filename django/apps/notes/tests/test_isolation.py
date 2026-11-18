# apps/notes/tests/test_isolation.py
import json

import pytest
from django.contrib.auth import get_user_model

from apps.notes.models import Note

INERTIA = {"HTTP_X_INERTIA": "true", "HTTP_X_INERTIA_VERSION": "1.0"}


@pytest.fixture
def alice(db):
    return get_user_model().objects.create_user("alice@example.com", "a-long-password-1", name="Alice")


@pytest.fixture
def bob(db):
    return get_user_model().objects.create_user("bob@example.com", "a-long-password-1", name="Bob")


def test_bob_cannot_read_alices_note(client, alice, bob):          # ISO-01
    note = Note.objects.create(owner=alice, title="Private")
    client.force_login(bob)
    assert client.get(f"/notes/{note.pk}/", **INERTIA).status_code == 404


def test_bob_cannot_edit_or_delete(client, alice, bob):
    note = Note.objects.create(owner=alice, title="Private")
    client.force_login(bob)
    put = client.put(f"/notes/{note.pk}/", data=json.dumps({"title": "x"}), content_type="application/json", **INERTIA)
    delete = client.delete(f"/notes/{note.pk}/", **INERTIA)
    assert (put.status_code, delete.status_code) == (404, 404)
    assert Note.objects.get(pk=note.pk).title == "Private"


def test_list_only_shows_own_notes(client, alice, bob):
    Note.objects.create(owner=alice, title="A")
    Note.objects.create(owner=bob, title="B")
    client.force_login(bob)
    titles = [n["title"] for n in client.get("/notes/", **INERTIA).json()["props"]["items"]]
    assert titles == ["B"]
