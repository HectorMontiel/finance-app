"""Shows top 'other' merchants to help tune the categorizer."""
import os, sys
from pathlib import Path
from collections import Counter
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
rows = db.schema("finanzas").table("transacciones").select("concepto,monto,categoria").eq("categoria","other").execute()

# Group by base merchant (strip card suffix)
import re
merchants = {}
for r in rows.data:
    base = re.sub(r'\s*\*{4}\d{4}$', '', r['concepto'])
    merchants[base] = merchants.get(base, 0) + float(r['monto'])

print("Top merchants in 'other' category (by spend):")
for m, total in sorted(merchants.items(), key=lambda x: -x[1])[:30]:
    print(f"  ${total:>9,.0f}  {m}")
