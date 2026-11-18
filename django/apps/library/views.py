from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from inertia import render as inertia_render

from apps.core.errors import DomainError
from apps.core.http import back, page_of, payload, see_other
from apps.core.inertia import form_errors
from apps.core.models import get_owned

from . import services
from .forms import ClearRangeForm, ItemForm, ListForm, RetentionForm, TokenForm
from .models import ApiToken, Visit, WatchItem, WatchList
from .tokens import issue_token


def _item_dict(i: WatchItem) -> dict:
    return {"id": i.pk, "title": i.title, "url": i.url, "note": i.note, "done": i.done_at is not None,
            "list_id": i.watch_list_id}


def _lists_props(request, errors=None) -> dict:
    lists = (WatchList.objects.for_user(request.user)
             .annotate(open_count=Count("items", filter=Q(items__done_at__isnull=True))))
    selected_id = request.GET.get("list")
    selected = next((wl for wl in lists if str(wl.pk) == selected_id), lists[0] if lists else None)
    items = [] if selected is None else [_item_dict(i) for i in
                                         WatchItem.objects.for_user(request.user).filter(watch_list=selected)]
    props = {"lists": [{"id": wl.pk, "name": wl.name, "open": wl.open_count} for wl in lists],
             "selected": selected.pk if selected else None, "items": items}
    return {**props, "errors": errors} if errors else props


@login_required
@require_http_methods(["GET", "POST"])
def index(request):
    """GET: watch lists. POST: create a list."""
    if request.method == "POST":
        form = ListForm(payload(request))
        if not form.is_valid():
            return inertia_render(request, "Library/Index", props=_lists_props(request, form_errors(form)))
        try:
            wl = services.create_list(request.user, form.cleaned_data["name"])
        except DomainError as exc:
            return inertia_render(request, "Library/Index", props=_lists_props(request, {exc.field: exc.message}))
        return see_other(f"/library/?list={wl.pk}")
    return inertia_render(request, "Library/Index", props=_lists_props(request))


@login_required
@require_http_methods(["PUT", "DELETE"])
def list_detail(request, pk: int):
    wl = get_owned(WatchList, request.user, pk)
    if request.method == "DELETE":
        wl.delete()
        messages.success(request, f"Deleted {wl.name}")
        return see_other("library:index")
    form = ListForm(payload(request))
    if not form.is_valid():
        messages.error(request, next(iter(form_errors(form).values())))
        return back(request, "/library/")
    try:
        services.rename_list(wl, form.cleaned_data["name"])
    except DomainError as exc:
        messages.error(request, exc.message)
    return see_other(f"/library/?list={pk}")


@login_required
@require_POST
def item_create(request, pk: int):
    wl = get_owned(WatchList, request.user, pk)
    form = ItemForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Library/Index", props=_lists_props(request, form_errors(form)))
    d = form.cleaned_data
    services.add_item(request.user, wl, title=d["title"], url=d["url"], note=d["note"])
    return see_other(f"/library/?list={pk}")


@login_required
@require_http_methods(["PUT", "DELETE"])
def item_detail(request, pk: int):
    item = get_owned(WatchItem, request.user, pk)
    list_id = item.watch_list_id
    if request.method == "DELETE":
        item.delete()
        return see_other(f"/library/?list={list_id}")
    form = ItemForm(payload(request))
    if not form.is_valid():
        messages.error(request, next(iter(form_errors(form).values())))
        return see_other(f"/library/?list={list_id}")
    d = form.cleaned_data
    target = get_owned(WatchList, request.user, d["list_id"]) if d["list_id"] else None
    services.update_item(item, title=d["title"], url=d["url"], note=d["note"], done=d["done"], watch_list=target)
    return see_other(f"/library/?list={list_id}")


# --- History ---------------------------------------------------------------------------------


def _visit_dict(v: Visit) -> dict:
    return {"id": v.pk, "url": v.url, "title": v.title, "visited_at": v.visited_at.isoformat()}


def _history_props(request, errors=None, new_token: str | None = None) -> dict:
    q = request.GET.get("q", "").strip()[:100]
    qs = Visit.objects.for_user(request.user)
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(url__icontains=q))
    props = {
        **page_of(request, qs, _visit_dict, per_page=50),
        "q": q,
        "retention_days": request.user.history_retention_days,
        "next_purge": services.next_purge(request.user),
        "tokens": [{"id": t.pk, "name": t.name, "created_at": t.created_at.isoformat(),
                    "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None}
                   for t in ApiToken.objects.for_user(request.user)],
        "new_token": new_token,  # shown once, right after it's created; never stored raw
    }
    return {**props, "errors": errors} if errors else props


@login_required
@require_GET
def history(request):
    return inertia_render(request, "Library/History", props=_history_props(request))


@login_required
@require_http_methods(["DELETE"])
def visit_detail(request, pk: int):
    get_owned(Visit, request.user, pk).delete()
    return back(request, "/library/history/")


@login_required
@require_POST
def history_clear(request):
    form = ClearRangeForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Library/History", props=_history_props(request, form_errors(form)))
    try:
        n = services.clear_range(request.user, form.cleaned_data["start"], form.cleaned_data["end"])
    except DomainError as exc:
        return inertia_render(request, "Library/History", props=_history_props(request, {exc.field: exc.message}))
    messages.success(request, f"Deleted {n} visit{'s' if n != 1 else ''}")
    return see_other("library:history")


@login_required
@require_http_methods(["PUT"])
def retention(request):
    form = RetentionForm(payload(request))
    if not form.is_valid():
        return inertia_render(request, "Library/History", props=_history_props(request, form_errors(form)))
    request.user.history_retention_days = form.cleaned_data["days"]
    request.user.save(update_fields=["history_retention_days"])
    messages.success(request, "Retention saved")
    return see_other("library:history")


@login_required
@require_POST
def token_create(request):
    form = TokenForm(payload(request))
    form.is_valid()
    raw = issue_token(request.user, form.cleaned_data.get("name") or "Browser extension")
    # Render (not redirect) so the raw token is shown exactly once and never lands in the session.
    return inertia_render(request, "Library/History", props=_history_props(request, new_token=raw))


@login_required
@require_http_methods(["DELETE"])
def token_detail(request, pk: int):
    get_owned(ApiToken, request.user, pk).delete()
    messages.success(request, "Token revoked. The extension using it will stop syncing.")
    return see_other("library:history")
