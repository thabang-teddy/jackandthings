from django.urls import path

from . import views

app_name = "money"
urlpatterns = [
    path("", views.overview, name="overview"),
    path("transactions/", views.transactions, name="transactions"),
    path("transactions/<int:pk>/", views.transaction_detail, name="transaction_detail"),
    path("transactions/<int:pk>/receipt/", views.receipt_upload, name="receipt_upload"),
    path("transactions.csv", views.transactions_csv, name="transactions_csv"),
    path("receipts/<int:pk>/", views.receipt_delete, name="receipt_delete"),
    path("accounts/", views.accounts, name="accounts"),
    path("accounts/<int:pk>/", views.account_detail, name="account_detail"),
    path("transfer/", views.transfer, name="transfer"),
    path("categories/", views.categories, name="categories"),
    path("categories/<int:pk>/", views.category_detail, name="category_detail"),
    path("caps/", views.caps, name="caps"),
    path("caps/<int:pk>/", views.cap_detail, name="cap_detail"),
    path("goals/", views.goals, name="goals"),  # [Stage 13] from here down
    path("goals/<int:pk>/", views.goal_detail, name="goal_detail"),
    path("goals/<int:pk>/contribute/", views.goal_contribute, name="goal_contribute"),
    path("recurring/", views.recurring, name="recurring"),
    path("recurring/<int:pk>/", views.recurring_detail, name="recurring_detail"),
    path("recurring/<int:pk>/confirm/", views.recurring_confirm, name="recurring_confirm"),
    path("recurring/<int:pk>/skip/", views.recurring_skip, name="recurring_skip"),
    path("reports/", views.reports, name="reports"),
]
