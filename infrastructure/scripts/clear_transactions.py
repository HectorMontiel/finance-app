"""Clear all transactions so pipeline re-run uses fresh content-based fingerprints."""
import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
user_id = os.environ["FINANCE_USER_ID"]

count_resp = db.schema("finanzas").table("transacciones").select("id", count="exact").eq("user_id", user_id).execute()
print(f"Deleting {count_resp.count} transactions for user {user_id[:8]}...")
db.schema("finanzas").table("transacciones").delete().eq("user_id", user_id).execute()
print("Done.")
