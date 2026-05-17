"""
Pydantic models for the transaction domain.
Three shapes: Create (inbound from ingestion), DB (persisted row), Public (API response).
Separating shapes prevents accidentally leaking internal fields to the API consumer.
"""

import hashlib
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, computed_field, field_validator


class TransactionSource(StrEnum):
    SANTANDER = "santander"
    MERCADO_PAGO = "mercado_pago"
    NU = "nu"
    RAPPICARD = "rappicard"


class TransactionCategory(StrEnum):
    FOOD = "food"
    TRANSPORT = "transport"
    ENTERTAINMENT = "entertainment"
    HEALTH = "health"
    UTILITIES = "utilities"
    SHOPPING = "shopping"
    TRANSFER = "transfer"
    OTHER = "other"


class TransactionCreate(BaseModel):
    fecha: datetime
    monto: Decimal = Field(gt=0, description="Always positive; sign lives in source")
    concepto: str = Field(min_length=1, max_length=500)
    fuente: TransactionSource
    raw_fingerprint: str = Field(
        description="Source-specific unique string; hashed to raw_id before insert"
    )

    @field_validator("concepto")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @computed_field
    @property
    def raw_id(self) -> str:
        """SHA-256 of the fingerprint — prevents duplicates without storing raw data."""
        return hashlib.sha256(self.raw_fingerprint.encode()).hexdigest()


class TransactionDB(BaseModel):
    id: UUID
    user_id: UUID
    fecha: datetime
    monto: Decimal
    concepto: str
    fuente: TransactionSource
    categoria: TransactionCategory
    raw_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionPublic(BaseModel):
    """Shape returned by the API — no internal IDs exposed."""
    id: UUID
    fecha: datetime
    monto: Decimal
    concepto: str
    fuente: TransactionSource
    categoria: TransactionCategory
