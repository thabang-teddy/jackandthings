from .base import *  # noqa: F403
from .base import BASE_DIR, DJANGO_VITE

SECRET_KEY = "test-only"
DEBUG = False
ALLOWED_HOSTS = ["testserver"]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast tests only
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
DJANGO_VITE["default"]["dev_mode"] = True  # no manifest needed in tests
PRIVATE_MEDIA_ROOT = BASE_DIR / ".test_media"
MEDIA_ROOT = PRIVATE_MEDIA_ROOT
