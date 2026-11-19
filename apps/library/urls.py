from django.urls import path

from . import views

app_name = "library"
urlpatterns = [
    path("", views.index, name="index"),
    path("lists/<int:pk>/", views.list_detail, name="list_detail"),
    path("lists/<int:pk>/items/", views.item_create, name="item_create"),
    path("items/<int:pk>/", views.item_detail, name="item_detail"),
    path("history/", views.history, name="history"),
    path("history/<int:pk>/", views.visit_detail, name="visit_detail"),
    path("history/clear/", views.history_clear, name="history_clear"),
    path("history/retention/", views.retention, name="retention"),
    path("tokens/", views.token_create, name="token_create"),
    path("tokens/<int:pk>/", views.token_detail, name="token_detail"),
]
