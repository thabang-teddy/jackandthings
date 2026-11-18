from django.urls import path

from . import views

app_name = "today"
urlpatterns = [path("", views.index, name="index")]
