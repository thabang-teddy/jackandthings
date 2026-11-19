from django.contrib.auth.decorators import login_required
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET


@require_GET
def healthz(request):
    """Uptime checks hit this. 200 means: app started, settings loaded, DB reachable."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"ok": True})


def _private_models() -> dict:
    from apps.money.models import Receipt  # [Stage 13]
    from apps.training.models import ProgressPhoto  # [Stage 14]

    return {
        "receipt": Receipt,  # [Stage 13]
        "photo": ProgressPhoto,  # [Stage 14]
    }


@login_required
@require_GET
def private_file(request, kind: str, pk: int):
    """The ONLY way to a private upload. Ownership is checked; other users get 404."""
    model = _private_models().get(kind)
    if model is None:
        raise Http404
    obj = get_object_or_404(model.objects.for_user(request.user), pk=pk)
    try:
        handle = obj.file.open("rb")
    except FileNotFoundError as exc:
        raise Http404 from exc
    response = FileResponse(handle, content_type=obj.content_type)
    response["Cache-Control"] = "private, no-store"
    response["Content-Disposition"] = "inline"
    response["X-Content-Type-Options"] = "nosniff"
    return response
