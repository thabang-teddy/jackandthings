from django import forms
from django.contrib.auth import get_user_model, password_validation

User = get_user_model()


class RegisterForm(forms.Form):
    name = forms.CharField(max_length=120)
    email = forms.EmailField()
    password = forms.CharField(strip=False)
    password_confirm = forms.CharField(strip=False)

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("That email already has an account. Sign in instead?")
        return email

    def clean(self):
        data = super().clean()
        if data.get("password") and data.get("password") != data.get("password_confirm"):
            self.add_error("password_confirm", "This doesn't match the password above.")
        if data.get("password"):
            try:
                password_validation.validate_password(
                    data["password"], User(email=data.get("email", ""), name=data.get("name", ""))
                )
            except forms.ValidationError as exc:
                self.add_error("password", exc)
        return data


# --- Stage 12: settings ----------------------------------------------------------------------


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["name", "theme"]
        error_messages = {"name": {"required": "Tell us what to call you."}}


class EmailChangeForm(forms.Form):
    email = forms.EmailField()

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        if email == self.user.email:
            raise forms.ValidationError("That's already your email.")
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("That email already has an account.")
        return email
