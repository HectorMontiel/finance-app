import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
rows = db.schema("finanzas").table("transacciones").select("id,fecha,monto,concepto,categoria").ilike("concepto", "%FAUNO%").execute()
print("Fauno records:")
for r in rows.data:
    print(f"  {r['fecha'][:10]}  ${r['monto']:>8.2f}  {r['categoria']:<15}  {r['concepto']}")

total = db.schema("finanzas").table("transacciones").select("id", count="exact").execute()
print(f"\nTotal records in DB: {total.count}")

from collections import Counter
all_rows = db.schema("finanzas").table("transacciones").select("categoria,monto").execute()
cnt = Counter(r["categoria"] for r in all_rows.data)
totals = {}
for r in all_rows.data:
    totals[r["categoria"]] = totals.get(r["categoria"], 0) + float(r["monto"])
print("\nDistribution:")
for cat, n in cnt.most_common():
    print(f"  {cat:<18} {n:>4} txns   ${totals[cat]:>10,.2f}")
