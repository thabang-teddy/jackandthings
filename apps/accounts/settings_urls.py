from django.urls import path

from . import settings_views as views

app_name = "settings"
urlpatterns = [
    path("", views.index, name="index"),
    path("profile/", views.profile, name="profile"),
    path("email/", views.email, name="email"),
    path("password/", views.change_password, name="password"),
    path("prefs/", views.prefs, name="prefs"),
    path("delete/", views.delete_account, name="delete"),
]
