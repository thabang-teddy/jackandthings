"""Top-level URL map. Each app owns its own urls.py; this file only mounts them.

Lines marked [Stage N] belong to a later stage: keep them commented out until you get there.
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from apps.core import views as core_views

urlpatterns = [
    path(f"{settings.ADMIN_URL}/", admin.site.urls),
    path("healthz/", core_views.healthz, name="healthz"),
    path("files/<str:kind>/<int:pk>/", core_views.private_file, name="private_file"),  # [Stage 13]
    path("", include("apps.accounts.urls")),  # [Stage 5]
    path("settings/", include("apps.accounts.settings_urls")),  # [Stage 12]
    path("", include("apps.today.urls")),  # [Stage 4]
    path("notes/", include("apps.notes.urls")),  # [Stage 6]
    path("focus/", include("apps.focus.urls")),  # [Stage 8]
    path("projects/", include("apps.projects.urls")),  # [Stage 9]
    path("money/", include("apps.money.urls")),  # [Stage 10]
    path("training/", include("apps.training.urls")),  # [Stage 14]
    path("library/", include("apps.library.urls")),  # [Stage 16]
    path("api/", include("apps.library.api_urls")),  # [Stage 16]
]

if settings.DEBUG:
    try:  # Django Debug Toolbar is installed locally only (requirements-dev.txt)
        import debug_toolbar  # noqa: F401

        urlpatterns.append(path("__debug__/", include("debug_toolbar.urls")))
    except ImportError:
        pass
