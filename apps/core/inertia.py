def form_errors(form) -> dict[str, str]:
    """Django gives a list of messages per field; Inertia's useForm expects one string."""
    return {field: str(messages[0]) for field, messages in form.errors.items()}
