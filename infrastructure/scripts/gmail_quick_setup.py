"""
Script interactivo de setup Gmail OAuth2.
Corre esto después de tener GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en el .env

Pasos que hace este script:
  1. Lee las credenciales del .env
  2. Abre el browser para que apruebes acceso a Gmail (solo lectura)
  3. Guarda el token encriptado directo al vault de Supabase
  4. Verifica la conexión buscando emails de Santander
"""

import sys
import os
from pathlib import Path

# Asegurar que backend sea importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from uuid import UUID
from google_auth_oauthlib.flow import InstalledAppFlow
from supabase import create_client
from app.core.encryption import EncryptionService
from app.core.token_vault import TokenVault

_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def main():
    client_id     = os.environ["GMAIL_CLIENT_ID"]
    client_secret = os.environ["GMAIL_CLIENT_SECRET"]
    user_id       = UUID(os.environ["FINANCE_USER_ID"])
    supabase_url  = os.environ["SUPABASE_URL"]
    service_key   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    print("=" * 55)
    print("  Gmail OAuth2 Setup — Finance App")
    print("=" * 55)
    print("\n1. Abriendo navegador para aprobar acceso a Gmail...")
    print("   Selecciona la cuenta donde recibes correos de Santander.\n")

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, _SCOPES)
    creds = flow.run_local_server(port=8080, open_browser=True)
    print("\n[OK] Acceso aprobado por Google.")

    # Encriptar y guardar en vault
    db  = create_client(supabase_url, service_key)
    enc = EncryptionService.from_env()
    vault = TokenVault(db=db, encryption=enc)
    vault.store(user_id, "gmail_oauth2", creds.to_json())
    print("[OK] Token encriptado con AES-256-GCM y guardado en Supabase.")

    # Verificar buscando emails de Santander
    print("\n2. Verificando conexión con Gmail...")
    from googleapiclient.discovery import build
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    results = service.users().messages().list(
        userId="me",
        q="from:santander",
        maxResults=5
    ).execute()
    count = len(results.get("messages", []))
    print(f"[OK] Conexión exitosa. Emails de Santander encontrados: {count}")

    if count == 0:
        print("\n  (No se encontraron emails recientes de Santander.")
        print("   Asegúrate de que tu cuenta de Gmail es la correcta.)")
    else:
        print("\n  ¡Listo para ingestar! Corre el pipeline con:")
        print("  python -m backend.ingestion.pipeline")

    print("\n" + "=" * 55)
    print("  Setup completado. token.json NO se guardó en disco.")
    print("=" * 55)

if __name__ == "__main__":
    main()
