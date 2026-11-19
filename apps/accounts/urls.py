from django.urls import path

from . import views

app_name = "accounts"
urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("password/forgot/", views.forgot, name="forgot"),
    path("password/reset/<uidb64>/<token>/", views.reset, name="reset"),
    path("password/confirm/", views.password_confirm, name="password_confirm"),
    path("email/verify/<uidb64>/<token>/", views.verify_email, name="verify_email"),
    path("email/resend/", views.resend_verification, name="resend_verification"),
]
