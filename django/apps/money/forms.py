import re

from django import forms

from apps.core.money import MoneyError, parse_zar

from .models import Category, MoneyAccount, Recurring

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class AmountField(forms.CharField):
    """Text like '46,50' in, integer cents out. positive=True refuses zero and negatives."""

    def __init__(self, *args, positive: bool = True, **kwargs):
        self.positive = positive
        super().__init__(*args, **kwargs)

    def clean(self, value):
        value = super().clean(value)
        if value in ("", None):
            return None
        try:
            cents = parse_zar(str(value))
        except MoneyError as exc:
            raise forms.ValidationError(str(exc)) from exc
        if self.positive and cents <= 0:
            raise forms.ValidationError("Enter an amount above zero.")
        return cents


class OwnedForm(forms.Form):
    """A form whose choice fields only see the current user's rows (isolation via the form)."""

    def __init__(self, *args, owner, **kwargs):
        super().__init__(*args, **kwargs)
        self.owner = owner
        if "account" in self.fields:
            self.fields["account"].queryset = MoneyAccount.objects.for_user(owner).filter(archived=False)
        if "category" in self.fields:
            self.fields["category"].queryset = Category.objects.for_user(owner)


class TransactionForm(OwnedForm):
    date = forms.DateField(error_messages={"required": "Pick a date."})
    description = forms.CharField(max_length=160, error_messages={"required": "What was it for?"})
    amount = AmountField()
    direction = forms.ChoiceField(choices=[("out", "Out"), ("in", "In")])
    account = forms.ModelChoiceField(queryset=MoneyAccount.objects.none(),
                                     error_messages={"required": "Pick an account."})
    category = forms.ModelChoiceField(queryset=Category.objects.none(), required=False)

    def signed_cents(self) -> int:
        d = self.cleaned_data
        return -d["amount"] if d["direction"] == "out" else d["amount"]


class LedgerFilterForm(OwnedForm):
    """Validates ?from=&to=&account=&category=&direction=&q= — junk values are simply ignored."""

    from_ = forms.DateField(required=False)
    to = forms.DateField(required=False)
    account = forms.ModelChoiceField(queryset=MoneyAccount.objects.none(), required=False)
    category = forms.ModelChoiceField(queryset=Category.objects.none(), required=False)
    direction = forms.ChoiceField(choices=[("", "All"), ("out", "Out"), ("in", "In")], required=False)
    q = forms.CharField(max_length=80, required=False)

    def __init__(self, data, *, owner):
        data = data.copy()
        if "from" in data:
            data["from_"] = data.get("from")
        super().__init__(data, owner=owner)
        # The filter may show archived accounts too.
        self.fields["account"].queryset = MoneyAccount.objects.for_user(owner)

    def values(self) -> dict:
        """Only the filters that are valid. Django drops invalid fields from cleaned_data."""
        self.is_valid()
        return self.cleaned_data


class AccountForm(forms.Form):
    name = forms.CharField(max_length=60, error_messages={"required": "Name the account."})
    kind = forms.ChoiceField(choices=MoneyAccount.Kind.choices)
    opening = AmountField(required=False, positive=False)
    archived = forms.BooleanField(required=False)

    def clean_opening(self) -> int:
        return self.cleaned_data.get("opening") or 0


class TransferForm(OwnedForm):
    source = forms.ModelChoiceField(queryset=MoneyAccount.objects.none(),
                                    error_messages={"required": "Pick the account to move from."})
    target = forms.ModelChoiceField(queryset=MoneyAccount.objects.none(),
                                    error_messages={"required": "Pick the account to move to."})
    amount = AmountField()
    date = forms.DateField()
    note = forms.CharField(max_length=160, required=False)

    def __init__(self, *args, owner, **kwargs):
        super().__init__(*args, owner=owner, **kwargs)
        accounts = MoneyAccount.objects.for_user(owner).filter(archived=False)
        self.fields["source"].queryset = accounts
        self.fields["target"].queryset = accounts


class CategoryForm(forms.Form):
    name = forms.CharField(max_length=40, error_messages={"required": "Name the category."})
    colour = forms.CharField(max_length=7)
    glyph = forms.CharField(max_length=1, required=False)

    def clean_colour(self) -> str:
        colour = self.cleaned_data["colour"]
        if not HEX.match(colour):
            raise forms.ValidationError("Use a colour like #E07A3F.")
        return colour.upper()

    def clean(self):
        data = super().clean()
        if data.get("name") and not data.get("glyph"):
            data["glyph"] = data["name"][0].upper()
        return data


class CapForm(OwnedForm):
    category = forms.ModelChoiceField(queryset=Category.objects.none())
    amount = AmountField()
    warn_at_pct = forms.IntegerField(min_value=50, max_value=100, required=False)

    def clean_warn_at_pct(self) -> int:
        return self.cleaned_data.get("warn_at_pct") or 90


class GoalForm(forms.Form):
    name = forms.CharField(max_length=60, error_messages={"required": "Name the goal."})
    target = AmountField()
    target_date = forms.DateField(required=False)


class ContributionForm(forms.Form):
    amount = AmountField(positive=False)
    date = forms.DateField()

    def clean_amount(self) -> int:
        cents = self.cleaned_data.get("amount")
        if not cents:
            raise forms.ValidationError("Enter an amount (negative to take money out).")
        return cents


class RecurringForm(OwnedForm):
    name = forms.CharField(max_length=80, error_messages={"required": "Name it, e.g. Rent."})
    amount = AmountField()
    direction = forms.ChoiceField(choices=[("out", "Out"), ("in", "In")])
    cadence = forms.ChoiceField(choices=Recurring.Cadence.choices)
    next_date = forms.DateField(error_messages={"required": "When is it next due?"})
    account = forms.ModelChoiceField(queryset=MoneyAccount.objects.none())
    category = forms.ModelChoiceField(queryset=Category.objects.none(), required=False)
    auto_post = forms.BooleanField(required=False)
    active = forms.BooleanField(required=False)

    def model_values(self) -> dict:
        d = self.cleaned_data
        return {"name": d["name"].strip(), "cadence": d["cadence"], "next_date": d["next_date"],
                "account": d["account"], "category": d["category"], "auto_post": d["auto_post"],
                "active": d["active"],
                "amount_cents": -d["amount"] if d["direction"] == "out" else d["amount"]}


class ReceiptForm(forms.Form):
    receipt = forms.FileField(error_messages={"required": "Choose an image."})
