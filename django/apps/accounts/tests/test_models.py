import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_email_is_lowercased_and_unique():
    User = get_user_model()
    User.objects.create_user("Thabang@Example.com", "a-long-password-1", name="T")
    assert User.objects.get().email == "thabang@example.com"
