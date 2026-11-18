import pytest

from apps.core.money import MoneyError, cents_to_csv, format_zar, parse_positive_zar, parse_zar


@pytest.mark.parametrize(
    ("text", "cents"),
    [("46,50", 4650), ("46.50", 4650), ("R 1 234,56", 123456), ("12,5", 1250),
     ("1234", 123400), ("-46,50", -4650), ("R 1 000,00", 100000)],
)
def test_parse_valid(text: str, cents: int) -> None:
    assert parse_zar(text) == cents


@pytest.mark.parametrize("text", ["", "abc", "1.234,5", "12,345", "R", "1 23,00"])
def test_parse_invalid(text: str) -> None:
    with pytest.raises(MoneyError):
        parse_zar(text)


def test_positive_rejects_zero_and_negative() -> None:
    for text in ["0", "-1"]:
        with pytest.raises(MoneyError):
            parse_positive_zar(text)


def test_format() -> None:
    assert format_zar(4650) == "R 46,50"
    assert format_zar(-123456) == "−R 1 234,56"
    assert format_zar(0) == "R 0,00"


def test_csv() -> None:
    assert cents_to_csv(4650) == "46.50"
    assert cents_to_csv(-5) == "-0.05"
