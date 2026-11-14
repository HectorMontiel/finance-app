# Mis Finanzas

App para ver en qué se va el dinero sin capturar nada. Cada persona entra con su cuenta de
Google, da permiso de sólo lectura a su Gmail y la app lee los avisos de Santander (compras,
transferencias, depósitos y retiros). Una IA (Gemini) clasifica cada comercio nuevo y lo guarda
en un diccionario que comparten todos los usuarios.

## Cómo funciona

```
Google (entrar + gmail.readonly) ──► función «entrar» ──► Supabase Auth + token cifrado
Gmail ──► función «sincronizar» (al entrar, botón Actualizar y cada hora con pg_cron) ──► tabla movimientos
comercio nuevo ──► reglas (ingesta/categorias.py) o Gemini ──► tabla diccionario (compartida)
docs/ (GitHub Pages, PWA) ──► lee sólo lo del usuario con su sesión (RLS)
```

- `docs/` — la app (HTML + CSS + JS, sin compilación). `vendor/supabase.js` es supabase-js 2.45.4.
- `supabase/esquema.sql` — tablas y reglas de acceso (cada usuario sólo ve lo suyo).
- `supabase/functions/` — `entrar`, `sincronizar`, `borrar-cuenta` (Deno). `_comun/reglas.ts` se
  **genera** desde Python: `python supabase/generar_ts.py` tras cambiar `ingesta/parser.py` o
  `ingesta/categorias.py`.
- `supabase/supa.py` — SQL, despliegue de funciones y secretos por la Management API
  (necesita `SUPABASE_ACCESS_TOKEN`).
- `ingesta/` — el lector original en Python (fuente de verdad de los patrones y sus pruebas).

## Secretos de las funciones (Supabase → Edge Functions → Secrets)

| Nombre | Qué es |
|---|---|
| `GOOGLE_CLIENT_ID` | Cliente OAuth web de Google |
| `GOOGLE_CLIENT_SECRET` | Su secreto |
| `GEMINI_API_KEY` | Llave de Google AI Studio |
| `TOKEN_KEY` | AES-256 para cifrar los tokens de Gmail |
| `CRON_SECRET` | Para que sólo pg_cron dispare la sincronización de todos |

El cliente de Google necesita como URI de redireccionamiento la dirección exacta de la app
(`https://hectormontiel.github.io/finance-app/` y `http://localhost:8650/` para pruebas).
Mientras la app no esté verificada por Google, hasta 100 personas pueden usarla y verán el
aviso «Google no verificó esta app».

## Desarrollo

```bash
python -m venv .venv && .venv/Scripts/pip install -r ingesta/requirements.txt pytest
.venv/Scripts/python -m pytest
.venv/Scripts/python -m http.server 8650 --bind 127.0.0.1 --directory docs
python supabase/supa.py desplegar sincronizar
```
