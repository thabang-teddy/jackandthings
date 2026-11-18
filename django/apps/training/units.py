"""Weights and measures without floats. kg are stored ×10, body weight in grams, tape in mm."""
from __future__ import annotations

import re

_ONE_DECIMAL = re.compile(r"(?P<whole>\d{1,4})(?:[.,](?P<frac>\d))?")
_THREE_DECIMALS = re.compile(r"(?P<whole>\d{1,3})(?:[.,](?P<frac>\d{1,3}))?")


class UnitError(ValueError):
    pass


def parse_kg_x10(text: str) -> int:
    """'77,5' → 775; '80' → 800. At most one decimal."""
    m = _ONE_DECIMAL.fullmatch(str(text).strip().lower().removesuffix("kg").strip())
    if m is None:
        raise UnitError("Enter kg like 77,5")
    return int(m["whole"]) * 10 + int(m["frac"] or 0)


def format_kg_x10(value: int) -> str:
    whole, tenth = divmod(value, 10)
    return f"{whole},{tenth}" if tenth else str(whole)


def parse_kg_to_g(text: str) -> int:
    """Body weight: '82,35' → 82350 g."""
    m = _THREE_DECIMALS.fullmatch(str(text).strip().lower().removesuffix("kg").strip())
    if m is None:
        raise UnitError("Enter kg like 82,4")
    return int(m["whole"]) * 1000 + int((m["frac"] or "0").ljust(3, "0"))


def parse_cm_to_mm(text: str) -> int:
    """Tape: '84,5' → 845 mm."""
    m = _ONE_DECIMAL.fullmatch(str(text).strip().lower().removesuffix("cm").strip())
    if m is None:
        raise UnitError("Enter cm like 84,5")
    return int(m["whole"]) * 10 + int(m["frac"] or 0)


def e1rm_x10(kg_x10: int, reps: int) -> int:
    """Epley estimate of a one-rep max, still ×10: kg × (1 + reps/30), done in integers."""
    if reps <= 0 or kg_x10 <= 0:
        return 0
    if reps == 1:
        return kg_x10
    return (kg_x10 * (30 + reps) + 15) // 30  # +15 rounds to nearest
