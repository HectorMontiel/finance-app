"""Herramienta local para el proyecto Supabase mis-finanzas (Management API, sin CLI).

    python supabase/supa.py sql archivo.sql | "select 1"
    python supabase/supa.py desplegar <funcion> [--verify-jwt]
    python supabase/supa.py secreto NOMBRE   (lee el valor de la entrada estándar)

Necesita SUPABASE_ACCESS_TOKEN en el entorno. El ref está en SUPABASE_REF.txt.
"""
import json
import os
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
REF = (RAIZ / "SUPABASE_REF.txt").read_text().strip()
H = {"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "User-Agent": "mis-finanzas"}


def pedir(ruta, datos=None, metodo="GET", tipo="application/json"):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}{ruta}", data=datos, method=metodo,
                                 headers={**H, "Content-Type": tipo})
    try:
        r = urllib.request.urlopen(req, timeout=180).read()
        return json.loads(r) if r else None
    except urllib.error.HTTPError as e:
        print("ERROR", e.code, e.read().decode()[:1500])
        sys.exit(1)


def sql(q):
    if os.path.exists(q):
        q = Path(q).read_text(encoding="utf-8")
    return pedir("/database/query", json.dumps({"query": q}).encode(), "POST")


def desplegar(nombre, verify_jwt=False):
    carpeta = RAIZ / "supabase" / "functions"
    archivos = [("index.ts", (carpeta / nombre / "index.ts").read_bytes())]
    comun = carpeta / "_comun"
    for f in sorted(comun.glob("*.ts")):
        archivos.append((f"../_comun/{f.name}", f.read_bytes()))
    meta = json.dumps({"entrypoint_path": "index.ts", "name": nombre, "verify_jwt": verify_jwt}).encode()
    b = uuid.uuid4().hex
    partes = [f'--{b}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode(), meta, b"\r\n"]
    for nom, cont in archivos:
        partes += [f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{nom}"\r\nContent-Type: application/typescript\r\n\r\n'.encode(), cont, b"\r\n"]
    partes.append(f"--{b}--\r\n".encode())
    r = pedir(f"/functions/deploy?slug={nombre}", b"".join(partes), "POST", "multipart/form-data; boundary=" + b)
    print("desplegada:", r.get("slug"), "versión", r.get("version"), "estado", r.get("status"), "verify_jwt", r.get("verify_jwt"))


if __name__ == "__main__":
    accion = sys.argv[1]
    if accion == "sql":
        print(json.dumps(sql(sys.argv[2]), ensure_ascii=False, indent=1, default=str)[:4000])
    elif accion == "desplegar":
        desplegar(sys.argv[2], "--verify-jwt" in sys.argv)
    elif accion == "secreto":
        valor = sys.stdin.read().strip()
        pedir("/secrets", json.dumps([{"name": sys.argv[2], "value": valor}]).encode(), "POST")
        print("secreto guardado:", sys.argv[2])
    elif accion == "secretos":
        print([s["name"] for s in pedir("/secrets")])
