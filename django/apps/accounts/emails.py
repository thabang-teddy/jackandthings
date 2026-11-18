from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "apps.accounts.email_verification"

    def _make_hash_value(self, user, timestamp) -> str:
        # Changes once verified, so the link becomes single-use.
        return f"{user.pk}{user.email}{user.email_verified_at}{timestamp}"


email_token = EmailVerificationTokenGenerator()


def _link(request, name: str, user, token: str) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return request.build_absolute_uri(reverse(name, args=[uid, token]))


def send_verification(request, user) -> None:
    url = _link(request, "accounts:verify_email", user, email_token.make_token(user))
    send_mail("Verify your email", f"Hi {user.get_short_name()},\n\nConfirm your email: {url}\n",
              None, [user.email])


def send_password_reset(request, user) -> None:
    url = _link(request, "accounts:reset", user, default_token_generator.make_token(user))
    send_mail("Reset your password", f"Reset your password within 60 minutes: {url}\n\n"
              "If you didn't ask for this, ignore this email.", None, [user.email])
