"""
Configuración rápida de Mercado Pago.
Valida el token y lo guarda encriptado en el vault.

Uso:
  cd C:\\Users\\HMREY\\finance-app
  python infrastructure/scripts/mp_token_setup.py

El script lee MP_ACCESS_TOKEN del .env (si existe) o te lo pide interactivamente.
"""

import os
import sys
from pathlib import Path
from uuid import UUID

# ── Path setup ───────────────────────────────────────────────────────────── #
_ROOT    = Path(__file__).resolve().parents[2]
_BACKEND = _ROOT / "backend"
sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

import httpx
from supabase import create_client

from app.core.encryption import EncryptionService
from app.core.token_vault import TokenVault


# ── Helpers ──────────────────────────────────────────────────────────────── #

def _check_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"\n✗ Variable de entorno faltante: {key}")
        print(f"  Agrégala a {_ROOT / '.env'}")
        sys.exit(1)
    return val


def validate_token(token: str) -> dict:
    """Calls /v1/users/me — returns profile dict or exits with instructions."""
    print("  Contactando api.mercadopago.com …", end=" ", flush=True)
    try:
        resp = httpx.get(
            "https://api.mercadopago.com/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=12,
        )
        resp.raise_for_status()
        profile = resp.json()
        print("OK")
        return profile
    except httpx.HTTPStatusError as exc:
        print(f"FALLÓ  (HTTP {exc.response.status_code})")
        body = exc.response.text[:400]
        print(f"\n  Respuesta: {body}")
        _print_token_instructions()
        sys.exit(1)
    except httpx.RequestError as exc:
        print(f"FALLÓ  ({exc})")
        print("  Sin conexión a internet o servidor inalcanzable.")
        sys.exit(1)


def _print_token_instructions() -> None:
    print("""
  ┌─ Cómo obtener tu access token de Mercado Pago ──────────────────────────┐
  │                                                                          │
  │  1. Ve a:  https://www.mercadopago.com.mx/developers/panel/app           │
  │  2. Inicia sesión con la cuenta que tiene la tarjeta MP                  │
  │  3. Crea una nueva aplicación (o abre la existente)                      │
  │  4. En la sección "Credenciales de producción" copia el:                 │
  │       Access token  →  APP_USR-XXXXXXXXXXXXXXXX-...                     │
  │  5. Agrégalo a tu .env:  MP_ACCESS_TOKEN=APP_USR-...                     │
  │  6. Vuelve a ejecutar este script                                        │
  │                                                                          │
  │  ⚠️  Usa el token de PRODUCCIÓN, no el de sandbox/pruebas               │
  └──────────────────────────────────────────────────────────────────────────┘
""")


# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    print("━" * 55)
    print("  Mis Finanzas · Configuración de Mercado Pago")
    print("━" * 55)

    # 1. Required env vars
    supabase_url     = _check_env("SUPABASE_URL")
    service_role_key = _check_env("SUPABASE_SERVICE_ROLE_KEY")
    finance_user_id  = _check_env("FINANCE_USER_ID")
    user_id          = UUID(finance_user_id)

    # 2. MP token — from .env or interactive prompt
    mp_token = os.environ.get("MP_ACCESS_TOKEN", "").strip()
    if not mp_token or mp_token.lower() in ("pendiente", "none", ""):
        print("\n⚠  MP_ACCESS_TOKEN no encontrado en .env")
        _print_token_instructions()
        mp_token = input("  Pega tu Access Token aquí: ").strip()
        if not mp_token:
            print("✗ No se proporcionó token. Abortando.")
            sys.exit(1)

    # 3. Validate token against MP API
    print(f"\n[1/3] Validando token (APP_USR-...{mp_token[-6:]}) …")
    profile  = validate_token(mp_token)
    mp_name  = f"{profile.get('first_name','')} {profile.get('last_name','')}".strip()
    mp_email = profile.get("email", "—")
    mp_id    = profile.get("id", "—")
    print(f"       Cuenta:  {mp_name}")
    print(f"       Email:   {mp_email}")
    print(f"       MP ID:   {mp_id}")

    # 4. Encrypt and store in vault
    print("\n[2/3] Encriptando token y guardando en vault …", end=" ", flush=True)
    db    = create_client(supabase_url, service_role_key)
    enc   = EncryptionService.from_env()
    vault = TokenVault(db=db, encryption=enc)
    vault.store(user_id, "mercadopago", mp_token)
    print("✓")

    # 5. Quick connectivity test — fetch 1 payment to confirm permissions
    print("[3/3] Verificando permisos de lectura de pagos …", end=" ", flush=True)
    try:
        resp = httpx.get(
            "https://api.mercadopago.com/v1/payments/search",
            headers={"Authorization": f"Bearer {mp_token}"},
            params={"limit": 1},
            timeout=10,
        )
        resp.raise_for_status()
        total = resp.json().get("paging", {}).get("total", "?")
        print(f"✓  ({total} pagos encontrados)")
    except Exception as exc:
        print(f"⚠  No se pudo consultar pagos: {exc}")
        print("   El token quedó guardado; verifica permisos en el panel de MP.")

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Mercado Pago configurado correctamente

  El token está encriptado en Supabase.
  Para importar tus transacciones ejecuta:

    cd {_ROOT}
    python -m ingestion.pipeline

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━""")


if __name__ == "__main__":
    main()
