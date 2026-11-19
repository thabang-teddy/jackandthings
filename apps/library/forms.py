from django import forms


class ListForm(forms.Form):
    name = forms.CharField(max_length=60, error_messages={"required": "Name the list, e.g. Films."})


class ItemForm(forms.Form):
    title = forms.CharField(max_length=200, error_messages={"required": "What is it?"})
    url = forms.URLField(max_length=2048, required=False, assume_scheme="https")
    note = forms.CharField(max_length=300, required=False)
    done = forms.BooleanField(required=False)
    list_id = forms.IntegerField(required=False)

    def clean_url(self) -> str:
        url = self.cleaned_data.get("url") or ""
        if url and not url.startswith(("http://", "https://")):
            raise forms.ValidationError("Only http(s) links.")
        return url


class ClearRangeForm(forms.Form):
    start = forms.DateTimeField(error_messages={"required": "From when?"})
    end = forms.DateTimeField(error_messages={"required": "Until when?"})


class RetentionForm(forms.Form):
    days = forms.TypedChoiceField(coerce=int, choices=[(7, "7 days"), (30, "30 days"), (90, "90 days"),
                                                       (365, "1 year")])


class TokenForm(forms.Form):
    name = forms.CharField(max_length=60, required=False)
