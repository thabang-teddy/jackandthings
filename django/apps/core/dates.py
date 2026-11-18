"""Date helpers. All 'which day was this?' questions use the app time zone (Africa/Johannesburg)."""
from __future__ import annotations

import datetime as dt

from django.utils import timezone


def local_now() -> dt.datetime:
    return timezone.localtime()


def local_today() -> dt.date:
    return timezone.localdate()


def local_date_of(moment: dt.datetime) -> dt.date:
    return timezone.localtime(moment).date()


def start_of_day(day: dt.date) -> dt.datetime:
    """Aware datetime at 00:00 local time on `day`."""
    return timezone.make_aware(dt.datetime.combine(day, dt.time.min))


def week_start(day: dt.date) -> dt.date:
    """Monday of the ISO week containing `day`."""
    return day - dt.timedelta(days=day.weekday())


def month_start(day: dt.date) -> dt.date:
    return day.replace(day=1)


def add_months(day: dt.date, months: int) -> dt.date:
    """Same day-of-month `months` later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb)."""
    import calendar

    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    last = calendar.monthrange(year, month)[1]
    return dt.date(year, month, min(day.day, last))


def parse_date(text: str | None) -> dt.date | None:
    """'2026-11-18' → date; anything else → None."""
    if not text:
        return None
    try:
        return dt.date.fromisoformat(str(text)[:10])
    except ValueError:
        return None


def parse_iso_week(text: str | None) -> dt.date | None:
    """'2026-W47' → Monday of that week."""
    if not text:
        return None
    try:
        return dt.datetime.strptime(f"{text}-1", "%G-W%V-%u").date()
    except ValueError:
        return None


def iso_week(day: dt.date) -> str:
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"
