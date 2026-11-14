"""Genera supabase/functions/_comun/reglas.ts desde ingesta/ (una sola fuente de verdad).

    python supabase/generar_ts.py
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from ingesta import categorias, parser  # noqa: E402


MONTO = r"([\d,]+(?:\.\d{1,2})?)"


def js(rx) -> str:
    # Nombres de grupo al estilo JS; el monto (grupo sin nombre) pasa a llamarse «m»;
    # \w de Python incluye acentos («débito»): en JS se usa \p{L} con la bandera «u».
    p = rx.pattern.replace("(?P<", "(?<").replace(MONTO, "(?<m>" + MONTO[1:])
    return p.replace(r"\w", r"[\p{L}\p{N}_]")


nombres = ["_A", "_C", "_C2", "_C3", "_B", "_D_MONTO", "_D_FECHA", "_D_TJ", "_D_COMERCIO", "_TRANSF",
           "_TRANSF_CONCEPTO", "_DEPOSITO", "_DEP_BANCO", "_DEP_ORIGEN", "_DEP_ORDENANTE", "_DEP_CONCEPTO", "_RETIRO"]
patrones = {n.strip("_"): js(getattr(parser, n)) for n in nombres}
reglas = [[p, c] for p, c in categorias._REGLAS]

salida = (
    "// GENERADO por supabase/generar_ts.py desde ingesta/parser.py y ingesta/categorias.py. No editar a mano.\n"
    f"export const PATRONES: Record<string, string> = {json.dumps(patrones, ensure_ascii=False, indent=1)};\n\n"
    f"export const REGLAS: [string, string][] = {json.dumps(reglas, ensure_ascii=False, indent=1)};\n"
)
destino = RAIZ / "supabase" / "functions" / "_comun" / "reglas.ts"
destino.parent.mkdir(parents=True, exist_ok=True)
destino.write_text(salida, encoding="utf-8")
print("escrito", destino, len(patrones), "patrones,", len(reglas), "reglas")
