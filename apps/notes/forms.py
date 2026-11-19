from django import forms

from .models import Note


class NoteForm(forms.ModelForm):
    class Meta:
        model = Note
        fields = ["title", "body"]
        error_messages = {"title": {"required": "Give the note a title — even one word."}}
