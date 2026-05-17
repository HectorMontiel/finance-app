"""Preview bodies of alternate-format Santander emails."""
import base64, json, os, sys, re
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.config import get_settings
from app.core.encryption import EncryptionService
from app.core.token_vault import TokenVault
from app.db.client import get_admin_client
from uuid import UUID

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

settings = get_settings()
db = get_admin_client()
encryption = EncryptionService.from_env()
vault = TokenVault(db=db, encryption=encryption)
user_id = UUID(os.environ["FINANCE_USER_ID"])

token_json = vault.retrieve(user_id, "gmail_oauth2")
creds = Credentials.from_authorized_user_info(json.loads(token_json), ["https://www.googleapis.com/auth/gmail.readonly"])
if creds.expired and creds.refresh_token:
    creds.refresh(Request())

service = build("gmail", "v1", credentials=creds, cache_discovery=False)

STYLE_BLOCK = re.compile(r"<(style|script)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
STRIP_TAGS = re.compile(r"<[^>]+>")

def get_body(msg_id):
    msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
    body = ""
    # Try parts first
    for part in msg.get("payload", {}).get("parts", []):
        if part.get("mimeType") == "text/plain":
            data = part["body"].get("data", "")
            body = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            break
        elif part.get("mimeType") == "text/html":
            data = part["body"].get("data", "")
            body = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    if not body:
        data = msg.get("payload", {}).get("body", {}).get("data", "")
        body = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    # Clean HTML
    body = STYLE_BLOCK.sub(" ", body)
    body = STRIP_TAGS.sub(" ", body)
    import html
    body = html.unescape(body)
    return re.sub(r"\s+", " ", body).strip()

# IDs from previous run
ids_to_check = [
    ("Tu compra ha sido registrada", "19e0bc4280f5f0c2"),
    ("Autorización por encima del límite", "19e0bc40a3377d7a"),
    ("Autorización por encima del límite 2", "19e0bafbadf61031"),
    ("Pago/Compra", "19ca86f5e3bca986"),
]

for label, mid in ids_to_check:
    body = get_body(mid)
    print(f"\n{'='*60}")
    print(f"FORMAT: {label}")
    print(f"{'='*60}")
    print(body[:800])
