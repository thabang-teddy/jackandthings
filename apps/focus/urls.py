from django.urls import path

from . import views

app_name = "focus"
urlpatterns = [
    path("", views.timer, name="timer"),
    path("start/", views.start, name="start"),
    path("pause/", views.pause, name="pause"),
    path("resume/", views.resume, name="resume"),
    path("stop/", views.stop, name="stop"),
    path("skip/", views.skip, name="skip"),
    path("next/", views.start_next, name="next"),
    path("presets/", views.presets, name="presets"),
    path("presets/<int:pk>/", views.preset_detail, name="preset_detail"),
    path("sessions/", views.sessions, name="sessions"),
    path("sessions/<int:pk>/", views.session_detail, name="session_detail"),
    path("stats/", views.stats, name="stats"),
]
