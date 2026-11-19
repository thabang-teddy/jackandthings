"""Rand helpers. Every amount in Jack & Things is an integer number of cents.

R 46,50 is stored as 4650. Never use float for money.
"""
from __future__ import annotations

import re

NBSP = " "
_AMOUNT = re.compile(
    r"(?P<sign>[-−]?)"               # optional minus (hyphen or true minus)
    r"(?P<whole>\d{1,3}(?: \d{3})+|\d+)"  # 1 234 567 or 1234567
    r"(?:[.,](?P<frac>\d{1,2}))?"         # ,5 or ,50 or .50
)


class MoneyError(ValueError):
    """Raised when text can't be read as a rand amount."""


def parse_zar(text: str) -> int:
    """Turn user input like '46,50', 'R 1 234,56' or '-12.5' into cents."""
    cleaned = str(text).strip().replace(NBSP, " ").replace(" ", " ")
    if cleaned[:1] in {"R", "r"}:
        cleaned = cleaned[1:].strip()
    match = _AMOUNT.fullmatch(cleaned)
    if match is None:
        raise MoneyError("Enter an amount like 46,50")
    whole = int(match["whole"].replace(" ", ""))
    frac = (match["frac"] or "0").ljust(2, "0")
    cents = whole * 100 + int(frac)
    return -cents if match["sign"] else cents


def parse_positive_zar(text: str) -> int:
    """Like parse_zar, but the amount must be more than zero."""
    cents = parse_zar(text)
    if cents <= 0:
        raise MoneyError("Enter an amount more than R 0,00")
    return cents


def format_zar(cents: int) -> str:
    """4650 -> 'R 46,50'; -123456 -> '−R 1 234,56' (non-breaking spaces, en-ZA)."""
    sign = "−" if cents < 0 else ""
    rands, rest = divmod(abs(cents), 100)
    whole = f"{rands:,}".replace(",", NBSP)
    return f"{sign}R{NBSP}{whole},{rest:02d}"


def cents_to_csv(cents: int) -> str:
    """4650 -> '46.50'; -5 -> '-0.05'. Plain dot decimal, for spreadsheets."""
    sign = "-" if cents < 0 else ""
    rands, rest = divmod(abs(cents), 100)
    return f"{sign}{rands}.{rest:02d}"
