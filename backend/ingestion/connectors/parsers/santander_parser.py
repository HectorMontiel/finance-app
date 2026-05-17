"""
Parser de emails HTML de Santander México.
Maneja CUATRO formatos distintos de notificación:

  Formato A (Pago/Compra principal):
    "compra en el comercio OXXO con tu tarjeta de TDC terminación **8518,
     por un monto de $56.50 MXN. El 14/05/2026 a las 14:35:14 hrs."

  Formato B (Autorización por encima del límite):
    "Autorizamos tu compra por $3,000.00 con tu Tarjeta de Crédito
     terminación **8518 y has llegado al límite de tu crédito.
     Establecimiento: REST BAR FAUNO. Fecha: 09/05/2026."

  Formato C (Tu compra ha sido registrada / cashback):
    "se autorizó una compra con tu tarjeta de crédito terminación: 8518 .
     Monto: $120.00 MXN Comercio: REST BAR FAUNO
     Fecha y hora: 09/05/2026 02:04:15 hrs"

  Formato D (fallback genérico):
    Cualquier email que contenga "$XX.XX MXN" y un comercio reconocible.
"""

import hashlib
import html
import re
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.models.transaction import TransactionCreate, TransactionSource

_logger = get_logger(__name__)

# ── Formato A (Pago/Compra original) ─────────────────────────────────────── #
_A_COMERCIO = re.compile(
    r"comercio\s+(.+?)\s+con\s+tu\s+tarjeta",
    re.IGNORECASE,
)
_A_MONTO = re.compile(
    r"monto\s+de\s+\$\s*([\d,]+(?:\.\d{2})?)\s*MXN",
    re.IGNORECASE,
)
_A_FECHA = re.compile(
    r"El\s+(\d{2}/\d{2}/\d{4})\s+a\s+las",
    re.IGNORECASE,
)

# ── Formato B (Autorización por encima del límite) ───────────────────────── #
# "Autorizamos tu compra por $3,000.00 con tu Tarjeta de Crédito terminación **8518"
# "Establecimiento: REST BAR FAUNO. Fecha: 09/05/2026."
_B_MONTO = re.compile(
    r"compra\s+por\s+\$\s*([\d,]+(?:\.\d{2})?)",
    re.IGNORECASE,
)
_B_COMERCIO = re.compile(
    r"Establecimiento:\s+(.+?)\.",
    re.IGNORECASE,
)
_B_FECHA = re.compile(
    r"Fecha:\s+(\d{2}/\d{2}/\d{4})",
    re.IGNORECASE,
)

# ── Formato C (Tu compra ha sido registrada / cashback) ──────────────────── #
# "Monto: $120.00 MXN Comercio: REST BAR FAUNO Fecha y hora: 09/05/2026"
_C_MONTO = re.compile(
    r"Monto:\s+\$\s*([\d,]+(?:\.\d{2})?)\s*MXN",
    re.IGNORECASE,
)
_C_COMERCIO = re.compile(
    r"Comercio:\s+(.+?)\s+Fecha",
    re.IGNORECASE,
)
_C_FECHA = re.compile(
    r"Fecha\s+y\s+hora:\s+(\d{2}/\d{2}/\d{4})",
    re.IGNORECASE,
)

# ── Formato D (fallback genérico) ────────────────────────────────────────── #
_D_MONTO = re.compile(
    r"\$\s*([\d,]+\.\d{2})\s*MXN",
    re.IGNORECASE,
)
_D_COMERCIO = re.compile(
    r"(?:en\s+(?:el\s+)?(?:establecimiento|comercio|negocio|lugar)?\s*)(.{3,50}?)\s+(?:con\s+tu|terminaci[oó]n|\*{2,}|\d{4})",
    re.IGNORECASE,
)

# ── Shared patterns ──────────────────────────────────────────────────────── #
# Handles: "terminación **8518", "terminación: 8518", "tarjeta ****8518"
_TARJETA = re.compile(
    r"terminaci[oó]n\s*[:\s*]+\s*(\d{4})|tarjeta\s+\*{4}(\d{4})",
    re.IGNORECASE,
)
_STRIP_TAGS  = re.compile(r"<[^>]+>")
_STYLE_BLOCK = re.compile(r"<(style|script)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)


class SantanderEmailParser:
    def parse(self, raw_body: str, message_id: str) -> TransactionCreate | None:
        text = self._to_text(raw_body)

        # Skip cashback-earned notifications (different from purchase notifications
        # that happen to mention cashback eligibility).
        # "ganarás $X de cashback" = confirmed cashback credit, NOT a spend transaction.
        if re.search(r"ganar[aá]s\b.{0,60}cashback", text, re.IGNORECASE):
            _logger.info("santander_skipped_cashback", message_id=message_id)
            return None

        comercio: str | None = None
        monto_str: str | None = None
        fecha_str: str | None = None

        # ── Try Format A (Pago/Compra: "en el comercio X ... monto de $Y MXN") ─ #
        m_comercio_a = _A_COMERCIO.search(text)
        m_monto_a    = _A_MONTO.search(text)
        if m_comercio_a and m_monto_a:
            comercio  = m_comercio_a.group(1).strip()
            monto_str = m_monto_a.group(1).strip()
            m_fecha   = _A_FECHA.search(text)
            fecha_str = m_fecha.group(1) if m_fecha else None

        # ── Try Format B (Overlimit: "compra por $X ... Establecimiento: Y") ──── #
        if not (comercio and monto_str):
            m_monto_b    = _B_MONTO.search(text)
            m_comercio_b = _B_COMERCIO.search(text)
            if m_monto_b and m_comercio_b:
                comercio  = m_comercio_b.group(1).strip()
                monto_str = m_monto_b.group(1).strip()
                m_fecha   = _B_FECHA.search(text)
                fecha_str = m_fecha.group(1) if m_fecha else None

        # ── Try Format C (Cashback: "Monto: $X MXN Comercio: Y Fecha y hora:") ── #
        if not (comercio and monto_str):
            m_monto_c    = _C_MONTO.search(text)
            m_comercio_c = _C_COMERCIO.search(text)
            if m_monto_c and m_comercio_c:
                comercio  = m_comercio_c.group(1).strip()
                monto_str = m_monto_c.group(1).strip()
                m_fecha   = _C_FECHA.search(text)
                fecha_str = m_fecha.group(1) if m_fecha else None

        # ── Format D fallback: any "$X.XX MXN" in text ──────────────────────── #
        if not monto_str:
            m = _D_MONTO.search(text)
            monto_str = m.group(1) if m else None
        if not comercio:
            m = _D_COMERCIO.search(text)
            comercio = m.group(1).strip() if m else None

        if not comercio or not monto_str:
            _logger.warning("santander_parse_failed", message_id=message_id,
                            preview=text[:120])
            return None

        try:
            monto = float(monto_str.replace(",", ""))
        except ValueError:
            return None

        # Skip implausible amounts (transfers / promotional emails)
        if monto > 50_000 or monto < 1:
            _logger.info("santander_skipped_amount", monto=monto,
                         message_id=message_id)
            return None

        fecha = self._parse_date(fecha_str)

        # Extract card ending — check both capture groups
        tarjeta = None
        m = _TARJETA.search(text)
        if m:
            tarjeta = m.group(1) or m.group(2)

        concepto = comercio.strip().upper()
        if tarjeta:
            concepto = f"{concepto} ****{tarjeta}"

        # Build a content-based fingerprint so that when Santander sends two
        # notifications for the same transaction (e.g. "Autorizamos tu compra"
        # + "Tu compra ha sido registrada"), both emails resolve to the same
        # raw_id and the upsert silently ignores the second one.
        fecha_date = fecha.strftime("%Y-%m-%d")
        content_key = f"santander:{fecha_date}:{monto:.2f}:{concepto}"
        fingerprint = hashlib.sha256(content_key.encode()).hexdigest()

        return TransactionCreate(
            fecha=fecha,
            monto=monto,
            concepto=concepto,
            fuente=TransactionSource.SANTANDER,
            raw_fingerprint=fingerprint,
        )

    # ── Helpers ──────────────────────────────────────────────────────────── #
    @staticmethod
    def _to_text(raw: str) -> str:
        raw = _STYLE_BLOCK.sub(" ", raw)
        raw = _STRIP_TAGS.sub(" ", raw)
        raw = html.unescape(raw)
        return re.sub(r"\s+", " ", raw).strip()

    @staticmethod
    def _parse_date(fecha_str: str | None) -> datetime:
        if fecha_str:
            try:
                return datetime.strptime(fecha_str, "%d/%m/%Y").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                pass
        return datetime.now(tz=timezone.utc)
