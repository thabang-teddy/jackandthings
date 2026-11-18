"""Projects: boards, cards, card notes and the one-running-timer rule."""
from __future__ import annotations

from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.errors import DomainError

from .models import DEFAULT_COLUMNS, Card, CardNote, Column, Project, TimeEntry


@transaction.atomic
def create_project(owner, *, name: str, colour: str = "#1F4FD1", due_date=None) -> Project:
    if Project.objects.for_user(owner).filter(name__iexact=name.strip()).exists():
        raise DomainError("You already have a project with that name.", field="name")
    project = Project.objects.create(owner=owner, name=name.strip(), colour=colour, due_date=due_date)
    Column.objects.bulk_create([Column(owner=owner, project=project, name=n, position=i)
                                for i, n in enumerate(DEFAULT_COLUMNS)])
    return project


def _renumber(cards: list[Card]) -> None:
    for i, card in enumerate(cards):
        card.position = i
    Card.objects.bulk_update(cards, ["position", "column"])


@transaction.atomic
def move_card(owner, card: Card, to_column: Column, to_position: int) -> None:
    if to_column.project_id != card.project_id:
        raise DomainError("That column belongs to another project.", field="column_id")
    locked = Card.objects.for_user(owner).select_for_update()
    source = list(locked.filter(column_id=card.column_id).exclude(pk=card.pk).order_by("position"))
    target = source if to_column.pk == card.column_id else list(
        locked.filter(column=to_column).order_by("position"))
    target.insert(max(0, min(to_position, len(target))), card)
    card.column = to_column
    _renumber(target)
    if target is not source:
        _renumber(source)
    _sync_done(card)


def _sync_done(card: Card) -> None:
    """A card in a column named "Done" is complete; moving it out reopens it."""
    is_done = card.column.name.strip().lower() == "done"
    if is_done and card.completed_at is None:
        card.completed_at = timezone.now()
    elif not is_done and card.completed_at is not None:
        card.completed_at = None
    else:
        return
    card.save(update_fields=["completed_at", "updated_at"])


def add_note(owner, card: Card, body: str) -> CardNote:
    if not body.strip():
        raise DomainError("Write something first.", field="body")
    return CardNote.objects.create(owner=owner, card=card, body=body.strip())

# --- Timer (part 2) ---------------------------------------------------------------------------


def entry_seconds(e: TimeEntry, now: datetime) -> int:
    end = e.stopped_at or e.paused_at or now
    return max(0, int((end - e.started_at).total_seconds()) - e.paused_seconds)


def running_entry(owner) -> TimeEntry | None:
    return TimeEntry.objects.filter(running_key=owner.pk).select_related("card", "card__project").first()


@transaction.atomic
def stop(e: TimeEntry, *, now: datetime | None = None) -> TimeEntry:
    now = now or timezone.now()
    if e.paused_at:
        e.paused_seconds += int((now - e.paused_at).total_seconds())
        e.paused_at = None
    e.stopped_at, e.running_key = now, None
    e.seconds = entry_seconds(e, now)
    e.save()
    return e


@transaction.atomic
def start(owner, card: Card, *, now: datetime | None = None) -> tuple[TimeEntry, TimeEntry | None]:
    """Start tracking `card`. Returns (new_entry, entry_that_was_stopped_or_None)."""
    now = now or timezone.now()
    type(owner).objects.select_for_update().filter(pk=owner.pk).first()   # serialise per user
    current = running_entry(owner)
    if current and current.card_id == card.pk:
        if current.paused_at:
            resume(current, now=now)
        return current, None
    stopped = stop(current, now=now) if current else None
    try:
        entry = TimeEntry.objects.create(owner=owner, card=card, started_at=now,
                                         local_date=timezone.localdate(now), running_key=owner.pk)
    except IntegrityError as exc:
        raise DomainError("Another timer started at the same moment — try again.") from exc
    return entry, stopped


def pause(e: TimeEntry, *, now: datetime | None = None) -> None:
    if e.paused_at is None and e.stopped_at is None:
        e.paused_at = now or timezone.now()
        e.save(update_fields=["paused_at", "updated_at"])


def resume(e: TimeEntry, *, now: datetime | None = None) -> None:
    now = now or timezone.now()
    if e.paused_at:
        e.paused_seconds += int((now - e.paused_at).total_seconds())
        e.paused_at = None
        e.save(update_fields=["paused_at", "paused_seconds", "updated_at"])


# --- Everything else the views need (Stage 9, step 5) -----------------------------------------


def update_project(project: Project, *, name: str, colour: str, due_date=None, archived: bool = False) -> Project:
    name = name.strip()
    clash = Project.objects.for_user(project.owner).filter(name__iexact=name).exclude(pk=project.pk)
    if clash.exists():
        raise DomainError("You already have a project with that name.", field="name")
    project.name, project.colour, project.due_date, project.archived = name, colour, due_date, archived
    project.save()
    return project


@transaction.atomic
def delete_project(project: Project) -> None:
    owner = project.owner
    current = running_entry(owner)
    if current and current.card.project_id == project.pk:
        stop(current)
    # Cards PROTECT their column, so delete cards first, then the project (columns cascade).
    Card.objects.for_user(owner).filter(project=project).delete()
    project.delete()


def add_column(owner, project: Project, *, name: str, wip_limit: int | None = None) -> Column:
    if Column.objects.for_user(owner).filter(project=project, name__iexact=name.strip()).exists():
        raise DomainError("This board already has a column with that name.", field="name")
    last = Column.objects.for_user(owner).filter(project=project).order_by("-position").first()
    return Column.objects.create(owner=owner, project=project, name=name.strip(), wip_limit=wip_limit,
                                 position=(last.position + 1) if last else 0)


def update_column(column: Column, *, name: str, wip_limit: int | None, position: int | None = None) -> Column:
    name = name.strip()
    siblings = Column.objects.for_user(column.owner).filter(project_id=column.project_id)
    if siblings.filter(name__iexact=name).exclude(pk=column.pk).exists():
        raise DomainError("This board already has a column with that name.", field="name")
    column.name, column.wip_limit = name, wip_limit
    column.save(update_fields=["name", "wip_limit", "updated_at"])
    if position is not None:
        with transaction.atomic():
            ordered = [c for c in siblings.select_for_update().order_by("position") if c.pk != column.pk]
            ordered.insert(max(0, min(position, len(ordered))), column)
            for i, c in enumerate(ordered):
                c.position = i
            Column.objects.bulk_update(ordered, ["position"])
    return column


def delete_column(column: Column) -> None:
    if column.cards.exists():
        raise DomainError("Move or delete the cards in this column first.")
    if Column.objects.for_user(column.owner).filter(project_id=column.project_id).count() <= 1:
        raise DomainError("A board needs at least one column.")
    column.delete()


@transaction.atomic
def create_card(owner, project: Project, *, title: str, column: Column | None = None,
                due_date=None, description: str = "") -> Card:
    if not title.strip():
        raise DomainError("Give the card a title.", field="title")
    column = column or Column.objects.for_user(owner).filter(project=project).order_by("position").first()
    if column is None or column.project_id != project.pk:
        raise DomainError("Pick a column on this board.", field="column_id")
    last = Card.objects.for_user(owner).filter(column=column).order_by("-position").first()
    card = Card.objects.create(owner=owner, project=project, column=column, title=title.strip(),
                               description=description, due_date=due_date,
                               position=(last.position + 1) if last else 0)
    _sync_done(card)
    return card


def update_card(card: Card, *, title: str, description: str, due_date, labels: list[str]) -> Card:
    if not title.strip():
        raise DomainError("Give the card a title.", field="title")
    card.title, card.description, card.due_date = title.strip(), description, due_date
    card.labels = [str(label).strip()[:24] for label in labels if str(label).strip()][:8]
    card.save()
    return card


@transaction.atomic
def delete_card(card: Card) -> None:
    current = running_entry(card.owner)
    if current and current.card_id == card.pk:
        stop(current)
    card.delete()


def update_note(note: CardNote, body: str) -> CardNote:
    if not body.strip():
        raise DomainError("Write something first.", field="body")
    note.body = body.strip()
    note.save(update_fields=["body", "updated_at"])
    return note


def add_manual_entry(owner, card: Card, *, started_at: datetime, minutes: int) -> TimeEntry:
    """Log time you forgot to track (F-34)."""
    from datetime import timedelta

    if not 1 <= minutes <= 24 * 60:
        raise DomainError("Between 1 minute and 24 hours.", field="minutes")
    if started_at > timezone.now():
        raise DomainError("That's in the future.", field="started_at")
    return TimeEntry.objects.create(owner=owner, card=card, started_at=started_at,
                                    local_date=timezone.localdate(started_at),
                                    stopped_at=started_at + timedelta(minutes=minutes), seconds=minutes * 60)


def update_entry(entry: TimeEntry, *, started_at: datetime, minutes: int) -> TimeEntry:
    from datetime import timedelta

    if entry.running_key is not None:
        raise DomainError("Stop the timer before editing this entry.")
    if not 1 <= minutes <= 24 * 60:
        raise DomainError("Between 1 minute and 24 hours.", field="minutes")
    entry.started_at, entry.local_date = started_at, timezone.localdate(started_at)
    entry.stopped_at, entry.seconds = started_at + timedelta(minutes=minutes), minutes * 60
    entry.paused_at, entry.paused_seconds = None, 0
    entry.save()
    return entry


def close_stale_entries(now: datetime | None = None, max_hours: int = 12) -> int:
    """Cron: a project timer left running for more than `max_hours` is almost certainly forgotten."""
    from datetime import timedelta

    now = now or timezone.now()
    closed = 0
    for e in TimeEntry.objects.filter(running_key__isnull=False, paused_at__isnull=True):
        if entry_seconds(e, now) > max_hours * 3600:
            stop(e, now=e.started_at + timedelta(seconds=e.paused_seconds + max_hours * 3600))
            closed += 1
    return closed
