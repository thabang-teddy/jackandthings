"""Notes, and through them the envelope, the pagination and the ownership rule."""
from apps.notes.models import Note

from .conftest import data, errors


def test_list_is_wrapped_and_paged(api, alice):
    for index in range(55):
        Note.objects.create(owner=alice, title=f"Note {index}")
    body = api.get("notes").json()
    assert len(body["data"]) == 50 and body["meta"]["total"] == 55
    assert body["meta"]["last_page"] == 2 and body["links"]["next"].endswith("page=2")
    assert len(api.get("notes", page=2).json()["data"]) == 5


def test_another_users_notes_are_not_in_the_list(api, bob):
    Note.objects.create(owner=bob, title="Bob's")
    assert api.get("notes").json()["meta"]["total"] == 0


def test_create_read_update_delete(api, alice):
    created = data(api.post("notes", {"title": "Daybook", "body": "ink on paper"}))
    assert created["title"] == "Daybook" and isinstance(created["id"], str)

    assert data(api.get(f"notes/{created['id']}"))["body"] == "ink on paper"

    updated = data(api.put(f"notes/{created['id']}", {"title": "Renamed"}))
    assert updated["title"] == "Renamed"
    assert updated["body"] == "ink on paper"   # a field left out is a field left alone

    assert api.delete(f"notes/{created['id']}").status_code == 204
    assert Note.objects.count() == 0


def test_a_note_belongs_to_the_token_owner(api, alice):
    api.post("notes", {"title": "Mine"})
    assert Note.objects.get().owner == alice


def test_title_is_required(api):
    response = api.post("notes", {"body": "no title"})
    assert response.status_code == 422 and "title" in errors(response)
    assert Note.objects.count() == 0


def test_another_users_note_is_404_not_403(api, bob):   # ISO: never reveal that the row exists
    theirs = Note.objects.create(owner=bob, title="Bob's")
    assert api.get(f"notes/{theirs.pk}").status_code == 404
    assert api.put(f"notes/{theirs.pk}", {"title": "Mine now"}).status_code == 404
    assert api.delete(f"notes/{theirs.pk}").status_code == 404
    theirs.refresh_from_db()
    assert theirs.title == "Bob's"


def test_a_missing_note_is_404(api):
    assert api.get("notes/999999").status_code == 404


def test_a_broken_body_is_400(api):
    response = api.client.post("/api/v1/notes", data="{not json", content_type="application/json",
                               **api.headers)
    assert response.status_code == 400


def test_an_unsupported_method_is_405(api):
    assert api.client.patch("/api/v1/notes", data="{}", content_type="application/json",
                            **api.headers).status_code == 405
