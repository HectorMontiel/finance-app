"""
Sincroniza Gmail → docs/datos/finanzas.enc (cifrado).

    python -m ingesta.sincronizar            # sólo lo nuevo (lo normal, cada pocas horas)
    python -m ingesta.sincronizar --completo # vuelve a leer todo el historial

Variables: CLAVE_APP (clave del archivo) y GMAIL_TOKEN_JSON (token OAuth de Gmail).

El repositorio es público y los registros de GitHub Actions también: aquí sólo se
imprimen conteos, nunca comercios ni montos.
"""

import argparse
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from ingesta import gmail
from ingesta.categorias import categorizar
from ingesta.cifrado import cifrar, clave_desde_texto, descifrar
from ingesta.parser import parsear, quitar_duplicados

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "docs" / "datos" / "finanzas.enc"


def cargar(ruta: Path, clave: bytes) -> dict:
    if ruta.exists():
        return descifrar(ruta.read_bytes(), clave)
    return {"v": 1, "movs": [], "vistos": [], "fallidos": []}


def sincronizar(clave: bytes, completo: bool = False, ruta: Path = DATOS, token_json: str | None = None) -> dict:
    datos = cargar(ruta, clave)
    vistos = set(datos.get("vistos", []))
    svc = gmail.servicio(token_json)

    if completo or not datos["movs"]:
        dias = None
        movs: list[dict] = []
        vistos = set()
    else:
        ultimo = max(m["f"] for m in datos["movs"])
        dias = max(10, (date.today() - date.fromisoformat(ultimo)).days + 4)
        movs = datos["movs"]

    ids = gmail.listar_ids(svc, gmail.consulta(dias))
    reintentar = set(datos.get("fallidos", [])) if not completo else set()
    nuevos = [i for i in ids if i not in vistos] + [i for i in reintentar if i not in ids]
    correos = gmail.traer(svc, nuevos) if nuevos else []

    agregados, fallidos = [], []
    for mid, asunto, texto in correos:
        mov = parsear(texto, mid, asunto)
        if mov is None:
            fallidos.append(mid)
            continue
        vistos.add(mid)
        agregados.append(mov.a_dict())

    # Recalcula la categoría automática de todo (por si mejoraron las reglas)
    todos = movs + agregados
    for m in todos:
        if m["tipo"] == "compra":
            m["cat"] = categorizar(m["c"])
    todos = quitar_duplicados(todos)

    salida = {
        "v": 1,
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "movs": todos,
        "vistos": sorted(vistos),
        "fallidos": sorted(set(fallidos))[-200:],
    }
    cambio = (len(todos) != len(datos["movs"]) or completo or bool(agregados))
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if cambio or not ruta.exists():
        ruta.write_bytes(cifrar(salida, clave))

    resumen = {
        "correos_revisados": len(ids), "nuevos": len(nuevos), "agregados": len(agregados),
        "duplicados_quitados": len(movs) + len(agregados) - len(todos),
        "sin_leer": len(fallidos), "total": len(todos), "escrito": cambio,
    }
    return resumen


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--completo", action="store_true")
    ap.add_argument("--datos", default=str(DATOS))
    a = ap.parse_args()
    clave = clave_desde_texto(os.environ["CLAVE_APP"])
    r = sincronizar(clave, completo=a.completo, ruta=Path(a.datos))
    print(" · ".join(f"{k}={v}" for k, v in r.items()))
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.write(f"cambio={'si' if r['escrito'] else 'no'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
