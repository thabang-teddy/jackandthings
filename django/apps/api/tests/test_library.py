"""Watch lists, their items, and browsing history over the token API."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.library.models import Visit, WatchItem, WatchList

from .conftest import data, errors


@pytest.fixture
def watch(alice):
    return WatchList.objects.create(owner=alice, name="Read later")


def test_a_list_carries_its_items(api, alice, watch):
    WatchItem.objects.create(owner=alice, watch_list=watch, title="Django docs", position=0)
    body = data(api.get("watch-lists"))
    assert body[0]["name"] == "Read later"
    assert [item["title"] for item in body[0]["items"]] == ["Django docs"]


def test_create_and_rename_a_list(api, alice):
    created = data(api.post("watch-lists", {"name": "Watch next"}))
    renamed = data(api.put(f"watch-lists/{created['id']}", {"name": "Later"}))
    assert renamed["name"] == "Later"
    assert WatchList.objects.get(owner=alice).name == "Later"


def test_a_duplicate_list_name_is_422(api, watch):
    assert api.post("watch-lists", {"name": "Read later"}).status_code == 422


def test_add_an_item_to_your_own_list(api, alice, watch):
    body = data(api.post("watch-list-items", {"watch_list_id": str(watch.pk), "title": "Inertia",
                                              "url": "https://inertiajs.com/", "note": "v3"}))
    assert body["watch_list_id"] == str(watch.pk) and body["done"] is False
    assert WatchItem.objects.get(owner=alice).note == "v3"


def test_an_item_cannot_be_added_to_someone_elses_list(api, bob):
    theirs = WatchList.objects.create(owner=bob, name="Theirs")
    response = api.post("watch-list-items", {"watch_list_id": str(theirs.pk), "title": "Sneaky"})
    assert response.status_code == 404 and WatchItem.objects.count() == 0


def test_ticking_an_item_off_and_back_on(api, alice, watch):
    item = WatchItem.objects.create(owner=alice, watch_list=watch, title="Read this")
    done = data(api.put(f"watch-list-items/{item.pk}", {"done": True}))
    assert done["done"] is True and done["done_at"] is not None
    again = data(api.put(f"watch-list-items/{item.pk}", {"done": False}))
    assert again["done"] is False and again["done_at"] is None


def test_deleting_a_list_takes_its_items(api, alice, watch):
    WatchItem.objects.create(owner=alice, watch_list=watch, title="Read this")
    assert api.delete(f"watch-lists/{watch.pk}").status_code == 204
    assert WatchItem.objects.count() == 0


def test_filtering_items_by_list(api, alice, watch):
    other = WatchList.objects.create(owner=alice, name="Watch")
    WatchItem.objects.create(owner=alice, watch_list=watch, title="A")
    WatchItem.objects.create(owner=alice, watch_list=other, title="B")
    body = data(api.get("watch-list-items", watch_list_id=other.pk))
    assert [item["title"] for item in body] == ["B"]


def test_recording_a_visit(api, alice):
    body = data(api.post("history-entries", {"url": "https://example.com/page", "title": "Page",
                                             "visited_at": "2026-11-18T09:00:00+02:00"}))
    assert body["title"] == "Page"
    assert Visit.objects.get(owner=alice).url == "https://example.com/page"


def test_a_visit_defaults_to_now(api, alice):
    data(api.post("history-entries", {"url": "https://example.com/"}))
    assert (timezone.now() - Visit.objects.get().visited_at) < timedelta(seconds=30)


@pytest.mark.parametrize("url", ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x"])
def test_only_http_urls_are_stored(api, url):
    response = api.post("history-entries", {"url": url})
    assert response.status_code == 422 and "url" in errors(response)
    assert Visit.objects.count() == 0


def test_history_is_newest_first(api, alice):
    now = timezone.now()
    for hours, title in ((5, "older"), (1, "newer")):
        Visit.objects.create(owner=alice, url=f"https://example.com/{title}", title=title,
                             visited_at=now - timedelta(hours=hours))
    assert [row["title"] for row in data(api.get("history-entries"))] == ["newer", "older"]


def test_another_users_visit_is_404(api, bob):
    theirs = Visit.objects.create(owner=bob, url="https://example.com/", visited_at=timezone.now())
    assert api.get(f"history-entries/{theirs.pk}").status_code == 404
    assert api.delete(f"history-entries/{theirs.pk}").status_code == 404
    assert Visit.objects.count() == 1
