"""
Mercado Pago connector — fetches all approved purchases for the last 180 days.

Design decisions vs. the original skeleton:
  ┌─ Pagination  ── MP /v1/payments/search caps at 100 results per call.
  │                 We page until offset >= total (uses paging.total field).
  ├─ Date window ── 180 days, same as Gmail/Santander, for complete history.
  ├─ Fingerprint ── Uses MP's own payment_id (globally unique, immutable).
  │                 No content-based hash needed; MP never duplicates IDs.
  ├─ Concepto    ── Priority chain: description → additional_info.items[0].title
  │                 → payment_method_id → "MP".  Normalised UPPERCASE ≤60 chars.
  ├─ Date safety ── Falls back date_approved → date_last_updated → date_created.
  ├─ Amount guard── Same thresholds as Santander: $1 – $50 000 MXN.
  └─ Op filtering── Skips account_fund (deposits), recurring_collection (seller),
                    and any negative / zero amounts.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx

from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger
from app.core.token_vault import TokenVault
from app.models.transaction import TransactionCreate, TransactionSource
from ingestion.base_connector import BaseConnector

_logger = get_logger(__name__)

_MP_BASE_URL        = "https://api.mercadopago.com"
_SEARCH_DAYS_BACK   = 180          # 6 months — mirrors Santander window
_PAGE_LIMIT         = 100          # MP maximum per request
_MIN_AMOUNT         = 1.0
_MAX_AMOUNT         = 50_000.0
_VAULT_SERVICE_KEY  = "mercadopago"

# These operation types represent money COMING IN or platform-internal events,
# NOT the user spending money — skip them.
_SKIP_OP_TYPES = frozenset({
    "account_fund",                  # wallet top-up (incoming)
    "recurring_payment_collection",  # user is the seller
    "pos_transfer",                  # internal MP transfer
})


class MercadoPagoConnector(BaseConnector):

    def __init__(self, vault: TokenVault, user_id: UUID) -> None:
        self._vault   = vault
        self._user_id = user_id

    @property
    def source_name(self) -> str:
        return TransactionSource.MERCADO_PAGO.value

    # ── Public entry point ───────────────────────────────────────────────── #

    def fetch(self) -> list[TransactionCreate]:
        # Token decrypted in memory only — not stored as an instance attribute.
        access_token = self._vault.retrieve(self._user_id, _VAULT_SERVICE_KEY)
        raw = self._fetch_all_payments(access_token)
        _logger.info("mp_raw_payments_fetched", count=len(raw))

        transactions: list[TransactionCreate] = []
        skipped_op = skipped_amount = skipped_status = 0

        for p in raw:
            if p.get("status") != "approved":
                skipped_status += 1
                continue
            if p.get("operation_type") in _SKIP_OP_TYPES:
                skipped_op += 1
                continue
            tx = self._to_transaction(p)
            if tx is None:
                skipped_amount += 1
            else:
                transactions.append(tx)

        _logger.info(
            "mp_transactions_normalized",
            accepted=len(transactions),
            skipped_status=skipped_status,
            skipped_op=skipped_op,
            skipped_amount=skipped_amount,
        )
        return transactions

    # ── HTTP layer ───────────────────────────────────────────────────────── #

    def _fetch_all_payments(self, access_token: str) -> list[dict]:
        """Paginate through the full 180-day window."""
        since = (
            datetime.now(tz=timezone.utc) - timedelta(days=_SEARCH_DAYS_BACK)
        ).strftime("%Y-%m-%dT00:00:00.000-00:00")

        headers = {"Authorization": f"Bearer {access_token}"}
        results: list[dict] = []
        offset = 0

        while True:
            try:
                resp = httpx.get(
                    f"{_MP_BASE_URL}/v1/payments/search",
                    headers=headers,
                    params={
                        "begin_date": since,
                        "sort":       "date_created",
                        "criteria":   "desc",
                        "limit":      _PAGE_LIMIT,
                        "offset":     offset,
                    },
                    timeout=25,
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ExternalServiceError(
                    "mercadopago", detail=str(exc)) from exc
            except httpx.RequestError as exc:
                raise ExternalServiceError(
                    "mercadopago", detail=str(exc)) from exc

            body   = resp.json()
            page   = body.get("results", [])
            results.extend(page)

            paging = body.get("paging", {})
            total  = paging.get("total", 0)
            offset += len(page)

            _logger.debug("mp_page_fetched",
                          offset=offset, total=total, page_size=len(page))

            if not page or offset >= total:
                break   # all pages consumed

        return results

    # ── Normalisation ────────────────────────────────────────────────────── #

    def _to_transaction(self, payment: dict) -> TransactionCreate | None:
        amount = abs(float(payment.get("transaction_amount") or 0))
        if not (_MIN_AMOUNT <= amount <= _MAX_AMOUNT):
            _logger.info("mp_skipped_amount",
                         amount=amount, payment_id=payment.get("id"))
            return None

        return TransactionCreate(
            fecha           = self._extract_date(payment),
            monto           = amount,
            concepto        = self._extract_concepto(payment),
            fuente          = TransactionSource.MERCADO_PAGO,
            # MP payment IDs are globally unique and immutable — use directly.
            raw_fingerprint = str(payment["id"]),
        )

    @staticmethod
    def _extract_concepto(payment: dict) -> str:
        """
        Priority chain for merchant/product name:
          1. payment.description             — free-text set by the seller
          2. additional_info.items[0].title  — line item title (e-commerce)
          3. payment_method_id               — "visa", "debito", "account_money"
          4. "MP"                            — last-resort fallback
        """
        _JUNK = {"", "none", "null", "-", "payment", "pago", "compra"}

        desc = (payment.get("description") or "").strip()
        if desc.lower() in _JUNK:
            items = (payment.get("additional_info") or {}).get("items") or []
            if items:
                desc = (items[0].get("title") or "").strip()

        if not desc or desc.lower() in _JUNK:
            desc = (payment.get("payment_method_id") or "MP").upper()

        return desc.upper()[:60].strip()

    @staticmethod
    def _extract_date(payment: dict) -> datetime:
        """
        Falls back through three fields so we always get a valid datetime.
        MP sometimes leaves date_approved null for instant-approval flows.
        """
        for field in ("date_approved", "date_last_updated", "date_created"):
            raw = (payment.get(field) or "").strip()
            if raw:
                try:
                    return datetime.fromisoformat(raw.replace("Z", "+00:00"))
                except ValueError:
                    continue
        return datetime.now(tz=timezone.utc)
