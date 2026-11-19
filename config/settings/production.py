from pathlib import Path

from .base import *  # noqa: F403
from .base import MIDDLEWARE, env, env_list

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY", required=True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
ADMIN_URL = env("ADMIN_URL", required=True)

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "3600"))  # raise to 31536000 after a week
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

MIDDLEWARE.append("apps.core.middleware.ContentSecurityPolicyMiddleware")  # [Stage 15]

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST")
EMAIL_PORT = int(env("EMAIL_PORT", "465"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
EMAIL_USE_SSL = env("EMAIL_USE_SSL", "true").lower() == "true"
EMAIL_TIMEOUT = 20
SERVER_EMAIL = DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", required=True)
ADMINS = [("Owner", env("ADMINS_EMAIL", required=True))]

LOG_DIR = env("LOG_DIR", str(Path.home() / "logs"))
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "{asctime} {levelname} {name} {message}", "style": "{"}},
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": f"{LOG_DIR}/jackandthings.log",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "plain",
        },
        "mail_admins": {"class": "django.utils.log.AdminEmailHandler", "level": "ERROR"},
    },
    "root": {"handlers": ["file"], "level": "INFO"},
    "loggers": {
        "django.request": {"handlers": ["file", "mail_admins"], "level": "ERROR", "propagate": False},
    },
}
