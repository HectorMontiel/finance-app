"""
One-time cleanup: elimina registros corruptos del parser roto.
  - concepto = 'and' (artifact del parser viejo que no limpiaba HTML)
  - monto > 50,000 (transferencias que se colaron antes del filtro)
Estos registros son basura del parser anterior, no transacciones reales.
"""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Preview first
bad_and = db.schema("finanzas").table("transacciones").select("id,concepto,monto,fecha").eq("concepto", "and").execute()
bad_big = db.schema("finanzas").table("transacciones").select("id,concepto,monto,fecha").gt("monto", 50000).execute()

print(f"Registros con concepto='and': {len(bad_and.data)}")
print(f"Registros con monto > $50,000: {len(bad_big.data)}")

# Collect IDs to delete (deduped)
ids_to_delete = list({r["id"] for r in bad_and.data} | {r["id"] for r in bad_big.data})
print(f"Total a eliminar: {len(ids_to_delete)}")

if ids_to_delete:
    # Delete in batches of 100
    for i in range(0, len(ids_to_delete), 100):
        batch = ids_to_delete[i:i+100]
        db.schema("finanzas").table("transacciones").delete().in_("id", batch).execute()
    print(f"✓ Eliminados {len(ids_to_delete)} registros corruptos.")
else:
    print("Nada que limpiar.")

# Final count
remaining = db.schema("finanzas").table("transacciones").select("id", count="exact").execute()
print(f"\nRegistros válidos restantes: {remaining.count}")
