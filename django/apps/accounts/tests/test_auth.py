import json

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client

INERTIA = {"HTTP_X_INERTIA": "true", "HTTP_X_INERTIA_VERSION": "1.0"}


def post_json(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json", **INERTIA)


@pytest.mark.django_db
def test_register_creates_user_and_sends_mail(client):
    r = post_json(client, "/register/", {"name": "T", "email": "T@Ex.com",
                                         "password": "a-long-password-1", "password_confirm": "a-long-password-1"})
    assert r.status_code == 303
    assert get_user_model().objects.filter(email="t@ex.com").exists()
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_sixth_attempt_is_locked(client):
    get_user_model().objects.create_user("a@ex.com", "a-long-password-1", name="A")
    for _ in range(5):
        post_json(client, "/login/", {"email": "a@ex.com", "password": "wrong"})
    r = post_json(client, "/login/", {"email": "a@ex.com", "password": "a-long-password-1"})
    assert r.json()["props"]["errors"]["__all__"].startswith("Too many")


@pytest.mark.django_db
@pytest.mark.parametrize("url", ["/", "/password/confirm/"])
def test_anonymous_is_redirected(client, url):           # AUTH-01
    assert client.get(url).status_code == 302


@pytest.mark.django_db
def test_post_without_csrf_is_rejected():                 # AUTH-02
    strict = Client(enforce_csrf_checks=True)
    r = strict.post("/login/", data="{}", content_type="application/json")
    assert r.status_code == 403
