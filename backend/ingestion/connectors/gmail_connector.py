"""
Gmail connector usando OAuth2.
Los tokens se leen DESENCRIPTADOS del TokenVault en memoria,
se usan para la llamada a la API, y se descartan.
El token.json nunca toca el disco en producción — vive encriptado en Supabase.

Flujo de token en producción:
  1. oauth2_setup.py genera token.json localmente.
  2. vault_setup.py lee token.json y lo guarda encriptado en token_vault.
  3. Este conector lee el blob encriptado, lo desencripta en RAM, lo usa y lo olvida.
  4. Después del refresh, el token actualizado se re-encripta y se vuelve a guardar.
"""

import base64
import json
from uuid import UUID

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.logging import get_logger
from app.core.token_vault import TokenVault
from app.models.transaction import TransactionCreate, TransactionSource
from ingestion.base_connector import BaseConnector
from ingestion.connectors.parsers.santander_parser import SantanderEmailParser

_logger = get_logger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
_SUBJECT_FILTER = (
    '(subject:"Pago/Compra" OR subject:"Tu compra ha sido registrada" '
    'OR subject:"Autorización por encima del límite")'
)
_VAULT_SERVICE_KEY = "gmail_oauth2"
_DEFAULT_DAYS_BACK = 180


def _build_query(days_back: int) -> str:
    return f'from:santander newer_than:{days_back}d {_SUBJECT_FILTER}'


class GmailConnector(BaseConnector):
    """Fetches Santander emails. Tokens never touch disk in production."""

    def __init__(self, vault: TokenVault, user_id: UUID,
                 days_back: int = _DEFAULT_DAYS_BACK) -> None:
        self._vault = vault
        self._user_id = user_id
        self._days_back = days_back
        self._parser = SantanderEmailParser()

    @property
    def source_name(self) -> str:
        return TransactionSource.SANTANDER.value

    def fetch(self) -> list[TransactionCreate]:
        service = self._build_service()
        query = _build_query(self._days_back)
        messages = self._search_messages(service, query)
        _logger.info("gmail_messages_found", count=len(messages), days_back=self._days_back)

        transactions = []
        for stub in messages:
            body = self._get_message_body(service, stub["id"])
            parsed = self._parser.parse(body, stub["id"])
            if parsed:
                transactions.append(parsed)

        _logger.info("gmail_transactions_parsed", count=len(transactions))
        return transactions

    # ------------------------------------------------------------------ #
    #  Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _build_service(self):
        creds = self._load_and_refresh_credentials()
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    def _load_and_refresh_credentials(self) -> Credentials:
        # Decrypt token from vault — plaintext exists only in this stack frame.
        token_json = self._vault.retrieve(self._user_id, _VAULT_SERVICE_KEY)
        creds = Credentials.from_authorized_user_info(json.loads(token_json), _SCOPES)

        if creds.expired and creds.refresh_token:
            _logger.info("gmail_token_refreshing")
            creds.refresh(Request())
            # Re-encrypt the refreshed token and persist it.
            self._vault.store(self._user_id, _VAULT_SERVICE_KEY, creds.to_json())

        return creds

    def _search_messages(self, service, query: str) -> list[dict]:
        """Fetch all matching message stubs (handles pagination)."""
        messages: list[dict] = []
        request = service.users().messages().list(userId="me", q=query, maxResults=500)
        while request is not None:
            result = request.execute()
            messages.extend(result.get("messages", []))
            request = service.users().messages().list_next(request, result)
        return messages

    def _get_message_body(self, service, message_id: str) -> str:
        msg = service.users().messages().get(
            userId="me", id=message_id, format="full"
        ).execute()

        for part in msg.get("payload", {}).get("parts", []):
            if part.get("mimeType") == "text/plain":
                data = part["body"].get("data", "")
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

        data = msg.get("payload", {}).get("body", {}).get("data", "")
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
