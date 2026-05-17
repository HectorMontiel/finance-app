"""
Re-categorizes all existing transactions using the latest categorizer rules.
Safe to run multiple times (idempotent update).
"""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
from supabase import create_client
from app.services.categorizer import categorize

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

rows = db.schema("finanzas").table("transacciones").select("id,concepto,categoria").execute()
print(f"Total registros: {len(rows.data)}")

updates = {}
for r in rows.data:
    new_cat = categorize(r["concepto"]).value
    if new_cat != r["categoria"]:
        updates[r["id"]] = new_cat

print(f"A recategorizar: {len(updates)}")

# Batch updates
changed = 0
for row_id, new_cat in updates.items():
    db.schema("finanzas").table("transacciones").update({"categoria": new_cat}).eq("id", row_id).execute()
    changed += 1

print(f"Actualizados: {changed}")

# Summary
from collections import Counter
all_rows = db.schema("finanzas").table("transacciones").select("categoria,monto").execute()
cnt = Counter(r["categoria"] for r in all_rows.data)
totals = {}
for r in all_rows.data:
    totals[r["categoria"]] = totals.get(r["categoria"], 0) + float(r["monto"])
print("\nDistribucion final:")
for cat, n in cnt.most_common():
    print(f"  {cat:<18} {n:>4} txns   ${totals[cat]:>10,.2f}")
