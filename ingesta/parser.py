"""
Lee los correos de Santander México y devuelve un movimiento por correo.

Tipos que entiende (asunto → tipo):
  «Pago/Compra con Tarjeta Santander»        → compra   (con hora, formato A)
  «Tu compra ha sido registrada» (cashback)  → compra   (con hora, formato C; duplica a A)
  «Autorización por encima del límite»       → compra   (sin hora, formato B; duplica a A)
  «Confirmación de transferencia»            → transferencia (sale de tu cuenta)
  «Has recibido un depósito»                 → deposito (entra a tu cuenta)
  «NOTIFICACION DE RETIRO SIN TARJETA EN ATM»→ retiro   (efectivo)

«Pago de tarjeta de crédito propias» no trae monto y es un movimiento entre tus
cuentas: no se cuenta.
"""

import html
import re
from dataclasses import dataclass, field, asdict

from ingesta.categorias import categorizar

_MONTO = r"\$\s*([\d,]+(?:\.\d{1,2})?)"


def _monto(s: str) -> float:
    return round(float(s.replace(",", "")), 2)


def _fecha(dmy: str) -> str:
    d, m, y = dmy.split("/")
    return f"{y}-{m}-{d}"


def a_texto(raw: str) -> str:
    raw = re.sub(r"<(style|script)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<br\s*/?>|</p>|</div>|</td>|</tr>", " ", raw, flags=re.I)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html.unescape(raw).replace("\xa0", " ")
    return re.sub(r"\s+", " ", raw).strip()


@dataclass
class Movimiento:
    id: str            # id del correo de Gmail
    f: str             # fecha YYYY-MM-DD
    m: float           # monto en pesos (siempre positivo)
    tipo: str          # compra | transferencia | deposito | retiro
    c: str             # comercio / destino / origen
    h: str = ""        # hora HH:MM si el correo la trae
    tj: str = ""       # terminación de tarjeta o cuenta
    cat: str = ""      # categoría automática
    fmt: str = ""      # A, B, C… (para quitar duplicados)
    extra: dict = field(default_factory=dict)

    def a_dict(self) -> dict:
        d = asdict(self)
        return {k: v for k, v in d.items() if v not in ("", {}, None)}


# ── Compras ───────────────────────────────────────────────────────────────── #
_A = re.compile(
    r"compra en el comercio\s+(?P<c>.+?)\s+con (?:tu|la) tarjeta(?: de \w+)?\s+terminaci[oó]n\s*\**\s*(?P<tj>\d{3,4})"
    r".{0,40}?monto de\s*" + _MONTO + r"\s*(?P<mon>MXN|USD|EUR|MXP)?"
    r".{0,20}?El\s+(?P<f>\d{2}/\d{2}/\d{4})(?:\s+a las\s+(?P<h>\d{1,2}:\d{2}))?",
    re.I,
)
_C = re.compile(
    r"terminaci[oó]n:?\s*\**\s*(?P<tj>\d{3,4})\s*\.?\s*Monto:\s*" + _MONTO + r"\s*(?P<mon>MXN|USD|EUR)?"
    r"\s*Comercio:\s*(?P<c>.+?)\s+Fecha y hora:\s*(?P<f>\d{2}/\d{2}/\d{4})\s+(?P<h>\d{1,2}:\d{2})",
    re.I,
)
# Formato C viejo (2025): «ganarás $16.32 MXN de cashback en tu Cuenta Santander 8518 $1,632.30 MXN
# COSTCO QUERETARO 02/11/2025 11:41:08 hrs». Es una compra, no un abono.
_C2 = re.compile(
    r"cashback en tu Cuenta Santander\s*(?P<tj>\d{3,4})\s*" + _MONTO + r"\s*(?P<mon>MXN|USD|EUR)?"
    r"\s*(?P<c>.+?)\s+(?P<f>\d{2}/\d{2}/\d{4})\s+(?P<h>\d{1,2}:\d{2})",
    re.I,
)
# Formato C de nómina (2024): «compra con tu tarjeta de débito terminación 4521 por $4,700.00 MXN en el
# comercio RAKATA QUERETARO, el 23 de 06 del 2024 a las 03:27:26 hrs»
_C3 = re.compile(
    r"compra con tu tarjeta de \w+ terminaci[oó]n:?\s*\**\s*(?P<tj>\d{3,4})\s+por\s*" + _MONTO
    + r"\s*(?P<mon>MXN|M\.N\.|USD|EUR)?\s+en el comercio\s+(?P<c>.+?),?\s+el\s+(?P<d>\d{1,2}) de (?P<mes>\d{1,2}) del (?P<a>\d{4})"
    r"(?:\s+a las\s+(?P<h>\d{1,2}:\d{2}))?",
    re.I,
)
_B = re.compile(
    r"compra por\s*" + _MONTO + r".{0,80}?terminaci[oó]n\s*\**\s*(?P<tj>\d{3,4})"
    r".*?Establecimiento:\s*(?P<c>.+?)\.\s*Fecha:\s*(?P<f>\d{2}/\d{2}/\d{4})",
    re.I,
)
# Formato viejo genérico: «...compra ... $X MXN ... comercio ... dd/mm/aaaa»
_D_MONTO = re.compile(_MONTO + r"\s*MXN", re.I)
_D_FECHA = re.compile(r"(\d{2}/\d{2}/\d{4})(?:\s+(?:a las\s+)?(\d{1,2}:\d{2}))?")
_D_TJ = re.compile(r"terminaci[oó]n:?\s*\**\s*(\d{3,4})", re.I)
_D_COMERCIO = re.compile(r"(?:comercio|establecimiento)[:\s]+(.{3,60}?)\s+(?:con tu|por un|Fecha|\.|,)", re.I)

# ── Transferencias, depósitos y retiros ───────────────────────────────────── #
_TRANSF = re.compile(
    r"transferencia de tu cuenta terminaci[oó]n\s*(?P<origen>\d+)\s+a la cuenta terminaci[oó]n\s*(?P<dest>\d+)"
    r"(?:\s+en\s+(?P<banco>.+?))?\s*\.\s*Detalles.*?Importe:\s*" + _MONTO + r"\s*MX[NP]?"
    r".*?Fecha:\s*(?P<f>\d{2}/\d{2}/\d{4})(?:\s*Hora:\s*(?P<h>\d{1,2}:\d{2}))?"
    r"(?:.*?Referencia:\s*(?P<ref>\S+))?",
    re.I,
)
_TRANSF_CONCEPTO = re.compile(r"Concepto(?: de pago)?:\s*(.+?)\s+(?:Referencia|Clave|¿No|Fecha)", re.I)
_DEPOSITO = re.compile(
    r"abono por\s*" + _MONTO + r"\s*MX[NP]?\s*a tu cuenta terminaci[oó]n\s*(?P<cuenta>\d+)"
    r".*?Fecha:\s*(?P<f>\d{2}/\d{2}/\d{4})(?:\s*Hora:\s*(?P<h>\d{1,2}:\d{2}))?",
    re.I,
)
_DEP_BANCO = re.compile(r"Banco emisor:\s*(.+?)\s+(?:Cuenta origen|Clave|Concepto)", re.I)
_DEP_ORIGEN = re.compile(r"Cuenta origen:\s*(\d+)", re.I)
_DEP_ORDENANTE = re.compile(r"(?:Ordenante|Nombre del ordenante|Remitente):\s*(.+?)\s+(?:Cuenta|Banco|Clave|Concepto)", re.I)
_DEP_CONCEPTO = re.compile(r"Concepto de pago:\s*(.+?)\s+El dep[oó]sito", re.I)
_RETIRO = re.compile(
    r"el\s+(?P<f>\d{2}/\d{2}/\d{4})\s+a las\s+(?P<h>\d{1,2}:\d{2})\s*hrs\.?\s*se realiz[oó] un retiro de efectivo"
    r".*?cantidad de\s*" + _MONTO + r".*?cuenta terminaci[oó]n\s*(?P<cuenta>\d+)",
    re.I,
)


def _hora(h: str | None) -> str:
    if not h:
        return ""
    hh, mm = h.split(":")
    return f"{int(hh):02d}:{mm}"


def _limpia_comercio(c: str) -> str:
    c = re.sub(r"\s+", " ", c).strip(" .,:;")
    return c.upper()[:60]


def parsear(texto: str, msg_id: str, asunto: str = "") -> Movimiento | None:
    """Convierte el texto de un correo en un Movimiento, o None si no es uno."""
    t = texto
    a = asunto.lower()

    if "tarjeta de crédito propias" in a or "tarjeta de credito propias" in a:
        return None
    if "referencia de retiro" in a:
        return None  # sólo se generó la referencia; el retiro llega en otro correo

    if "transferencia" in a or _TRANSF.search(t):
        m = _TRANSF.search(t)
        if m:
            banco = re.sub(r"\s+", " ", m["banco"] or "CUENTA").strip().upper()
            dest = m["dest"]
            conc = _TRANSF_CONCEPTO.search(t)
            extra = {"origen": m["origen"]}
            if m["ref"]:
                extra["ref"] = m["ref"]
            if conc:
                extra["concepto"] = conc.group(1).strip()[:60]
            return Movimiento(id=msg_id, f=_fecha(m["f"]), h=_hora(m["h"]), m=_monto(m.group(_primer_monto(m))),
                              tipo="transferencia", c=f"{banco} ·{dest[-4:]}", tj=m["origen"][-4:],
                              cat="transferencias", fmt="T", extra=extra)
        return None

    if "depósito" in a or "deposito" in a or "abono por" in t.lower():
        m = _DEPOSITO.search(t)
        if m:
            banco = _DEP_BANCO.search(t)
            origen = _DEP_ORIGEN.search(t)
            quien = _DEP_ORDENANTE.search(t)
            conc = _DEP_CONCEPTO.search(t)
            nombre = (quien.group(1) if quien else (banco.group(1) if banco else "DEPÓSITO")).strip().upper()
            if origen:
                nombre = f"{nombre} ·{origen.group(1)[-4:]}"
            extra = {}
            if conc:
                extra["concepto"] = conc.group(1).strip()[:60]
            return Movimiento(id=msg_id, f=_fecha(m["f"]), h=_hora(m["h"]), m=_monto(m.group(1)),
                              tipo="deposito", c=nombre[:60], tj=m["cuenta"][-4:], cat="ingreso",
                              fmt="E", extra=extra)
        return None

    if "retiro" in a and "atm" in a or "retiro de efectivo sin tarjeta por" in t.lower():
        m = _RETIRO.search(t)
        if m:
            return Movimiento(id=msg_id, f=_fecha(m["f"]), h=_hora(m["h"]), m=_monto(m.group(3)),
                              tipo="retiro", c="RETIRO SIN TARJETA", tj=m["cuenta"][-4:],
                              cat="efectivo", fmt="R")
        return None

    # Compras. Ojo: los correos de cashback («ganarás $X de cashback») SÍ son compras.
    for fmt, rx in (("A", _A), ("C", _C), ("C", _C2), ("C", _C3), ("B", _B)):
        m = rx.search(t)
        if m:
            g = m.groupdict()
            if g.get("d"):
                g["f"] = f"{int(g['d']):02d}/{int(g['mes']):02d}/{g['a']}"
            monto = _monto(m.group(_primer_monto(m)))
            mov = Movimiento(id=msg_id, f=_fecha(g["f"]), h=_hora(g.get("h")), m=monto,
                             tipo="compra", c=_limpia_comercio(g["c"]), tj=(g.get("tj") or "")[-4:],
                             fmt=fmt)
            mon = (g.get("mon") or "MXN").upper()
            if mon not in ("MXN", "MXP", "M.N."):
                mov.extra["moneda"] = mon
            mov.cat = categorizar(mov.c)
            return mov

    # Formato genérico (correos viejos)
    mm, mf, mc = _D_MONTO.search(t), _D_FECHA.search(t), _D_COMERCIO.search(t)
    if mm and mf and mc and re.search(r"compra|cargo|pago", t, re.I):
        tj = _D_TJ.search(t)
        mov = Movimiento(id=msg_id, f=_fecha(mf.group(1)), h=_hora(mf.group(2)), m=_monto(mm.group(1)),
                         tipo="compra", c=_limpia_comercio(mc.group(1)), tj=tj.group(1)[-4:] if tj else "",
                         fmt="D")
        mov.cat = categorizar(mov.c)
        return mov
    return None


def _primer_monto(m: re.Match) -> int:
    """Índice del grupo sin nombre del monto (el único grupo anónimo de cada patrón)."""
    nombrados = set(m.re.groupindex.values())
    for i in range(1, m.re.groups + 1):
        if i not in nombrados:
            return i
    raise ValueError("patrón sin monto")


# ── Quitar duplicados ─────────────────────────────────────────────────────── #
def _minutos(h: str) -> int | None:
    if not h:
        return None
    hh, mm = h.split(":")
    return int(hh) * 60 + int(mm)


def quitar_duplicados(movs: list[dict]) -> list[dict]:
    """
    Santander avisa algunas compras dos o tres veces con correos distintos
    (A «Pago/Compra», C «cashback», B «por encima del límite»). Dos correos del
    MISMO formato siempre son compras distintas (dos apuestas de $50 en 3 min son
    dos compras). Un C o B se descarta si ya hay un A (o C) con la misma fecha,
    monto y tarjeta a ±3 minutos (B no trae hora: basta el día).
    """
    prioridad = {"A": 0, "D": 1, "C": 2, "B": 3}
    compras = sorted((x for x in movs if x["tipo"] == "compra"),
                     key=lambda x: (prioridad.get(x.get("fmt", "A"), 9), x["f"], x.get("h", "")))
    otros = [x for x in movs if x["tipo"] != "compra"]
    quedan: list[dict] = []
    idx: dict[tuple, list[dict]] = {}
    for x in compras:
        clave = (x["f"], round(x["m"], 2), x.get("tj", ""))
        previos = idx.setdefault(clave, [])
        fx = x.get("fmt", "A")
        dup = None
        if fx in ("C", "B"):
            for p in previos:
                if p.get("fmt") == fx or p.get("_tap" + fx):
                    continue
                t1, t2 = _minutos(x.get("h", "")), _minutos(p.get("h", ""))
                if t1 is None or t2 is None or abs(t1 - t2) <= 3:
                    dup = p
                    break
        if dup is not None:
            dup["_tap" + fx] = True       # cada A tapa a lo más un C y un B
            dup.setdefault("dup", []).append(x["id"])
            continue
        previos.append(x)
        quedan.append(x)
    for x in quedan:
        x.pop("_tapC", None)
        x.pop("_tapB", None)
    return sorted(quedan + otros, key=lambda x: (x["f"], x.get("h", "")), reverse=True)
