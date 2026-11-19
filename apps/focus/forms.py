from django import forms

from .models import Preset


class PresetForm(forms.ModelForm):
    class Meta:
        model = Preset
        fields = ["name", "focus_min", "short_min", "long_min", "long_every", "auto_start", "sound",
                  "strict", "is_default"]
        error_messages = {"name": {"required": "Name the preset, e.g. Deep work."}}

    def clean(self):
        data = super().clean()
        for field, lo, hi in [("focus_min", 1, 180), ("short_min", 1, 60), ("long_min", 1, 90),
                              ("long_every", 1, 12)]:
            value = data.get(field)
            if value is not None and not lo <= value <= hi:
                self.add_error(field, f"Between {lo} and {hi}.")
        return data


class StartForm(forms.Form):
    preset_id = forms.IntegerField()
    tag = forms.CharField(max_length=40, required=False)
