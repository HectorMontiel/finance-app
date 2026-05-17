"""Debug: muestra el HTML completo de un email de compra de Santander."""
import sys, json, os, base64, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from uuid import UUID
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from supabase import create_client
from app.core.encryption import EncryptionService
from app.core.token_vault import TokenVault

_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
user_id = UUID(os.environ["FINANCE_USER_ID"])
db  = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
enc = EncryptionService.from_env()
vault = TokenVault(db=db, encryption=enc)
token_json = vault.retrieve(user_id, "gmail_oauth2")
creds = Credentials.from_authorized_user_info(json.loads(token_json), _SCOPES)
service = build("gmail", "v1", credentials=creds, cache_discovery=False)

result = service.users().messages().list(
    userId="me", q="from:santander subject:Pago/Compra newer_than:30d", maxResults=3
).execute()

def get_html(msg):
    payload = msg.get("payload", {})
    def search(parts):
        for part in parts:
            if part.get("mimeType") in ("text/html", "text/plain"):
                data = part["body"].get("data", "")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            sub = part.get("parts", [])
            if sub:
                found = search(sub)
                if found:
                    return found
        return None
    result = search(payload.get("parts", []))
    if not result:
        data = payload.get("body", {}).get("data", "")
        if data:
            result = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    return result or "[EMPTY]"

def strip_html(html):
    # Remove style/script blocks
    html = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL)
    # Replace tags with space
    html = re.sub(r'<[^>]+>', ' ', html)
    # Decode entities
    html = html.replace('&amp;', '&').replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
    # Collapse whitespace
    html = re.sub(r'\s+', ' ', html).strip()
    return html

for stub in result.get("messages", [])[:3]:
    msg = service.users().messages().get(userId="me", id=stub["id"], format="full").execute()
    subject = next((h["value"] for h in msg["payload"].get("headers",[]) if h["name"]=="Subject"), "")
    html = get_html(msg)
    text = strip_html(html)
    print("\n" + "="*70)
    print(f"SUBJECT: {subject}")
    print(f"\nCLEAN TEXT:\n{text[:1500]}")
    print("="*70)
