"""Quick DB check: last 10 transactions + category breakdown."""
import os, sys
from pathlib import Path
from collections import Counter
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("=== ÚLTIMAS 10 TRANSACCIONES ===")
rows = (
    db.schema("finanzas").table("transacciones")
    .select("fecha,monto,concepto,categoria")
    .order("fecha", desc=True).limit(10).execute()
)
for r in rows.data:
    print(f"  {r['fecha'][:10]}  ${float(r['monto']):>9.2f}  {r['categoria']:<15} {r['concepto'][:60]}")

print("\n=== TOTAL POR CATEGORÍA ===")
all_rows = db.schema("finanzas").table("transacciones").select("categoria,monto").execute()
cnt = Counter(r["categoria"] for r in all_rows.data)
totals = {}
for r in all_rows.data:
    totals[r["categoria"]] = totals.get(r["categoria"], 0) + float(r["monto"])
for cat, n in cnt.most_common():
    print(f"  {cat:<18} {n:>4} txns   ${totals[cat]:>10,.2f}")

print(f"\n  TOTAL GENERAL: {len(all_rows.data)} txns   ${sum(totals.values()):>10,.2f}")
