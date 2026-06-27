"""
Ingestion pipeline — obtiene el TokenVault, construye los conectores,
corre la ingesta, y persiste los resultados.
Un fallo en un conector NO detiene los demás.
"""

import os
import sys
from uuid import UUID

from app.config import get_settings
from app.core.encryption import EncryptionService
from app.core.logging import configure_logging, get_logger
from app.core.token_vault import TokenVault
from app.db.client import get_admin_client
from app.db.repositories.transaction_repository import TransactionRepository
from app.services.transaction_service import TransactionService
from ingestion.base_connector import BaseConnector
from ingestion.connectors.gmail_connector import GmailConnector
from ingestion.connectors.mercadopago_connector import MercadoPagoConnector

_logger = get_logger(__name__)


def build_connectors(vault: TokenVault, user_id: UUID,
                     days_back: int = 180) -> list[BaseConnector]:
    return [
        GmailConnector(vault=vault, user_id=user_id, days_back=days_back),
        MercadoPagoConnector(vault=vault, user_id=user_id),
    ]


def run_pipeline(user_id: UUID, days_back: int = 180) -> dict[str, int]:
    settings = get_settings()
    configure_logging(settings.log_level)

    db = get_admin_client()
    encryption = EncryptionService.from_env()
    vault = TokenVault(db=db, encryption=encryption)
    service = TransactionService(TransactionRepository(db))
    connectors = build_connectors(vault, user_id, days_back=days_back)

    results: dict[str, int] = {}

    for connector in connectors:
        try:
            transactions = connector.fetch()
            for t in transactions:
                service.ingest(user_id, t)
            results[connector.source_name] = len(transactions)
            _logger.info("connector_success", source=connector.source_name, count=len(transactions))
        except Exception as exc:
            results[connector.source_name] = 0
            # Log only the exception TYPE, not the message — messages may contain PII.
            _logger.error("connector_failed", source=connector.source_name, error=type(exc).__name__)

    return results


if __name__ == "__main__":
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")

    user_id = UUID(os.environ["FINANCE_USER_ID"])
    summary = run_pipeline(user_id)
    _logger.info("pipeline_complete", summary=summary)
    sys.exit(0)
