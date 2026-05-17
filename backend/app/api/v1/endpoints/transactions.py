"""
Transaction endpoints — thin controllers.
No business logic here: validate input, call service, return response.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.db.client import get_anon_client
from app.db.repositories.transaction_repository import TransactionRepository
from app.models.transaction import TransactionPublic
from app.models.user import AuthenticatedUser
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _get_service(client=Depends(get_anon_client)) -> TransactionService:
    return TransactionService(TransactionRepository(client))


@router.get("/", response_model=list[TransactionPublic])
def list_transactions(
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    limit: int = Query(default=200, le=500),
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: TransactionService = Depends(_get_service),
) -> list[TransactionPublic]:
    return service.get_transactions(current_user.id, since=since, until=until, limit=limit)


@router.get("/summary/{year}/{month}")
def monthly_summary(
    year: int,
    month: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: TransactionService = Depends(_get_service),
) -> list[dict]:
    return service.get_monthly_summary(current_user.id, year, month)
