from django.contrib import messages
from django.contrib.auth import logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET, require_http_methods
from inertia import render as inertia_render

from apps.core.http import payload, see_other
from apps.core.inertia import form_errors

from . import services
from .emails import send_verification
from .forms import EmailChangeForm, ProfileForm
from .views import require_recent_password


def settings_props(request) -> dict:
    u = request.user
    return {"profile": {"name": u.name, "email": u.email, "theme": u.theme,
                        "email_verified": u.email_verified_at is not None},
            "prefs": services.prefs_of(u),
            "themes": [{"value": v, "label": label} for v, label in u.Theme.choices]}


def _render(request, errors: dict | None = None):
    props = settings_props(request)
    return inertia_render(request, "Settings/Index", props={**props, "errors": errors} if errors else props)


@login_required
@require_GET
def index(request):
    return _render(request)


@login_required
@require_http_methods(["PUT"])
def profile(request):
    form = ProfileForm(payload(request), instance=request.user)
    if not form.is_valid():
        return _render(request, form_errors(form))
    form.save()
    messages.success(request, "Profile saved")
    return see_other("settings:index")


@login_required
@require_recent_password
@require_http_methods(["GET", "PUT"])
def email(request):
    if request.method == "GET":  # where require_recent_password sends you back to
        return see_other("settings:index")
    form = EmailChangeForm(payload(request), user=request.user)
    if not form.is_valid():
        return _render(request, form_errors(form))
    user = request.user
    user.email, user.email_verified_at = form.cleaned_data["email"], None
    user.save(update_fields=["email", "email_verified_at"])
    send_verification(request, user)
    messages.success(request, "Email changed. Check your new inbox to verify it.")
    return see_other("settings:index")


@login_required
@sensitive_post_parameters()
@require_http_methods(["PUT"])
def change_password(request):
    form = PasswordChangeForm(request.user, payload(request))  # fields: old_password, new_password1, new_password2
    if not form.is_valid():
        return _render(request, form_errors(form))
    user = form.save()
    update_session_auth_hash(request, user)  # keep THIS session; every other session is now invalid
    messages.success(request, "Password changed.")
    return see_other("settings:index")


@login_required
@require_http_methods(["PUT"])
def prefs(request):
    services.save_prefs(request.user, payload(request))
    messages.success(request, "Preferences saved")
    return see_other("settings:index")


@login_required
@require_recent_password
@require_http_methods(["GET", "POST", "DELETE"])
def delete_account(request):
    if request.method in ("POST", "DELETE"):  # POST too: some clients drop DELETE bodies
        if payload(request).get("confirm") != "DELETE":
            return inertia_render(request, "Settings/Delete", props={"errors": {"confirm": "Type DELETE to confirm."}})
        user = request.user
        logout(request)
        services.delete_account(user)   # removes the user (rows cascade), then their files
        return see_other("accounts:login")
    return inertia_render(request, "Settings/Delete")
