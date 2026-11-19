import re

from django import forms

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ProjectForm(forms.Form):
    name = forms.CharField(max_length=80, error_messages={"required": "Name the project."})
    colour = forms.CharField(max_length=7, required=False)
    due_date = forms.DateField(required=False)
    archived = forms.BooleanField(required=False)

    def clean_colour(self) -> str:
        colour = self.cleaned_data.get("colour") or "#1F4FD1"
        if not HEX.match(colour):
            raise forms.ValidationError("Use a colour like #1F4FD1.")
        return colour.upper()


class ColumnForm(forms.Form):
    name = forms.CharField(max_length=40, error_messages={"required": "Name the column."})
    wip_limit = forms.IntegerField(required=False, min_value=1, max_value=99)
    position = forms.IntegerField(required=False, min_value=0)


class CardCreateForm(forms.Form):
    title = forms.CharField(max_length=160, error_messages={"required": "Give the card a title."})
    column_id = forms.IntegerField(required=False)
    due_date = forms.DateField(required=False)


class CardForm(forms.Form):
    title = forms.CharField(max_length=160, error_messages={"required": "Give the card a title."})
    description = forms.CharField(required=False, max_length=10_000)
    due_date = forms.DateField(required=False)
    labels = forms.JSONField(required=False)

    def clean_labels(self) -> list[str]:
        labels = self.cleaned_data.get("labels") or []
        if not isinstance(labels, list):
            raise forms.ValidationError("Labels must be a list.")
        return [str(x) for x in labels]


class MoveForm(forms.Form):
    column_id = forms.IntegerField()
    position = forms.IntegerField(min_value=0)


class NoteForm(forms.Form):
    body = forms.CharField(max_length=10_000, strip=True,
                           error_messages={"required": "Write something first."})


class EntryForm(forms.Form):
    started_at = forms.DateTimeField(error_messages={"required": "When did you start?"})
    minutes = forms.IntegerField(min_value=1, max_value=24 * 60)
