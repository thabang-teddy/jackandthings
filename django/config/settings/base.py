"""Settings shared by every environment. Secrets come from environment variables only.

Lines marked [Stage N] belong to a later stage: keep them commented out until you get there.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # repo root

# Local: .env in the repo. Production: ~/jackandthings.env (outside public_html).
load_dotenv(BASE_DIR / ".env")
load_dotenv(Path.home() / "jackandthings.env")


def env(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise ImproperlyConfigured(f"Missing environment variable: {name}")
    return value or ""


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS: list[str] = []
ADMIN_URL = env("ADMIN_URL", "admin-local")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_vite",  # [Stage 4]
    "inertia",  # [Stage 4]
    "apps.core",
    "apps.accounts",  # [Stage 3]
    "apps.today",  # [Stage 4]
    "apps.notes",  # [Stage 6]
    "apps.focus",  # [Stage 8]
    "apps.projects",  # [Stage 9]
    "apps.money",  # [Stage 10]
    "apps.training",  # [Stage 14]
    "apps.library",  # [Stage 16]
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "inertia.middleware.InertiaMiddleware",  # [Stage 4]
    "apps.core.middleware.InertiaShareMiddleware",  # [Stage 4]
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database: SQLite until Stage 6, then MariaDB via DB_ENGINE=mysql
if env("DB_ENGINE", "sqlite") == "mysql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": env("DB_NAME", required=True),
            "USER": env("DB_USER", required=True),
            "PASSWORD": env("DB_PASSWORD", required=True),
            "HOST": env("DB_HOST", "localhost"),
            "PORT": env("DB_PORT", "3306"),
            "CONN_MAX_AGE": 60,
            "OPTIONS": {"charset": "utf8mb4", "init_command": "SET sql_mode='STRICT_TRANS_TABLES'"},
            "TEST": {"NAME": env("DB_TEST_NAME", "test_jat")},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": env("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
        }
    }
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Auth
AUTH_USER_MODEL = "accounts.User"  # [Stage 3] Must exist before the FIRST migrate.
LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "/"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_RESET_TIMEOUT = 60 * 60
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30

# --- Cache (shared by all Passenger processes) — run `manage.py createcachetable`
CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "django_cache"}}

# --- Locale
LANGUAGE_CODE = "en-za"
TIME_ZONE = "Africa/Johannesburg"
USE_I18N = True
USE_TZ = True

# --- Static files (Vite output lives in static/dist)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Not the Manifest variant: Vite already puts hashes in file names.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}


def _immutable_file_test(path: str, url: str) -> bool:
    """Vite file names contain an 8+ char hash, so they can be cached for a year."""
    return bool(re.match(r"^.+[.-][0-9a-zA-Z_-]{8,12}\..+$", url))


WHITENOISE_IMMUTABLE_FILE_TEST = _immutable_file_test

# --- Private uploads (receipts, progress photos). NEVER served by a public URL.
PRIVATE_MEDIA_ROOT = Path(env("PRIVATE_MEDIA_ROOT", str(BASE_DIR / "private_media")))
MEDIA_ROOT = PRIVATE_MEDIA_ROOT
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 2_621_440  # 2.5 MB of JSON
FILE_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_BYTES

# --- Inertia + Vite
INERTIA_LAYOUT = "base.html"
INERTIA_VERSION = "1.0"
DJANGO_VITE = {
    "default": {
        "dev_mode": False,
        "dev_server_port": 5173,
        "static_url_prefix": "dist",
        "manifest_path": BASE_DIR / "static" / "dist" / "manifest.json",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "Jack & Things <no-reply@localhost>")

# Allowed origin for the browser extension's history API (Stage 16), e.g. chrome-extension://abcdef…
EXTENSION_ORIGIN = env("EXTENSION_ORIGIN", "")
