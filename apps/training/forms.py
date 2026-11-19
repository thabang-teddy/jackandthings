from django import forms

from .models import Exercise
from .units import UnitError, parse_cm_to_mm, parse_kg_to_g, parse_kg_x10


class _UnitField(forms.CharField):
    parser = staticmethod(parse_kg_x10)

    def clean(self, value):
        value = super().clean(value)
        if value in ("", None):
            return None
        try:
            return self.parser(str(value))
        except UnitError as exc:
            raise forms.ValidationError(str(exc)) from exc


class KgField(_UnitField):
    parser = staticmethod(parse_kg_x10)


class BodyKgField(_UnitField):
    parser = staticmethod(parse_kg_to_g)


class CmField(_UnitField):
    parser = staticmethod(parse_cm_to_mm)


class ExerciseForm(forms.Form):
    name = forms.CharField(max_length=80, error_messages={"required": "Name the exercise."})
    muscle = forms.ChoiceField(choices=Exercise.Muscle.choices)
    equipment = forms.ChoiceField(choices=Exercise.Equipment.choices)


class RoutineForm(forms.Form):
    name = forms.CharField(max_length=60, error_messages={"required": "Name the routine, e.g. Push day."})
    notes = forms.CharField(max_length=2000, required=False)
    items = forms.JSONField()

    def clean_items(self):
        items = self.cleaned_data["items"]
        if not isinstance(items, list):
            raise forms.ValidationError("Add at least one exercise.")
        return items


class SetForm(forms.Form):
    kg = KgField(required=False)
    reps = forms.IntegerField(min_value=0, max_value=100)
    done = forms.BooleanField(required=False)


class BodyForm(forms.Form):
    date = forms.DateField()
    weight = BodyKgField(required=False)
    waist = CmField(required=False)
    chest = CmField(required=False)
    hips = CmField(required=False)
    note = forms.CharField(max_length=200, required=False)

    def clean(self):
        d = super().clean()
        if not any(d.get(k) for k in ("weight", "waist", "chest", "hips")):
            raise forms.ValidationError("Enter at least one measurement.")
        return d

    def model_values(self) -> dict:
        d = self.cleaned_data
        return {"date": d["date"], "weight_g": d["weight"], "waist_mm": d["waist"], "chest_mm": d["chest"],
                "hips_mm": d["hips"], "note": d["note"]}


class PhotoForm(forms.Form):
    photo = forms.FileField(error_messages={"required": "Choose a photo."})
    date = forms.DateField()
