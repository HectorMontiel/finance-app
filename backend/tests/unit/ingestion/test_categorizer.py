import pytest
from app.services.categorizer import categorize
from app.models.transaction import TransactionCategory


@pytest.mark.parametrize("concepto,expected", [
    ("UBER TRIP", TransactionCategory.TRANSPORT),
    ("McDONALDS PERISUR", TransactionCategory.FOOD),
    ("NETFLIX.COM", TransactionCategory.ENTERTAINMENT),
    ("FARMACIA DEL AHORRO", TransactionCategory.HEALTH),
    ("TELMEX RECARGA", TransactionCategory.UTILITIES),
    ("AMAZON.COM.MX", TransactionCategory.SHOPPING),
    ("SPEI TRANSFERENCIA", TransactionCategory.TRANSFER),
    ("RANDOM MERCHANT XYZ", TransactionCategory.OTHER),
])
def test_categorize(concepto: str, expected: TransactionCategory):
    assert categorize(concepto) == expected
