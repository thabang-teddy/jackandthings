import pytest

from apps.training.units import UnitError, e1rm_x10, format_kg_x10, parse_cm_to_mm, parse_kg_to_g, parse_kg_x10


@pytest.mark.parametrize(("text", "value"), [("77,5", 775), ("77.5", 775), ("80", 800), ("80 kg", 800)])
def test_parse_kg(text, value):
    assert parse_kg_x10(text) == value


@pytest.mark.parametrize("text", ["", "abc", "77,55", "-5"])
def test_parse_kg_invalid(text):
    with pytest.raises(UnitError):
        parse_kg_x10(text)


def test_other_units():
    assert format_kg_x10(775) == "77,5" and format_kg_x10(800) == "80"
    assert parse_kg_to_g("82,35") == 82350
    assert parse_cm_to_mm("84,5") == 845


def test_epley():
    assert e1rm_x10(1000, 1) == 1000
    assert e1rm_x10(1000, 5) == 1167  # 100 kg × 5 ≈ 116,7 kg
