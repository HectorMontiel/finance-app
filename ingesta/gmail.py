"""Trae de Gmail (sólo lectura) los correos de Santander con movimientos."""

import base64
import json
import os
import time

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from ingesta.parser import a_texto

ALCANCE = ["https://www.googleapis.com/auth/gmail.readonly"]
ASUNTOS = [
    "Pago/Compra", "Tu compra ha sido registrada", "Autorización por encima del límite",
    "Confirmación de transferencia", "Has recibido un depósito", "RETIRO SIN TARJETA EN ATM",
]


def consulta(dias: int | None) -> str:
    asuntos = " OR ".join(f'subject:"{a}"' for a in ASUNTOS)
    q = f"from:santander ({asuntos})"
    return f"{q} newer_than:{dias}d" if dias else q


def servicio(token_json: str | None = None):
    info = json.loads(token_json or os.environ["GMAIL_TOKEN_JSON"])
    cred = Credentials.from_authorized_user_info(info, ALCANCE)
    if not cred.valid:
        cred.refresh(Request())
    return build("gmail", "v1", credentials=cred, cache_discovery=False)


def listar_ids(svc, q: str) -> list[str]:
    ids: list[str] = []
    req = svc.users().messages().list(userId="me", q=q, maxResults=500)
    while req is not None:
        r = req.execute()
        ids += [m["id"] for m in r.get("messages", [])]
        req = svc.users().messages().list_next(req, r)
    return ids


def _cuerpo(payload: dict) -> str:
    partes: list[tuple[str, str]] = []

    def andar(p):
        data = p.get("body", {}).get("data")
        if p.get("mimeType", "").startswith("text/") and data:
            partes.append((p["mimeType"], base64.urlsafe_b64decode(data).decode("utf-8", "replace")))
        for q in p.get("parts", []) or []:
            andar(q)

    andar(payload)
    planos = [x for _, x in partes if _ == "text/plain"]
    htmls = [x for t, x in partes if t == "text/html"]
    # Algunos correos traen un text/plain casi vacío: se usa el más largo.
    candidatos = [a_texto(x) for x in planos + htmls]
    return max(candidatos, key=len) if candidatos else ""


def traer(svc, ids: list[str], lote: int = 20, pausa: float = 1.5) -> list[tuple[str, str, str]]:
    """
    Devuelve [(id, asunto, texto)] con peticiones en lote. Gmail limita las
    unidades por minuto (cada correo cuesta 5): se va a ~800 correos/min y lo
    que rebota por límite se reintenta con espera creciente.
    """
    salida: dict[str, tuple[str, str, str]] = {}
    pendientes = list(dict.fromkeys(ids))
    espera = pausa

    for _intento in range(6):
        fallidos: list[str] = []

        def cb(rid, resp, exc):
            if exc is not None:
                fallidos.append(rid)
                return
            hd = {h["name"].lower(): h["value"] for h in resp["payload"].get("headers", [])}
            salida[resp["id"]] = (resp["id"], hd.get("subject", ""), _cuerpo(resp["payload"]))

        for i in range(0, len(pendientes), lote):
            b = svc.new_batch_http_request(callback=cb)
            for mid in pendientes[i:i + lote]:
                b.add(svc.users().messages().get(userId="me", id=mid, format="full"), request_id=mid)
            b.execute()
            if i + lote < len(pendientes):
                time.sleep(espera)
        if not fallidos:
            break
        pendientes = fallidos
        espera = min(espera * 2, 10)
        time.sleep(20)
    return list(salida.values())
