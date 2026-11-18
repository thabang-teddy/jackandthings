from django.urls import path

from . import views

app_name = "training"
urlpatterns = [
    path("", views.index, name="index"),
    path("start/", views.start, name="start"),
    path("live/", views.live, name="live"),
    path("live/sets/", views.live_add_set, name="live_add_set"),
    path("live/sets/<int:pk>/", views.live_set, name="live_set"),
    path("live/rest/skip/", views.live_skip_rest, name="live_skip_rest"),
    path("live/finish/", views.live_finish, name="live_finish"),
    path("live/discard/", views.live_discard, name="live_discard"),
    path("exercises/", views.exercises, name="exercises"),
    path("exercises/<int:pk>/", views.exercise_detail, name="exercise_detail"),
    path("routines/", views.routines, name="routines"),
    path("routines/new/", views.routine_new, name="routine_new"),
    path("routines/<int:pk>/", views.routine_detail, name="routine"),
    path("sessions/", views.sessions, name="sessions"),
    path("sessions/<int:pk>/", views.session_detail, name="session_detail"),
    path("body/", views.body, name="body"),
    path("body/<int:pk>/", views.body_detail, name="body_detail"),
    path("body/photos/", views.photos, name="photos"),
    path("body/photos/upload/", views.photo_upload, name="photo_upload"),
    path("body/photos/<int:pk>/", views.photo_detail, name="photo_detail"),
    path("stats/", views.stats, name="stats"),
]
