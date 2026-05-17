"""
Remove duplicate transactions that were inserted before the content-based
fingerprint was introduced. Keeps the record with the smallest id (first inserted)
for each (user_id, fecha_date, monto, concepto) group.
"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

rows = db.schema("finanzas").table("transacciones").select("id,user_id,fecha,monto,concepto").execute()
print(f"Total rows: {len(rows.data)}")

# Group by (fecha_date, monto, concepto) and find duplicates
from collections import defaultdict
groups = defaultdict(list)
for r in rows.data:
    fecha_date = r["fecha"][:10]
    key = (fecha_date, str(r["monto"]), r["concepto"])
    groups[key].append(r["id"])

to_delete = []
for key, ids in groups.items():
    if len(ids) > 1:
        # Keep the first id (alphabetically smallest UUID), delete the rest
        ids_sorted = sorted(ids)
        duplicates = ids_sorted[1:]
        to_delete.extend(duplicates)
        print(f"  Duplicate: {key[0]} ${key[1]} {key[2][:40]} -> keeping {ids_sorted[0][:8]}, deleting {len(duplicates)}")

print(f"\nDeleting {len(to_delete)} duplicate rows...")
for dup_id in to_delete:
    db.schema("finanzas").table("transacciones").delete().eq("id", dup_id).execute()

print(f"Done. Remaining rows: {len(rows.data) - len(to_delete)}")
