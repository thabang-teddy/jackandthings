from datetime import date, timedelta

from django.db.models import Sum
from django.utils import timezone

from .models import Session
from .services import remaining_seconds


def running(owner):
    return Session.objects.filter(running_key=owner.pk).select_related("preset").first()


def daily_minutes(owner, days: int = 7, today: date | None = None) -> list[dict]:
    today = today or timezone.localdate()
    start = today - timedelta(days=days - 1)
    rows = (Session.objects.for_user(owner)
            .filter(phase="focus", local_date__gte=start, completed=True)
            .values("local_date").annotate(seconds=Sum("planned_seconds")))  # GROUP BY local_date
    totals = {r["local_date"]: r["seconds"] // 60 for r in rows}
    return [{"date": (start + timedelta(d)).isoformat(), "minutes": totals.get(start + timedelta(d), 0)}
            for d in range(days)]


def streak_text(minutes_per_day: list[dict]) -> str:
    active = sum(1 for d in minutes_per_day if d["minutes"] > 0)
    return f"{active} of {len(minutes_per_day)} days"


def session_dict(s: Session, now) -> dict:
    return {"id": s.pk, "phase": s.phase, "tag": s.tag, "cycle_index": s.cycle_index,
            "started_at": s.started_at.isoformat(), "planned_seconds": s.planned_seconds,
            "paused_at": s.paused_at.isoformat() if s.paused_at else None,
            "paused_seconds": s.paused_seconds, "remaining_seconds": remaining_seconds(s, now),
            "preset": s.preset.name if s.preset else None}


# --- Added for the views ---------------------------------------------------------------------


def preset_dict(p) -> dict:
    return {"id": p.pk, "name": p.name, "focus_min": p.focus_min, "short_min": p.short_min,
            "long_min": p.long_min, "long_every": p.long_every, "auto_start": p.auto_start,
            "sound": p.sound, "strict": p.strict, "is_default": p.is_default}


def presets(owner) -> list[dict]:
    from .models import Preset

    return [preset_dict(p) for p in Preset.objects.for_user(owner).order_by("-is_default", "name")]


def today_minutes(owner, today: date | None = None) -> int:
    return daily_minutes(owner, days=1, today=today)[0]["minutes"]


def history_row(s: Session) -> dict:
    minutes = (s.planned_seconds if s.completed else
               max(0, int(((s.ended_at or s.started_at) - s.started_at).total_seconds()) - s.paused_seconds)) // 60
    return {"id": s.pk, "phase": s.phase, "tag": s.tag, "started_at": s.started_at.isoformat(),
            "minutes": minutes, "completed": s.completed, "preset": s.preset.name if s.preset else None}


def history(owner):
    return Session.objects.for_user(owner).filter(running_key__isnull=True).select_related("preset")


def stats(owner, days: int = 7) -> dict:
    per_day = daily_minutes(owner, days=days)
    by_tag = (Session.objects.for_user(owner)
              .filter(phase="focus", completed=True,
                      local_date__gte=timezone.localdate() - timedelta(days=days - 1))
              .values("tag").annotate(seconds=Sum("planned_seconds")).order_by("-seconds"))
    total = sum(d["minutes"] for d in per_day)
    return {
        "days": days,
        "per_day": per_day,
        "total_minutes": total,
        "average_minutes": total // days if days else 0,
        "streak": streak_text(per_day),
        "by_tag": [{"tag": r["tag"] or "Untagged", "minutes": r["seconds"] // 60} for r in by_tag],
    }


def now_item(owner, now) -> dict | None:
    """For the Now line (apps/core/now.py)."""
    s = running(owner)
    if s is None:
        return None
    return {"phase": s.phase, "tag": s.tag, "remaining_seconds": remaining_seconds(s, now),
            "paused": s.paused_at is not None,
            "ends_at": (now + timedelta(seconds=remaining_seconds(s, now))).isoformat()}
