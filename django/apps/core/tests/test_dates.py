import datetime as dt

from apps.core.dates import add_months, iso_week, parse_date, parse_iso_week, week_start


def test_add_months_clamps() -> None:
    assert add_months(dt.date(2026, 1, 31), 1) == dt.date(2026, 2, 28)
    assert add_months(dt.date(2026, 11, 15), 2) == dt.date(2027, 1, 15)
    assert add_months(dt.date(2026, 3, 31), -1) == dt.date(2026, 2, 28)


def test_weeks_round_trip() -> None:
    monday = week_start(dt.date(2026, 11, 18))
    assert monday == dt.date(2026, 11, 16)
    assert parse_iso_week(iso_week(monday)) == monday


def test_parse_date_rejects_junk() -> None:
    assert parse_date("nope") is None
    assert parse_date("2026-11-18") == dt.date(2026, 11, 18)
