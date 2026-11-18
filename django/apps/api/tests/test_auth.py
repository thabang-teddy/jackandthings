"""Issuing, using and revoking a device token, and the two throttles that guard it."""
import json

import pytest
from django.test import Client

from apps.library.models import ApiToken
from apps.library.tokens import issue_token

from .conftest import data, errors

CREDENTIALS = {"email": "alice@example.com", "password": "a-long-password-1", "device_name": "Pixel"}


def ask_for_token(client: Client, **overrides):
    return client.post("/api/v1/auth/token", data=json.dumps({**CREDENTIALS, **overrides}),
                       content_type="application/json")


def test_right_password_returns_a_token_and_the_user(alice, anon):
    response = ask_for_token(anon)
    assert response.status_code == 201
    body = data(response)
    assert body["token"] and body["user"] == {"id": alice.pk, "name": alice.name, "email": alice.email}


def test_only_the_hash_is_stored(alice, anon):
    raw = data(ask_for_token(anon))["token"]
    assert ApiToken.objects.get().token_hash != raw
    assert raw not in ApiToken.objects.get().token_hash


def test_device_name_is_kept(alice, anon):
    ask_for_token(anon, device_name="Pixel 9")
    assert ApiToken.objects.get().name == "Pixel 9"


def test_wrong_password_is_422(alice, anon):
    response = ask_for_token(anon, password="not-it")
    assert response.status_code == 422
    assert ApiToken.objects.count() == 0


def test_unknown_email_says_exactly_what_a_wrong_password_says(alice, anon):
    """Otherwise the API tells a stranger which addresses have accounts."""
    unknown = ask_for_token(anon, email="nobody@example.com")
    wrong = ask_for_token(anon, password="not-it")
    assert unknown.status_code == wrong.status_code == 422
    assert errors(unknown) == errors(wrong)


def test_missing_field_is_422(alice, anon):
    response = anon.post("/api/v1/auth/token", data=json.dumps({"email": "alice@example.com"}),
                         content_type="application/json")
    assert response.status_code == 422 and "password" in errors(response)


def test_me_returns_the_token_owner(api, alice):
    assert data(api.get("auth/me"))["email"] == alice.email


def test_no_token_is_401(anon):
    response = anon.get("/api/v1/auth/me")
    assert response.status_code == 401 and response.json()["message"] == "Unauthenticated."


@pytest.mark.parametrize("header", ["", "Bearer", "Bearer nonsense", "Basic abc"])
def test_a_bad_header_is_401(db, anon, header):
    assert anon.get("/api/v1/auth/me", HTTP_AUTHORIZATION=header).status_code == 401


def test_revoke_signs_out_this_device_only(api, alice):
    other = issue_token(alice, "Laptop")
    assert api.delete("auth/token").status_code == 204
    assert api.get("auth/me").status_code == 401
    assert Client().get("/api/v1/auth/me", HTTP_AUTHORIZATION=f"Bearer {other}").status_code == 200


def test_a_deactivated_user_cannot_use_an_old_token(api, alice):
    alice.is_active = False
    alice.save(update_fields=["is_active"])
    assert api.get("auth/me").status_code == 401


def test_token_requests_are_throttled_at_six_a_minute(alice, anon):  # the guessing surface
    for _ in range(6):
        assert ask_for_token(anon, password="not-it").status_code == 422
    blocked = ask_for_token(anon)
    assert blocked.status_code == 429
    assert blocked["Retry-After"] == "60"
    assert blocked.json()["message"] == "Too Many Attempts."


def test_signed_in_reads_are_throttled_at_sixty_a_minute(api):
    for _ in range(60):
        assert api.get("auth/me").status_code == 200
    assert api.get("auth/me").status_code == 429


def test_one_device_hitting_the_limit_does_not_block_another_user(api, api_bob):
    for _ in range(60):
        api.get("auth/me")
    assert api.get("auth/me").status_code == 429
    assert api_bob.get("auth/me").status_code == 200


def test_using_a_token_records_when_it_was_last_used(api):
    assert ApiToken.objects.get(owner=api.user).last_used_at is None
    api.get("auth/me")
    assert ApiToken.objects.get(owner=api.user).last_used_at is not None
