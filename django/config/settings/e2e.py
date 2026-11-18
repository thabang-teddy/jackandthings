"""Settings for the browser journeys: the real app, with the built assets.

Same database and mail behaviour as `test`, but django-vite reads the manifest Vite
wrote instead of expecting the dev server, so the pages the browser loads are the ones
a deployment would serve. Run `npm --prefix frontend run build` first.
"""
from .base import *  # noqa: F403
from .base import BASE_DIR, DJANGO_VITE

SECRET_KEY = "e2e-only"
DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast sign-ins only
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PRIVATE_MEDIA_ROOT = BASE_DIR / ".e2e_media"
MEDIA_ROOT = PRIVATE_MEDIA_ROOT

DJANGO_VITE["default"]["dev_mode"] = False
VITE_MANIFEST = BASE_DIR / "static" / "dist" / "manifest.json"

# WhiteNoise would want a collected staticfiles/ directory; the live server used by the
# journeys serves STATICFILES_DIRS itself, so take it out of the way.
MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]  # noqa: F405
STORAGES = {"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
            "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}}
