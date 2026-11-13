"""
Cifrado del archivo de datos que publica la página.

Formato (lo lee docs/app.js con WebCrypto):
    b"MF1" + nonce (12 bytes) + AES-256-GCM( gzip( JSON ) )   (la etiqueta GCM va al final)

La clave son 32 bytes al azar escritos en base64url (43 caracteres), secreto
CLAVE_APP en GitHub. Sin la clave el archivo es ruido: por eso puede vivir en un
repositorio público.
"""

import base64
import gzip
import json
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIA = b"MF1"


def clave_desde_texto(texto: str) -> bytes:
    texto = texto.strip()
    raw = base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))
    if len(raw) != 32:
        raise ValueError("La clave debe ser de 32 bytes (43 caracteres base64url).")
    return raw


def nueva_clave() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def cifrar(obj, clave: bytes) -> bytes:
    plano = gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0)
    nonce = os.urandom(12)
    return MAGIA + nonce + AESGCM(clave).encrypt(nonce, plano, MAGIA)


def descifrar(datos: bytes, clave: bytes):
    if datos[:3] != MAGIA:
        raise ValueError("Archivo de datos con formato desconocido.")
    plano = AESGCM(clave).decrypt(datos[3:15], datos[15:], MAGIA)
    return json.loads(gzip.decompress(plano))
