from __future__ import annotations

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra) -> User:
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)  # hashes; never store raw passwords
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra) -> User:
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra) -> User:
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if not (extra["is_staff"] and extra["is_superuser"]):
            raise ValueError("Superuser must have is_staff and is_superuser")
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    class Theme(models.TextChoices):
        SYSTEM = "system", "System"
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    username = None  # remove the field inherited from AbstractUser
    first_name = None
    last_name = None
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    theme = models.CharField(max_length=8, choices=Theme.choices, default=Theme.SYSTEM)
    prefs = models.JSONField(default=dict, blank=True)  # [Stage 12] notification toggles, see services.py
    history_retention_days = models.PositiveSmallIntegerField(default=90)  # [Stage 16]

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]  # asked by createsuperuser, in addition to email + password
    objects = UserManager()

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.name.split(" ")[0] if self.name else self.email

    def __str__(self) -> str:
        return self.email
