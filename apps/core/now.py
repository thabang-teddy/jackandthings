"""The Now line: what's live, what's broken, what's due — on every signed-in page.

Imported by the share middleware. It imports the apps lazily (inside the function), so `core`
doesn't depend on the apps at import time and there are no circular imports.
Budget: ≤ 5 small queries — it runs on every page.
"""
from __future__ import annotations

from django.utils import timezone


def now_payload(user) -> dict | None:
    if not getattr(user, "is_authenticated", False):
        return None
    from apps.focus.selectors import now_item as focus_now
    from apps.money.selectors import alerts as money_alerts  # [Stage 10]
    from apps.projects.selectors import due_soon
    from apps.projects.services import running_entry

    now, today = timezone.now(), timezone.localdate()

    entry = running_entry(user)
    timer = None if entry is None else {
        "card_id": entry.card_id, "title": entry.card.title, "project": entry.card.project.name,
        "started_at": entry.started_at.isoformat(), "paused_seconds": entry.paused_seconds,
        "paused_at": entry.paused_at.isoformat() if entry.paused_at else None}

    alerts = money_alerts(user, today)  # [Stage 10] before then: alerts = []. Over cap → "over"; recurring due → "overdue"/"due"
    for card in due_soon(user, today, days=0):  # cards due today or overdue
        alerts.append({"kind": "overdue" if card.due_date < today else "due",
                       "text": f"{card.title} {'overdue' if card.due_date < today else 'due today'}",
                       "href": f"/projects/cards/{card.pk}/"})
    order = {"over": 0, "overdue": 1, "due": 2}  # live first (timer, focus), then broken, then due
    alerts.sort(key=lambda a: order[a["kind"]])
    return {"server_now": now.isoformat(), "timer": timer, "focus": focus_now(user, now), "alerts": alerts[:4]}
