import hashlib
import time
from functools import wraps
from urllib.parse import quote

from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import url_has_allowed_host_and_scheme, urlsafe_base64_decode
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.http import payload, see_other
from apps.core.inertia import form_errors

from . import ratelimit
from .emails import email_token, send_password_reset, send_verification
from .forms import RegisterForm

User = get_user_model()


def _safe_next(request, fallback: str = "/") -> str:
    nxt = request.GET.get("next", "")
    ok = url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}, require_https=request.is_secure())
    return nxt if ok else fallback


@sensitive_post_parameters("password", "password_confirm")
@require_http_methods(["GET", "POST"])
def register(request):
    if request.method == "POST":
        form = RegisterForm(payload(request))
        if form.is_valid():
            d = form.cleaned_data
            user = User.objects.create_user(d["email"], d["password"], name=d["name"])
            login(request, user)
            send_verification(request, user)
            messages.success(request, "Welcome! Check your inbox to verify your email.")
            return see_other("today:index")
        return inertia_render(request, "Auth/Register", props={"errors": form_errors(form)})
    return inertia_render(request, "Auth/Register")


@sensitive_post_parameters("password")
@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect("today:index")
    if request.method == "POST":
        data = payload(request)
        email = str(data.get("email", "")).strip().lower()
        ip = request.META.get("REMOTE_ADDR", "")
        if ratelimit.is_locked(email, ip):
            return inertia_render(request, "Auth/Login", props={
                "email": email, "errors": {"__all__": "Too many attempts. Wait a minute, then try again."}})
        user = authenticate(request, email=email, password=str(data.get("password", "")))
        if user is None:
            ratelimit.record_failure(email, ip)
            return inertia_render(request, "Auth/Login", props={
                "email": email, "errors": {"__all__": "That email and password don't match."}})
        ratelimit.clear(email, ip)
        login(request, user)
        request.session.set_expiry(60 * 60 * 24 * 30 if data.get("remember") else 0)
        return see_other(_safe_next(request))
    return inertia_render(request, "Auth/Login")


@require_POST
def logout_view(request):
    logout(request)
    return see_other("accounts:login")


@require_http_methods(["GET", "POST"])
def forgot(request):
    if request.method == "POST":
        email = str(payload(request).get("email", "")).strip().lower()
        key = "reset:" + hashlib.sha256(email.encode()).hexdigest()[:32]  # no raw emails in the cache
        if email and cache.add(key, 1, 60):  # add() fails if the key exists: max 1 per minute
            user = User.objects.filter(email=email, is_active=True).first()
            if user:
                send_password_reset(request, user)
        # Same answer whether or not the account exists (F-03).
        return inertia_render(request, "Auth/Forgot", props={"sent": True, "email": email})
    return inertia_render(request, "Auth/Forgot")


def _user_from_uid(uidb64: str):
    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None


@sensitive_post_parameters("new_password1", "new_password2")
@require_http_methods(["GET", "POST"])
def reset(request, uidb64: str, token: str):
    user = _user_from_uid(uidb64)
    if user is None or not default_token_generator.check_token(user, token):
        return inertia_render(request, "Auth/Reset", props={"expired": True})
    if request.method == "POST":
        form = SetPasswordForm(user, payload(request))
        if form.is_valid():
            form.save()
            login(request, user)
            messages.success(request, "Password changed.")
            return see_other("today:index")
        return inertia_render(request, "Auth/Reset", props={"errors": form_errors(form), "email": user.email})
    return inertia_render(request, "Auth/Reset", props={"email": user.email})


def verify_email(request, uidb64: str, token: str):
    user = _user_from_uid(uidb64)
    if user is None or not email_token.check_token(user, token):
        return inertia_render(request, "Auth/Verify", props={"expired": True})
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    messages.success(request, "Email verified.")
    return redirect("today:index")


@require_POST
def resend_verification(request):
    if request.user.is_authenticated and request.user.email_verified_at is None:
        if cache.add(f"verify:{request.user.pk}", 1, 60):
            send_verification(request, request.user)
            messages.success(request, "Sent again — check your inbox.")
        else:
            messages.error(request, "You can resend once a minute.")
    return see_other("today:index")


CONFIRM_SECONDS = 3 * 60 * 60


def require_recent_password(view):
    """Decorator: the user must have typed their password in the last 3 hours (F-05)."""
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if time.time() - request.session.get("password_confirmed_at", 0) > CONFIRM_SECONDS:
            return redirect(f"{reverse('accounts:password_confirm')}?next={quote(request.get_full_path())}")
        return view(request, *args, **kwargs)
    return wrapper


@sensitive_post_parameters("password")
@require_http_methods(["GET", "POST"])
def password_confirm(request):
    if not request.user.is_authenticated:
        return redirect("accounts:login")
    if request.method == "POST":
        if request.user.check_password(str(payload(request).get("password", ""))):
            request.session["password_confirmed_at"] = time.time()
            return see_other(_safe_next(request))
        return inertia_render(request, "Auth/ConfirmPassword", props={"errors": {"password": "That password is wrong."}})
    return inertia_render(request, "Auth/ConfirmPassword")
