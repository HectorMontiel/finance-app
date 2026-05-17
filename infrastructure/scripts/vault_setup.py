"""
Script ONE-TIME: lee token.json del disco, lo encripta y lo guarda en el TokenVault.
Corre LOCALMENTE después de oauth2_setup.py.

Pasos:
  1. python infrastructure/scripts/oauth2_setup.py     → genera token.json
  2. python infrastructure/scripts/vault_setup.py      → encripta y sube a Supabase
  3. rm token.json                                      → elimina el plaintext del disco

Variables de entorno necesarias:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, FINANCE_USER_ID
  MP_ACCESS_TOKEN  (token de Mercado Pago — APP_USR-... desde mercadopago.com.mx/developers)
"""

import os
import sys
from pathlib import Path
from uuid import UUID

# Asegura que el módulo backend sea importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import httpx
from dotenv import load_dotenv
from supabase import create_client

from app.core.encryption import EncryptionService
from app.core.token_vault import TokenVault


# ── MP token validation ──────────────────────────────────────────────────── #

def validate_mp_token(token: str) -> dict:
    """
    Calls /v1/users/me to confirm the access token is valid.
    Returns the MP user profile on success; raises on failure.
    """
    try:
        resp = httpx.get(
            "https://api.mercadopago.com/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        print(f"\n✗ MP token validation FAILED  →  HTTP {exc.response.status_code}")
        print("  Respuesta:", exc.response.text[:300])
        print("\n  Pasos para obtener un token válido:")
        print("  1. Ve a https://www.mercadopago.com.mx/developers/panel/app")
        print("  2. Crea o abre tu aplicación")
        print("  3. Copia el 'Access token de producción' (APP_USR-...)")
        print("  4. Actualiza MP_ACCESS_TOKEN en tu .env")
        raise SystemExit(1) from exc
    except httpx.RequestError as exc:
        print(f"\n✗ No se pudo conectar a Mercado Pago: {exc}")
        raise SystemExit(1) from exc


# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    # Load .env from project root
    env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(env_path)
    print(f"Cargando variables de entorno desde: {env_path}\n")

    supabase_url     = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    user_id          = UUID(os.environ["FINANCE_USER_ID"])
    mp_token         = os.environ.get("MP_ACCESS_TOKEN", "pendiente")
    token_path       = Path(os.environ.get("GMAIL_TOKEN_PATH", "token.json"))

    db    = create_client(supabase_url, service_role_key)
    enc   = EncryptionService.from_env()
    vault = TokenVault(db=db, encryption=enc)

    # ── Gmail OAuth2 token ── #
    if token_path.exists():
        gmail_token_json = token_path.read_text()
        vault.store(user_id, "gmail_oauth2", gmail_token_json)
        print(f"✓ Gmail token encriptado y guardado (desde {token_path})")
        token_path.unlink()
        print(f"✓ {token_path} eliminado del disco")
    else:
        print(f"⚠  Gmail token no encontrado en {token_path} — omitiendo")

    # ── Mercado Pago token ── #
    if not mp_token or mp_token.strip().lower() in ("pendiente", "", "none"):
        print("\n⚠  MP_ACCESS_TOKEN no configurado en .env — omitiendo")
        print("   Para configurarlo:")
        print("   1. Ve a https://www.mercadopago.com.mx/developers/panel/app")
        print("   2. Copia el 'Access token de producción' (APP_USR-...)")
        print("   3. Agrega  MP_ACCESS_TOKEN=APP_USR-...  a tu .env")
        print("   4. Vuelve a ejecutar este script")
    else:
        print("Validando MP_ACCESS_TOKEN contra la API de Mercado Pago...")
        profile = validate_mp_token(mp_token)
        mp_email = profile.get("email", "—")
        mp_name  = f"{profile.get('first_name','')} {profile.get('last_name','')}".strip()
        print(f"✓ Token válido  →  {mp_name} ({mp_email})")
        vault.store(user_id, "mercadopago", mp_token)
        print("✓ Mercado Pago token encriptado y guardado en vault")

    print("\n✅  Todos los tokens están encriptados en reposo en Supabase.")
    print("   La ENCRYPTION_KEY en tus env vars es la única forma de descifrarlos.")
    print("\nSiguiente paso: python -m ingestion.pipeline")


if __name__ == "__main__":
    main()
