from .base import *  # noqa: F403  (star import is normal for settings files)
from .base import DJANGO_VITE, INSTALLED_APPS, MIDDLEWARE, env

DEBUG = True
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-not-secret-change-me")
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
DJANGO_VITE["default"]["dev_mode"] = True

# Django Debug Toolbar (pip install django-debug-toolbar — dev only). Shows SQL per request.
try:
    import debug_toolbar  # noqa: F401

    INSTALLED_APPS += ["debug_toolbar"]
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")
    INTERNAL_IPS = ["127.0.0.1"]
except ImportError:
    pass
