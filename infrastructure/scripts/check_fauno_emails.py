"""Find all Santander emails that mention Fauno to check their subjects."""
import base64, json, os, sys
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

# Search for Santander emails that mention Fauno
result = service.users().messages().list(userId="me", q="from:santander fauno newer_than:180d", maxResults=20).execute()
msgs = result.get("messages", [])
print(f"Found {len(msgs)} Fauno emails")
for m in msgs[:10]:
    msg = service.users().messages().get(userId="me", id=m["id"], format="metadata", metadataHeaders=["Subject","From"]).execute()
    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
    print(f"  id={m['id']}  Subject: {headers.get('Subject','?')}")

# Show body of first fauno email
if msgs:
    print("\n--- Body preview of first Fauno email ---")
    msg = service.users().messages().get(userId="me", id=msgs[0]["id"], format="full").execute()
    body = ""
    for part in msg.get("payload", {}).get("parts", []):
        if part.get("mimeType") == "text/plain":
            data = part["body"].get("data", "")
            body = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            break
    if not body:
        data = msg.get("payload", {}).get("body", {}).get("data", "")
        body = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    import re
    body_clean = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()
    print(body_clean[:500])

# Show unique subjects
print("\n--- All unique Santander subjects in last 180d (first 20 msgs) ---")
result2 = service.users().messages().list(userId="me", q="from:santander newer_than:180d", maxResults=20).execute()
subjects = set()
for m in result2.get("messages", []):
    msg = service.users().messages().get(userId="me", id=m["id"], format="metadata", metadataHeaders=["Subject"]).execute()
    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
    subjects.add(headers.get("Subject","?"))
for s in sorted(subjects):
    print(f"  {s}")
