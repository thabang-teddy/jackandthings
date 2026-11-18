from django.urls import path

from . import api

app_name = "api"
urlpatterns = [path("history/", api.history_ingest, name="history")]
