"""
Transaction service — orchestrates categorization + persistence.
Endpoints call this; this calls the repository.
"""

from datetime import datetime
from uuid import UUID

from app.db.repositories.transaction_repository import TransactionRepository
from app.models.transaction import TransactionCreate, TransactionDB, TransactionPublic
from app.services.categorizer import categorize


class TransactionService:
    def __init__(self, repo: TransactionRepository) -> None:
        self._repo = repo

    def ingest(self, user_id: UUID, transaction: TransactionCreate) -> None:
        categoria = categorize(transaction.concepto)
        self._repo.upsert(user_id, transaction, categoria.value)

    def get_transactions(
        self,
        user_id: UUID,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
        limit: int = 200,
    ) -> list[TransactionPublic]:
        rows: list[TransactionDB] = self._repo.list_by_user(
            user_id, since=since, until=until, limit=limit
        )
        return [TransactionPublic.model_validate(row) for row in rows]

    def get_monthly_summary(self, user_id: UUID, year: int, month: int) -> list[dict]:
        return self._repo.monthly_summary(user_id, year, month)
