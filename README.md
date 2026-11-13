# Mis Finanzas

App personal para ver en qué se va el dinero. Lee los avisos de Santander que llegan a Gmail
(compras, transferencias, depósitos y retiros), los clasifica y los muestra en una app web
instalable en el celular. Sin Streamlit, sin base de datos y sin servidor.

## Cómo funciona

```
Gmail (sólo lectura) ──► GitHub Actions cada 3 h ──► docs/datos/finanzas.enc ──► GitHub Pages ──► tu celular
                          python -m ingesta.sincronizar   (AES-256-GCM)                       (la app lo descifra)
```

- `ingesta/` — Python: lee los correos (`gmail.py`), los entiende (`parser.py`, 9 formatos de
  Santander desde 2021), pone categoría automática (`categorias.py`) y guarda todo cifrado
  (`cifrado.py`).
- `docs/` — la app (HTML + CSS + JS sin dependencias, salvo el generador de QR en `vendor/`).
  Funciona sin red con lo último que bajó (`sw.js`).
- `docs/datos/finanzas.enc` — movimientos cifrados. `docs/datos/ajustes.enc` — tus categorías,
  nombres, límites y pago, también cifrados. Sin la clave son ruido: por eso el repo puede ser público.

## Secretos (Settings → Secrets → Actions)

| Nombre | Qué es |
|---|---|
| `CLAVE_APP` | 32 bytes en base64url. Abre los datos. Copia local en `CLAVE_APP.txt` (ignorado por git). |
| `GMAIL_TOKEN_JSON` | Token OAuth de Gmail con `gmail.readonly` (incluye el refresh token). |

## Uso diario

- Abrir la app: <https://hectormontiel.github.io/finance-app/>. La primera vez en cada dispositivo
  se abre con el enlace de acceso o escaneando el QR en *Ajustes → Abrir en otro dispositivo*.
- En iPhone: Safari → Compartir → *Agregar a inicio*.
- Botón *Actualizar ahora* y ajustes sincronizados entre dispositivos: conecta un token de GitHub
  (fine-grained, sólo este repo, Contents + Actions de escritura) en *Ajustes → Conexión con GitHub*.

## Desarrollo

```bash
python -m venv .venv && .venv/Scripts/pip install -r ingesta/requirements.txt pytest
.venv/Scripts/python -m pytest
.venv/Scripts/python -m http.server 8650 --directory docs   # luego abre http://localhost:8650/#k=<CLAVE_APP>
```

Releer todo el historial: *Actions → Sincronizar y publicar → Run workflow → completo*.
