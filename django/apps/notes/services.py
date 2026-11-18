from .models import Note


def create_note(owner, *, title: str, body: str = "") -> Note:
    return Note.objects.create(owner=owner, title=title.strip(), body=body)


def update_note(note: Note, *, title: str, body: str) -> Note:
    note.title, note.body = title.strip(), body
    note.save(update_fields=["title", "body", "updated_at"])
    return note
