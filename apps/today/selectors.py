"""Everything the Today page shows, in one place."""
from __future__ import annotations

from datetime import date

from django.db.models import Sum
from django.utils import timezone


def _word(n: int) -> str:
    return ["no", "one", "two", "three", "four", "five"][n] if n <= 5 else str(n)


def deck(counts: dict[str, int]) -> str:
    parts = []
    if counts["running"]:
        parts.append(f"{_word(counts['running'])} thing{'s' if counts['running'] > 1 else ''} running")
    if counts["over"]:
        parts.append(f"{_word(counts['over'])} cap{'s' if counts['over'] > 1 else ''} broken")
    if counts["due"]:
        parts.append(f"{_word(counts['due'])} item{'s' if counts['due'] > 1 else ''} due soon")
    if not parts:
        return "All quiet."
    text = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    return text[0].upper() + text[1:] + "."   # capitalise the sentence, not every clause


def greeting(hour: int) -> str:
    if hour < 5:
        return "Still up?"
    if hour < 12:
        return "Good morning."
    if hour < 18:
        return "Good afternoon."
    return "Good evening."


def today(owner, *, on: date | None = None) -> dict:
    from apps.focus.models import Session
    from apps.focus.selectors import running as focus_running
    from apps.focus.selectors import today_minutes
    from apps.money.models import MoneyAccount
    from apps.money.selectors import balances, caps_for_month, due_recurring
    from apps.notes.models import Note
    from apps.notes.selectors import note_dict
    from apps.projects.models import Project, TimeEntry
    from apps.projects.selectors import due_soon
    from apps.projects.services import entry_seconds, running_entry
    from apps.training.selectors import today_summary as training_summary  # [Stage 14]

    now = timezone.now()
    on = on or timezone.localdate()

    first_run = not (Note.objects.for_user(owner).exists() or Session.objects.for_user(owner).exists()
                     or Project.objects.for_user(owner).exists() or MoneyAccount.objects.for_user(owner).exists())

    entry, focus = running_entry(owner), focus_running(owner)
    caps = caps_for_month(owner, on)
    over = [c for c in caps if c["over_cents"] > 0]
    recurring = due_recurring(owner, on)
    cards = due_soon(owner, on, days=2)

    attention = []  # ordered by consequence: money lost → overdue → due → suggestion
    for c in over:
        attention.append({"kind": "over", "title": f"{c['category']} is over its cap",
                          "detail_cents": c["over_cents"], "href": "/money/caps/"})
    for r in recurring:
        attention.append({"kind": "overdue" if r.next_date < on else "due", "title": f"{r.name} is due",
                          "detail": r.next_date.isoformat(), "href": "/money/recurring/"})
    for card in cards:
        attention.append({"kind": "overdue" if card.due_date < on else "due", "title": card.title,
                          "detail": card.due_date.isoformat(), "project": card.project.name,
                          "href": f"/projects/cards/{card.pk}/"})
    order = {"over": 0, "overdue": 1, "due": 2, "suggestion": 3}
    attention.sort(key=lambda a: order[a["kind"]])
    if not attention and not first_run and today_minutes(owner, on) == 0 and focus is None:
        attention.append({"kind": "suggestion", "title": "No focus yet today — start a 25-minute session?",
                          "href": "/focus/"})

    tracked = (TimeEntry.objects.for_user(owner).filter(local_date=on, seconds__isnull=False)
               .aggregate(s=Sum("seconds"))["s"] or 0)
    if entry is not None:
        tracked += entry_seconds(entry, now)

    accounts = balances(owner)
    local = timezone.localtime(now)
    counts = {"running": int(entry is not None) + int(focus is not None), "over": len(over),
              "due": len(recurring) + len(cards)}
    return {
        "server_now": now.isoformat(),
        "date": on.isoformat(),
        "greeting": greeting(local.hour),
        "deck": deck(counts),
        "first_run": first_run,
        "attention": attention[:8],
        "figures": {
            "focus_minutes": today_minutes(owner, on),
            "tracked_seconds": tracked,
            "total_balance_cents": sum(a["balance_cents"] for a in accounts) if accounts else None,
            "training": training_summary(owner, on),  # [Stage 14] before then: {"streak_weeks": 0, "this_week": 0}
        },
        "notes": [note_dict(n) for n in Note.objects.for_user(owner)[:3]],
        "week": _week_strip(owner, on),
    }


def _week_strip(owner, on: date) -> list[dict]:
    """Focus minutes for the last 7 days, for the small chart."""
    from apps.focus.selectors import daily_minutes

    return [{**d, "is_today": d["date"] == on.isoformat()} for d in daily_minutes(owner, days=7, today=on)]
