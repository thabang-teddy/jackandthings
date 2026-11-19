from django.core.paginator import Paginator
from django.db.models import Q

from .models import Note


def note_dict(note: Note) -> dict:
    return {"id": note.pk, "title": note.title, "body": note.body,
            "snippet": note.body[:140], "updated_at": note.updated_at.isoformat()}


def list_notes(owner, *, q: str = "", page: int = 1, per_page: int = 20) -> dict:
    qs = Note.objects.for_user(owner)
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))
    pager = Paginator(qs, per_page).get_page(page)
    return {
        "items": [note_dict(n) for n in pager.object_list],
        "page": pager.number, "pages": pager.paginator.num_pages, "total": pager.paginator.count, "q": q,
    }
