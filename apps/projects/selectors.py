from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from django.db.models import Count, Prefetch, Q, Sum
from django.utils import timezone

from .models import DEFAULT_COLUMNS, Card, CardNote, Column, Project, TimeEntry
from .services import entry_seconds, running_entry


def _card_dict(c: Card, tracked: dict[int, int], running_id: int | None) -> dict:
    return {"id": c.pk, "title": c.title, "project": {"id": c.project_id, "name": c.project.name, "colour": c.project.colour},
            "due_date": c.due_date.isoformat() if c.due_date else None, "notes": c.notes_count,
            "tracked_seconds": tracked.get(c.pk, 0), "running": c.pk == running_id, "done": c.completed_at is not None}


def project_board(owner, project: Project, running_id: int | None) -> list[dict]:
    cards = Card.objects.for_user(owner).filter(project=project).select_related("project").annotate(notes_count=Count("notes"))
    columns = Column.objects.for_user(owner).filter(project=project).prefetch_related(Prefetch("cards", queryset=cards))
    tracked = dict(TimeEntry.objects.for_user(owner).filter(card__project=project, seconds__isnull=False)
                   .values("card_id").annotate(s=Sum("seconds")).values_list("card_id", "s"))
    return [{"id": col.pk, "name": col.name, "wip_limit": col.wip_limit,
             "cards": [_card_dict(c, tracked, running_id) for c in col.cards.all()]} for col in columns]


def calendar_month(owner, year: int, month: int) -> dict:
    first = date(year, month, 1)
    grid_start = first - timedelta(days=first.weekday())           # back to Monday
    grid_end = grid_start + timedelta(days=41)                     # 6 weeks
    due = defaultdict(list)
    for c in Card.objects.for_user(owner).filter(due_date__range=(grid_start, grid_end)).select_related("project"):
        due[c.due_date.isoformat()].append({"id": c.pk, "title": c.title, "colour": c.project.colour, "done": c.completed_at is not None})
    tracked = {d.isoformat(): s for d, s in TimeEntry.objects.for_user(owner)
               .filter(local_date__range=(grid_start, grid_end), seconds__isnull=False)
               .values("local_date").annotate(s=Sum("seconds")).values_list("local_date", "s")}
    days = [grid_start + timedelta(days=i) for i in range(42)]
    return {"year": year, "month": month, "days": [
        {"date": d.isoformat(), "in_month": d.month == month, "due": due.get(d.isoformat(), []),
         "tracked_seconds": tracked.get(d.isoformat(), 0)} for d in days]}


# --- Added for the views ---------------------------------------------------------------------


def running_card_id(owner) -> int | None:
    e = running_entry(owner)
    return e.card_id if e else None


def _tracked_by_card(owner, **filters) -> dict[int, int]:
    return dict(TimeEntry.objects.for_user(owner).filter(seconds__isnull=False, **filters)
                .values("card_id").annotate(s=Sum("seconds")).values_list("card_id", "s"))


def project_dict(p: Project) -> dict:
    return {"id": p.pk, "name": p.name, "colour": p.colour, "archived": p.archived,
            "due_date": p.due_date.isoformat() if p.due_date else None}


def project_list(owner, *, include_archived: bool = False) -> list[dict]:
    qs = Project.objects.for_user(owner).annotate(
        open_cards=Count("cards", filter=Q(cards__completed_at__isnull=True)),
        all_cards=Count("cards")).order_by("archived", "name")
    if not include_archived:
        qs = qs.filter(archived=False)
    return [{**project_dict(p), "open_cards": p.open_cards, "all_cards": p.all_cards} for p in qs]


def all_board(owner, running_id: int | None, project_ids: list[int] | None = None) -> list[dict]:
    """Every active project's cards, grouped by column NAME (Backlog, To do, …)."""
    cards = (Card.objects.for_user(owner).filter(project__archived=False)
             .select_related("project", "column").annotate(notes_count=Count("notes"))
             .order_by("column__position", "position"))
    if project_ids:
        cards = cards.filter(project_id__in=project_ids)
    tracked = _tracked_by_card(owner, card__project__archived=False)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for c in cards:
        grouped[c.column.name].append({**_card_dict(c, tracked, running_id), "column_id": c.column_id})
    names = set(Column.objects.for_user(owner).filter(project__archived=False).values_list("name", flat=True))
    order = [n for n in DEFAULT_COLUMNS if n in names] + sorted(names - set(DEFAULT_COLUMNS))
    return [{"name": n, "cards": grouped.get(n, [])} for n in order]


def columns_of(owner, project_id: int) -> list[dict]:
    return [{"id": c.pk, "name": c.name}
            for c in Column.objects.for_user(owner).filter(project_id=project_id).order_by("position")]


def columns_by_project(owner) -> dict[int, list[dict]]:
    """{project_id: [{id, name}]} for the all-projects "Move to…" menu."""
    out: dict[int, list[dict]] = defaultdict(list)
    for c in Column.objects.for_user(owner).filter(project__archived=False).order_by("position"):
        out[c.project_id].append({"id": c.pk, "name": c.name})
    return dict(out)


def note_dict(n: CardNote) -> dict:
    return {"id": n.pk, "body": n.body, "created_at": n.created_at.isoformat(),
            "updated_at": n.updated_at.isoformat(), "edited": (n.updated_at - n.created_at).total_seconds() > 2}


def entry_dict(e: TimeEntry, now: datetime) -> dict:
    return {"id": e.pk, "card_id": e.card_id, "started_at": e.started_at.isoformat(),
            "stopped_at": e.stopped_at.isoformat() if e.stopped_at else None,
            "paused_at": e.paused_at.isoformat() if e.paused_at else None,
            "paused_seconds": e.paused_seconds, "seconds": entry_seconds(e, now),
            "running": e.running_key is not None, "local_date": e.local_date.isoformat()}


def card_page(owner, card: Card) -> dict:
    now = timezone.now()
    entries = list(TimeEntry.objects.for_user(owner).filter(card=card)[:50])
    running = next((e for e in entries if e.running_key is not None), None)
    total = (TimeEntry.objects.for_user(owner).filter(card=card, seconds__isnull=False)
             .aggregate(s=Sum("seconds"))["s"] or 0)
    if running:
        total += entry_seconds(running, now)
    return {
        "card": {"id": card.pk, "title": card.title, "description": card.description,
                 "due_date": card.due_date.isoformat() if card.due_date else None,
                 "labels": card.labels, "column_id": card.column_id, "column": card.column.name,
                 "done": card.completed_at is not None, "created_at": card.created_at.isoformat()},
        "project": project_dict(card.project),
        "columns": columns_of(owner, card.project_id),
        "notes": [note_dict(n) for n in CardNote.objects.for_user(owner).filter(card=card)],
        "entries": [entry_dict(e, now) for e in entries],
        "timer": entry_dict(running, now) if running else None,
        "tracked_seconds": total,
        "server_now": now.isoformat(),
    }


def week_timesheet(owner, monday: date) -> dict:
    now = timezone.now()
    sunday = monday + timedelta(days=6)
    entries = list(TimeEntry.objects.for_user(owner).filter(local_date__range=(monday, sunday))
                   .select_related("card", "card__project"))
    per_day = {monday + timedelta(days=i): 0 for i in range(7)}
    per_project: dict[str, dict] = {}
    rows = []
    for e in entries:
        secs = entry_seconds(e, now)
        per_day[e.local_date] = per_day.get(e.local_date, 0) + secs
        proj = per_project.setdefault(e.card.project.name, {"name": e.card.project.name,
                                                            "colour": e.card.project.colour, "seconds": 0})
        proj["seconds"] += secs
        rows.append({**entry_dict(e, now), "card": e.card.title, "project": e.card.project.name,
                     "colour": e.card.project.colour})
    return {
        "week_start": monday.isoformat(),
        "entries": rows,
        "per_day": [{"date": d.isoformat(), "seconds": s} for d, s in per_day.items()],
        "per_project": sorted(per_project.values(), key=lambda p: -p["seconds"]),
        "total_seconds": sum(per_day.values()),
    }


def due_soon(owner, today: date, days: int = 2) -> list[Card]:
    """Open cards due by `today + days` (overdue included), for Today and the Now line."""
    return list(Card.objects.for_user(owner)
                .filter(completed_at__isnull=True, due_date__isnull=False,
                        due_date__lte=today + timedelta(days=days), project__archived=False)
                .select_related("project").order_by("due_date")[:10])
