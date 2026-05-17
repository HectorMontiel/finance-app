"""
Transaction repository — all database I/O lives here.
Business logic never calls Supabase directly; it calls this class.
That makes the service layer testable without a real database.
"""

from datetime import datetime
from uuid import UUID

from supabase import Client

from app.core.exceptions import DuplicateTransactionError, ExternalServiceError
from app.core.logging import get_logger
from app.models.transaction import TransactionCreate, TransactionDB

_logger = get_logger(__name__)

_TABLE = "transacciones"


class TransactionRepository:
    def __init__(self, client: Client) -> None:
        self._db = client

    def upsert(self, user_id: UUID, transaction: TransactionCreate, categoria: str) -> None:
        """
        Insert or ignore on conflict (raw_id is the dedup key).
        Never raises on duplicate — the pipeline moves on silently.
        """
        row = {
            "user_id": str(user_id),
            "fecha": transaction.fecha.isoformat(),
            "monto": float(transaction.monto),
            "concepto": transaction.concepto,
            "fuente": transaction.fuente.value,
            "categoria": categoria,
            "raw_id": transaction.raw_id,
        }
        try:
            self._db.schema("finanzas").table(_TABLE).upsert(row, on_conflict="raw_id").execute()
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

    def list_by_user(
        self,
        user_id: UUID,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
        limit: int = 200,
    ) -> list[TransactionDB]:
        query = (
            self._db.schema("finanzas").table(_TABLE)
            .select("*")
            .eq("user_id", str(user_id))
            .order("fecha", desc=True)
            .limit(limit)
        )
        if since:
            query = query.gte("fecha", since.isoformat())
        if until:
            query = query.lte("fecha", until.isoformat())

        try:
            response = query.execute()
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

        return [TransactionDB(**row) for row in response.data]

    def monthly_summary(self, user_id: UUID, year: int, month: int) -> list[dict]:
        """Aggregated spend per category for a given month."""
        try:
            response = (
                self._db.rpc(
                    "monthly_category_summary",
                    {"p_user_id": str(user_id), "p_year": year, "p_month": month},
                )
                .execute()
            )
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

        return response.data
