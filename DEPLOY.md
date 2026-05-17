# Deployment Guide — Mis Finanzas

## Stack (100 % free)

| Layer | Service | URL |
|---|---|---|
| Frontend | Streamlit Community Cloud | `your-app.streamlit.app` |
| Database | Supabase (already running) | — |
| Daily ingestion | GitHub Actions (cron) | — |
| Code | GitHub (private repo) | — |

---

## Step 1 — Create GitHub repository

1. Go to https://github.com/new
2. Name it `finance-app` (private)
3. Do **not** initialize with README (we have one)

---

## Step 2 — Push code

```bash
cd C:\Users\HMREY\finance-app

git init
git add .
git commit -m "feat: initial production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/finance-app.git
git push -u origin main
```

---

## Step 3 — GitHub Actions secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add **all** of the following (values from your `.env`):

| Secret name | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same (service_role key) |
| `SUPABASE_JWT_SECRET` | same (JWT secret) |
| `ENCRYPTION_KEY` | your `.env` |
| `FINANCE_USER_ID` | your `.env` |
| `GMAIL_CLIENT_ID` | your `.env` |
| `GMAIL_CLIENT_SECRET` | your `.env` |
| `GMAIL_TOKEN_JSON` | Run the command below ↓ |
| `MP_ACCESS_TOKEN` | your `.env` (optional) |

**Get GMAIL_TOKEN_JSON value:**
```bash
# Run from project root — outputs a single-line JSON string
python -c "import json,pathlib; print(json.dumps(json.loads(pathlib.Path('token.json').read_text())))"
```
Copy the entire output and paste it as the `GMAIL_TOKEN_JSON` secret value.

Then create a **GitHub Environment** called `production`:
- Repo → Settings → Environments → New environment → name it `production`
- Move all the secrets above into the Environment (not repo-level) for extra isolation

---

## Step 4 — Deploy to Streamlit Community Cloud

1. Go to https://share.streamlit.io and sign in with GitHub
2. Click **"Create app"**
3. Fill in:
   - **Repository**: `YOUR_USERNAME/finance-app`
   - **Branch**: `main`
   - **Main file path**: `frontend/app.py`
4. Click **"Advanced settings"** → set Python version to `3.12`
5. Click **Deploy** (first deploy takes ~3 minutes)

### Add secrets in Streamlit Cloud

After deploy → App menu (⋮) → **Settings → Secrets** → paste:

```toml
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_ANON_KEY = "your-anon-key"
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

Hit **Save** — the app restarts automatically.

---

## Step 5 — Verify everything works

### Check the frontend
Open your `https://your-app.streamlit.app` URL and log in.

### Trigger the ingestion manually
Go to your GitHub repo → **Actions → Daily Ingestion → Run workflow**

Watch the logs — you should see output like:
```
{"event": "pipeline_complete", "summary": {"santander": 42, "mercado_pago": 0}}
```

### Automatic daily ingestion
The pipeline runs automatically every day at **7 AM Mexico City time**
(configured in `.github/workflows/ingest.yml`).

---

## Updating the app

Any push to `main` automatically:
- Runs tests + security scan (GitHub Actions)
- Redeploys the frontend (Streamlit Cloud watches the branch)

```bash
# Make changes locally, then:
git add .
git commit -m "your message"
git push
```

---

## Secrets reference

### Streamlit Cloud secrets (frontend only)
```toml
SUPABASE_URL = "..."
SUPABASE_ANON_KEY = "..."
SUPABASE_SERVICE_ROLE_KEY = "..."
```

### GitHub Actions secrets (ingestion pipeline)
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
ENCRYPTION_KEY
FINANCE_USER_ID
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_TOKEN_JSON          ← full contents of token.json as a single line
MP_ACCESS_TOKEN           ← optional, add when MP is configured
```

---

## Optional: Deploy FastAPI backend

The Streamlit dashboard works without the backend API (it queries Supabase directly).
If you later build a mobile app and need the REST API:

**Free option — Koyeb:**
1. Go to https://app.koyeb.com
2. Create app → GitHub → select repo
3. Set build command: `pip install -r backend/requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
5. Set root directory: `backend`
6. Add all env vars from GitHub secrets

**Paid option — Render ($7/month):**
- The `render.yaml` at the repo root is already configured
- Connect repo at render.com → it auto-detects the config
