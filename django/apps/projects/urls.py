from django.urls import path

from . import views

app_name = "projects"
urlpatterns = [
    path("", views.index, name="index"),
    path("<int:pk>/", views.board, name="board"),
    path("<int:pk>/cards/", views.card_create, name="card_create"),
    path("<int:pk>/columns/", views.column_create, name="column_create"),
    path("columns/<int:pk>/", views.column_detail, name="column_detail"),
    path("cards/<int:pk>/", views.card_detail, name="card"),
    path("cards/<int:pk>/move/", views.card_move, name="card_move"),
    path("cards/<int:pk>/notes/", views.note_create, name="note_create"),
    path("cards/<int:pk>/entries/", views.entry_create, name="entry_create"),
    path("cards/<int:pk>/timer/<str:action>/", views.card_timer, name="card_timer"),
    path("notes/<int:pk>/", views.note_detail, name="note_detail"),
    path("entries/<int:pk>/", views.entry_detail, name="entry_detail"),
    path("timer/stop/", views.stop_running, name="stop_running"),
    path("calendar/", views.calendar, name="calendar"),
    path("time/", views.timesheet, name="time"),
    path("time.csv", views.time_csv, name="time_csv"),
]
