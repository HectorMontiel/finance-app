"""
Mis Finanzas — Financial Intelligence Dashboard
Design system: Corporate Dark Grid (UI/UX Pro Max — Data-Dense Dashboard)
  Background:  linear-gradient(160deg, #0c1525 0%, #06101e 100%)
  Surface:     #0d1933  solid card  /  border rgba(255,255,255,.08)
  Accent:      #6366f1 indigo  /  #22C55E green positive
  Typography:  Inter (all weights)
  Radius:      10px cards, 8px inputs — NO bubbly 18-24px
Mobile-first responsive — iPhone 17 primary target.
"""
import json
import sys
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

_ROOT    = str(Path(__file__).resolve().parent.parent)
_BACKEND = str(Path(__file__).resolve().parent.parent / "backend")
for _p in (_BACKEND, _ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import numpy as np
import pandas as pd
import streamlit as st
from dateutil.relativedelta import relativedelta
import plotly.graph_objects as go
from supabase import create_client

st.set_page_config(page_title="Mis Finanzas", page_icon="💳",
                   layout="wide", initial_sidebar_state="collapsed")

# ══════════════════════════  CONSTANTS  ══════════════════════════════════════
SAVINGS_TARGET  = 0.20
_INCOME_KEY     = "_income"          # key in card_aliases for monthly income
_INCOME_DEFAULT = 26_000.0

# CARD_MAP removed — aliases are now stored per-user in finanzas.card_aliases
CAT_LABELS = {
    "food": "Comida", "transport": "Transporte",
    "entertainment": "Entretenimiento", "health": "Salud",
    "utilities": "Servicios", "shopping": "Compras",
    "transfer": "Transferencias", "other": "Otros",
}
CAT_CLR = {
    "Comida": "#F87171", "Transporte": "#34D399",
    "Entretenimiento": "#818CF8", "Salud": "#6EE7B7",
    "Servicios": "#FCD34D", "Compras": "#C084FC",
    "Transferencias": "#67E8F9", "Otros": "#64748B",
}

def fmt(v: float) -> str:
    return f"${v/1_000:.1f}k" if v >= 1_000 else f"${v:.0f}"

def next_payday() -> tuple[str, int]:
    today = datetime.now().date()
    ref   = datetime(2026, 5, 8).date()
    cycle = (today - ref).days % 14
    days_left = (14 - cycle) % 14 or 14
    return (today + timedelta(days=days_left)).strftime("%d/%m"), days_left

# ══════════════════════════  CSS — PREMIUM DARK GRID  ═══════════════════════
st.markdown("""
<style>
/* ── Google Fonts ──────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body,[class*="css"]{font-family:'Inter',sans-serif!important;-webkit-text-size-adjust:100%;}

/* ── Background — flat dark, zero radial blobs ────────────────────────────── */
[data-testid="stAppViewContainer"]{
    background:#06101e !important;
    min-height:100vh;
}
[data-testid="stHeader"],[data-testid="stToolbar"],
[data-testid="stDecoration"],[data-testid="collapsedControl"]{display:none!important;}
.block-container{padding:.6rem .9rem 3rem!important;max-width:100%!important;}

/* ── Card: st.container(border=True) ─────────────────────────────────────── */
[data-testid="stVerticalBlockBorderWrapper"]{
    background:linear-gradient(180deg,#0f1e3a 0%,#09162d 100%)!important;
    border:1px solid rgba(255,255,255,.08)!important;
    border-radius:10px!important;
    overflow:hidden!important;
    padding:14px 16px 12px!important;
}
[data-testid="stVerticalBlockBorderWrapper"]>div{gap:0!important;}

/* ── HTML card (.gc) — KPIs & budget ─────────────────────────────────────── */
.gc{
    background:linear-gradient(180deg,#0f1e3a 0%,#09162d 100%);
    border:1px solid rgba(255,255,255,.08);
    border-radius:10px;
    padding:12px 14px 10px;
    height:100%;
    position:relative;
    overflow:hidden;
}
/* subtle shine streak on hover */
.gc::before{
    content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.03),transparent);
    transition:left .5s;
}
.gc:hover::before{left:120%;}

/* ── KPI labels & values ─────────────────────────────────────────────────── */
.kl{color:rgba(255,255,255,.35);font-size:.56rem;letter-spacing:.13em;
    text-transform:uppercase;font-weight:700;margin-bottom:5px;line-height:1;}
.kv{color:#F8FAFC;font-size:1.55rem;font-weight:900;line-height:1;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;}
.kv-txt{font-size:1.1rem!important;}  /* for text KPIs like category name */
.ks{font-size:.66rem;line-height:1.2;}
.up{color:#F87171;}.dn{color:#22C55E;}.nt{color:rgba(255,255,255,.30);}

/* ── Section label ───────────────────────────────────────────────────────── */
.sl{
    color:rgba(255,255,255,.45);
    font-size:.60rem;font-weight:700;letter-spacing:.11em;
    text-transform:uppercase;
    margin:0 0 10px;
    padding-bottom:8px;
    border-bottom:1px solid rgba(255,255,255,.06);
    display:block;
}

/* ── Budget bar ──────────────────────────────────────────────────────────── */
.bbar-wrap{margin:6px 0 4px;background:rgba(255,255,255,.07);
    border-radius:99px;height:5px;overflow:hidden;}
.bbar-fill{height:5px;border-radius:99px;transition:width .8s cubic-bezier(.4,0,.2,1);}

/* ── Inline budget strip ─────────────────────────────────────────────────── */
.bstrip{
    background:linear-gradient(180deg,#0f1e3a 0%,#09162d 100%);
    border:1px solid rgba(255,255,255,.07);
    border-radius:10px;
    padding:9px 14px 8px;
    margin:6px 0 8px;
}

/* ── Story banner (compact) ──────────────────────────────────────────────── */
.story-banner{
    background:linear-gradient(90deg,rgba(99,102,241,.12) 0%,rgba(6,16,30,.5) 100%);
    border:1px solid rgba(99,102,241,.20);
    border-left:3px solid #6366f1;
    border-radius:10px;padding:9px 14px;
    font-size:.78rem;color:rgba(255,255,255,.80);
    line-height:1.5;margin-bottom:8px;
}
.story-banner strong{color:#a5b4fc;}

/* ── Filter bar ──────────────────────────────────────────────────────────── */
.fs{
    background:#080f1e;
    border:1px solid rgba(255,255,255,.07);
    border-radius:10px;padding:6px 10px;margin-bottom:8px;
}

/* ── Active filter chip ──────────────────────────────────────────────────── */
.cf-banner{
    background:rgba(99,102,241,.12);
    border:1px solid rgba(99,102,241,.28);
    border-radius:8px;padding:5px 12px;font-size:.72rem;color:#a5b4fc;
    margin-bottom:8px;display:flex;align-items:center;gap:8px;
}

/* ── Insight card ────────────────────────────────────────────────────────── */
.ic{
    background:linear-gradient(180deg,#0f1e3a 0%,#09162d 100%);
    border:1px solid rgba(255,255,255,.07);
    border-left:3px solid var(--a);
    border-radius:10px;padding:12px 13px;
    height:100%;display:flex;flex-direction:column;gap:3px;
}
.ii{font-size:.95rem;line-height:1;margin-bottom:2px;}
.it{font-size:.73rem;font-weight:700;color:#F8FAFC;line-height:1.3;}
.ib{color:rgba(255,255,255,.40)!important;font-size:.67rem;line-height:1.5;flex:1;}
.ia{margin-top:6px;}

/* ── Streamlit widget overrides ──────────────────────────────────────────── */
[data-testid="stSelectbox"]>div>div,
[data-testid="stTextInput"]>div>div{
    background:rgba(255,255,255,.05)!important;
    border:1px solid rgba(255,255,255,.10)!important;
    border-radius:8px!important;
    color:#F8FAFC!important;
}
[data-testid="baseButton-primary"]{
    background:linear-gradient(135deg,#4f52d3,#7c3aed)!important;
    border:none!important;border-radius:8px!important;font-weight:700!important;
    min-height:40px!important;letter-spacing:.02em!important;
}
[data-testid="baseButton-secondary"]{
    background:rgba(255,255,255,.06)!important;
    border:1px solid rgba(255,255,255,.10)!important;
    border-radius:8px!important;min-height:34px!important;
}
.stButton>button{font-size:.75rem!important;}
.stButton>button[kind="secondary"]{
    padding:4px 10px!important;min-height:30px!important;border-radius:7px!important;
}

/* ── Dataframe ───────────────────────────────────────────────────────────── */
[data-testid="stDataFrame"]{border-radius:8px!important;overflow:hidden!important;}

/* ── Plotly toolbar — hidden on all charts ───────────────────────────────── */
.modebar-container{display:none!important;}

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px;}

/* ── MOBILE FIRST (iPhone 17 ≈ 393px) ──────────────────────────────────── */
@media (max-width:768px){
    .block-container{padding:.4rem .4rem 4rem!important;}
    [data-testid="stHorizontalBlock"]{flex-direction:column!important;gap:8px!important;}
    [data-testid="column"]{width:100%!important;min-width:100%!important;flex:1 1 100%!important;}
    .kv{font-size:1.2rem!important;}
    .gc{padding:10px 11px 8px!important;}
    [data-testid="stVerticalBlockBorderWrapper"]{padding:10px 12px 8px!important;}
    body{overscroll-behavior:contain;}
}
@media (max-width:480px){.kv{font-size:1.05rem!important;}}
</style>
""", unsafe_allow_html=True)

# ══════════════════════════  GOOGLE OAUTH HELPERS  ═══════════════════════════
# Two separate OAuth flows:
#   1. LOGIN  — openid/email/profile only → no scary "unverified" warning
#   2. GMAIL  — adds gmail.readonly → shows warning once, stored in vault
_LOGIN_SCOPES = ["openid", "email", "profile"]
_GMAIL_SCOPES = _LOGIN_SCOPES + ["https://www.googleapis.com/auth/gmail.readonly"]

def _redirect_uri() -> str:
    return st.secrets.get("APP_URL", "http://localhost:8501")

def _google_login_url(client_id: str) -> str:
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id":     client_id,
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         " ".join(_LOGIN_SCOPES),
        "state":         "login",
    })

def _google_gmail_url(client_id: str, user_id: str) -> str:
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id":     client_id,
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         " ".join(_GMAIL_SCOPES),
        "access_type":   "offline",
        "prompt":        "consent",
        "state":         f"gmail:{user_id}",
    })

# Keep alias for backwards compat
def _google_auth_url(client_id: str) -> str:
    return _google_login_url(client_id)

def _exchange_gmail_code(code: str, client_id: str,
                         client_secret: str, redirect_uri: str) -> dict:
    import httpx
    r = httpx.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": client_id, "client_secret": client_secret,
        "redirect_uri": redirect_uri, "grant_type": "authorization_code",
    }, timeout=15)
    r.raise_for_status()
    return r.json()

def _calc_days_back(user_id: str) -> int:
    """Calculate how many days to look back based on latest transaction in DB."""
    try:
        client = create_client(st.secrets["SUPABASE_URL"],
                               st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
        r = (client.schema("finanzas").table("transacciones")
             .select("fecha").eq("user_id", user_id)
             .order("fecha", desc=True).limit(1).execute())
        if r.data:
            from datetime import timezone
            last = pd.to_datetime(r.data[0]["fecha"], utc=True)
            days = (datetime.now(tz=timezone.utc) - last).days
            return max(3, days + 3)   # buffer of 3 days
    except Exception:
        pass
    return 180   # first sync or error → full history


def sync_user_data(user_id: str) -> str:
    """Run ingestion pipeline for the current user directly from Streamlit."""
    import os as _os3, importlib
    for k in ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_ANON_KEY",
              "ENCRYPTION_KEY","GMAIL_CLIENT_ID","GMAIL_CLIENT_SECRET"]:
        _os3.environ[k] = st.secrets.get(k, "")
    _os3.environ.setdefault("SUPABASE_JWT_SECRET", "")
    _os3.environ["FINANCE_USER_ID"] = user_id
    _os3.environ["APP_ENV"]  = "production"
    _os3.environ["LOG_LEVEL"] = "WARNING"
    try:
        from uuid import UUID
        import sys

        # Reload modules in dependency order so new code takes effect
        reload_order = [
            "ingestion.connectors.parsers.santander_parser",
            "ingestion.connectors.gmail_connector",
            "ingestion.connectors.mercadopago_connector",
            "ingestion.base_connector",
            "ingestion.pipeline",
        ]
        for mod in reload_order:
            if mod in sys.modules:
                importlib.reload(sys.modules[mod])

        import ingestion.pipeline as _pip
        days_back = _calc_days_back(user_id)
        results = _pip.run_pipeline(UUID(user_id), days_back=days_back)
        total = sum(results.values())
        return f"✅ {total} nuevas (últimos {days_back}d)" if total else f"✅ Al día (últimos {days_back}d)"
    except Exception as exc:
        return f"⚠️ {str(exc)[:120]}"


def _check_gmail_connected(user_id: str) -> bool:
    try:
        client = create_client(st.secrets["SUPABASE_URL"],
                               st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
        res = (client.schema("finanzas").table("token_vault")
               .select("user_id").eq("user_id", user_id)
               .eq("service", "gmail_oauth2").execute())
        return bool(res.data)
    except Exception:
        return False

def _store_gmail_token(user_id_str: str, token_data: dict) -> None:
    import os as _os2
    from uuid import UUID
    from app.core.encryption import EncryptionService
    from app.core.token_vault import TokenVault
    _os2.environ["ENCRYPTION_KEY"] = st.secrets.get("ENCRYPTION_KEY", "")
    # Convert raw OAuth response to google.oauth2.credentials format
    formatted = {
        "token":         token_data.get("access_token", ""),
        "refresh_token": token_data.get("refresh_token", ""),
        "token_uri":     "https://oauth2.googleapis.com/token",
        "client_id":     st.secrets.get("GMAIL_CLIENT_ID", ""),
        "client_secret": st.secrets.get("GMAIL_CLIENT_SECRET", ""),
        "scopes":        ["https://www.googleapis.com/auth/gmail.readonly"],
    }
    enc   = EncryptionService.from_env()
    db    = create_client(st.secrets["SUPABASE_URL"],
                          st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
    vault = TokenVault(db=db, encryption=enc)
    vault.store(UUID(user_id_str), "gmail_oauth2", json.dumps(formatted))


# ══════════════════════════  AUTH  ═══════════════════════════════════════════
_anon = create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_ANON_KEY"])

def show_login():
    _, col, _ = st.columns([1, 1.2, 1])
    with col:
        st.markdown("""
        <div style="margin-top:80px;background:#0d1933;
             border:1px solid rgba(255,255,255,.08);border-radius:10px;
             padding:36px 32px 28px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:10px;">💳</div>
          <div style="font-size:1.55rem;font-weight:800;color:#F8FAFC;margin-bottom:6px;">
              Mis Finanzas</div>
          <div style="color:rgba(255,255,255,.35);font-size:.82rem;margin-bottom:24px;
               line-height:1.5;">
              Inteligencia financiera personal.<br>
              Inicia sesión con tu cuenta de Google para continuar.
          </div>
        </div>""", unsafe_allow_html=True)
        st.markdown("<div style='height:12px'/>", unsafe_allow_html=True)
        auth_url = _google_auth_url(st.secrets.get("GMAIL_CLIENT_ID", ""))
        st.link_button("  Continuar con Google", auth_url,
                       use_container_width=True, type="primary")
        st.markdown(
            "<p style='text-align:center;color:rgba(255,255,255,.22);font-size:.68rem;"
            "margin-top:10px;line-height:1.5;'>"
            "Al continuar autorizas acceso de <strong>solo lectura</strong> a tu Gmail<br>"
            "para importar movimientos de Santander automáticamente.</p>",
            unsafe_allow_html=True)

# ══════════════════════════  CARD ALIASES  ═══════════════════════════════════
@st.cache_data(ttl=0, show_spinner=False)
def load_card_aliases(user_id: str) -> dict[str, str]:
    """Load user's card aliases from DB. Returns {card_key: alias}."""
    try:
        client = create_client(st.secrets["SUPABASE_URL"],
                               st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
        res = (client.schema("finanzas").table("card_aliases")
               .select("card_key,alias").eq("user_id", user_id).execute())
        return {r["card_key"]: r["alias"] for r in (res.data or [])}
    except Exception:
        return {}

def save_card_alias(user_id: str, card_key: str, alias: str) -> None:
    client = create_client(st.secrets["SUPABASE_URL"],
                           st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
    (client.schema("finanzas").table("card_aliases")
     .upsert({"user_id": user_id, "card_key": card_key, "alias": alias},
             on_conflict="user_id,card_key").execute())
    load_card_aliases.clear()

def card_display_name(last4: str, aliases: dict) -> str:
    """Return alias if set, else ****last4."""
    return aliases.get(last4, f"****{last4}")

def get_user_income(aliases: dict) -> float:
    """Return user's monthly income from aliases dict (default 26,000)."""
    try:
        return float(aliases.get(_INCOME_KEY, _INCOME_DEFAULT))
    except (ValueError, TypeError):
        return _INCOME_DEFAULT


# ══════════════════════════  DATA  ═══════════════════════════════════════════
@st.cache_data(ttl=300, show_spinner=False)
def load_all(user_id: str) -> list[dict]:
    client = create_client(st.secrets["SUPABASE_URL"],
                           st.secrets["SUPABASE_SERVICE_ROLE_KEY"])
    since  = (datetime.now(tz=timezone.utc) - relativedelta(months=6)).isoformat()
    r = (client.schema("finanzas").table("transacciones")
         .select("fecha,monto,concepto,fuente,categoria")
         .eq("user_id", user_id).gte("fecha", since)
         .order("fecha", desc=True).limit(2000).execute())
    return r.data or []

def build_df(rows, aliases: dict | None = None):
    aliases = aliases or {}
    df = pd.DataFrame(rows)
    df["fecha"]     = pd.to_datetime(df["fecha"], format="ISO8601", utc=True)
    df["monto"]     = df["monto"].astype(float)
    df["mes"]       = df["fecha"].dt.to_period("M").dt.to_timestamp()
    df["cat"]       = df["categoria"].map(lambda c: CAT_LABELS.get(c, c.title()))
    df["tarjeta"]   = df["concepto"].str.extract(r"\*{4}(\d{4})")
    df["card_name"] = df.apply(
        lambda r: aliases.get("mp", "Mercado Pago 💜")
        if r.get("fuente") == "mercado_pago"
        else (card_display_name(r["tarjeta"], aliases)
              if pd.notna(r["tarjeta"]) else "Sin tarjeta"),
        axis=1,
    )
    df["comercio"]  = df["concepto"].str.replace(r"\s*\*{4}\d{4}$", "", regex=True)
    return df

# ══════════════════════════  PLOTLY THEME  ═══════════════════════════════════
_BG   = "rgba(0,0,0,0)"
_FONT = dict(family="Inter", color="rgba(255,255,255,.35)", size=10)
_HVRL = dict(bgcolor="rgba(2,6,23,.97)", bordercolor="rgba(255,255,255,.10)",
             font=dict(color="#F8FAFC", size=12, family="Inter"))
_XDEF = dict(showgrid=False, showline=False, zeroline=False,
             tickfont=dict(color="rgba(255,255,255,.35)", size=9.5))
_YDEF = dict(showgrid=True, gridcolor="rgba(255,255,255,.04)", gridwidth=1,
             showline=False, zeroline=False,
             tickfont=dict(color="rgba(255,255,255,.35)", size=9.5))
_LEG  = dict(bgcolor=_BG, font=dict(color="rgba(255,255,255,.4)", size=9),
             orientation="h", yanchor="bottom", y=-0.32,
             xanchor="center", x=0.5)

def _layout(**kw):
    return dict(paper_bgcolor=_BG, plot_bgcolor=_BG, font=_FONT,
                hoverlabel=_HVRL, **kw)


def pc_monthly(df: pd.DataFrame, highlight_cat: str | None = None, ver: int = 0):
    months = sorted(df["mes"].unique())
    m_lbl  = [pd.Timestamp(m).strftime("%b '%y") for m in months]
    cats   = [c for c in CAT_CLR if c in df["cat"].unique()]
    mc     = df.groupby(["mes", "cat"])["monto"].sum().unstack(fill_value=0)
    totals = [float(mc.loc[m].sum()) if m in mc.index else 0 for m in months]

    fig = go.Figure()
    for cat in cats:
        vals    = [float(mc.loc[m, cat]) if (m in mc.index and cat in mc.columns) else 0
                   for m in months]
        opacity = 1.0 if (highlight_cat is None or highlight_cat == cat) else 0.18
        fig.add_trace(go.Bar(
            name=cat, x=m_lbl, y=vals,
            marker=dict(color=CAT_CLR[cat], opacity=opacity, line=dict(width=0)),
            hovertemplate=f"<b>{cat}</b><br>%{{x}}: $%{{y:,.0f}}<extra></extra>",
        ))
    fig.add_trace(go.Scatter(
        name="Total", x=m_lbl, y=totals,
        mode="lines+text",
        line=dict(color="rgba(255,255,255,.45)", width=2, dash="dash"),
        text=[fmt(v) for v in totals],
        textposition="top center",
        textfont=dict(color="rgba(255,255,255,.7)", size=9, family="Inter"),
        hovertemplate="Total: $%{y:,.0f}<extra></extra>",
    ))
    fig.update_layout(**_layout(
        barmode="stack", height=260,
        margin=dict(l=4, r=4, t=16, b=65),
        legend=_LEG, bargap=0.28,
        xaxis=dict(**_XDEF),
        yaxis=dict(**_YDEF, showticklabels=False),
    ))
    sel = st.plotly_chart(fig, use_container_width=True,
                          on_select="rerun", key=f"monthly_v{ver}")
    if sel and sel.selection and sel.selection.points:
        pt    = sel.selection.points[0]
        c_num = getattr(pt, "curve_number", None)
        if c_num is not None and c_num < len(cats):
            return cats[c_num]
    return None


def pc_donut(df: pd.DataFrame, highlight_cat: str | None = None, ver: int = 0):
    by_cat = df.groupby("cat")["monto"].sum().sort_values(ascending=False)
    total  = by_cat.sum()
    labels = list(by_cat.index)
    values = [round(float(v), 2) for v in by_cat.values]

    rgba_colors = []
    for cat in labels:
        hex_c    = CAT_CLR.get(cat, "#64748B").lstrip("#")
        r, g, b  = int(hex_c[0:2], 16), int(hex_c[2:4], 16), int(hex_c[4:6], 16)
        op       = 1.0 if (highlight_cat is None or highlight_cat == cat) else 0.18
        rgba_colors.append(f"rgba({r},{g},{b},{op:.2f})")

    fig = go.Figure(go.Pie(
        labels=labels, values=values,
        hole=0.55,
        marker=dict(colors=rgba_colors,
                    line=dict(color="rgba(2,6,23,.5)", width=2)),
        textinfo="none",
        hovertemplate="<b>%{label}</b><br>$%{value:,.0f} · <b>%{percent}</b><extra></extra>",
    ))
    fig.add_annotation(text=f"<b>{fmt(total)}</b>", x=0.38, y=0.56,
                       font=dict(size=17, color="#F8FAFC", family="Inter"),
                       showarrow=False)
    fig.add_annotation(text="total", x=0.38, y=0.43,
                       font=dict(size=10, color="rgba(255,255,255,.30)", family="Inter"),
                       showarrow=False)
    fig.update_layout(**_layout(
        height=240, margin=dict(l=0, r=90, t=10, b=10),
        showlegend=True,
        legend=dict(bgcolor=_BG,
                    font=dict(color="rgba(255,255,255,.45)", size=9.5),
                    orientation="v", yanchor="middle", y=0.5,
                    xanchor="left", x=0.78,
                    itemwidth=30, itemsizing="constant"),
    ))
    sel = st.plotly_chart(fig, use_container_width=True,
                          on_select="rerun", key=f"donut_v{ver}")
    if sel and sel.selection and sel.selection.points:
        pt    = sel.selection.points[0]
        label = getattr(pt, "label", None)
        if label:
            return label
    return None


def pc_trend(df: pd.DataFrame):
    monthly = df.groupby("mes")["monto"].sum().sort_index()
    labels  = [pd.Timestamp(m).strftime("%b '%y") for m in monthly.index]
    vals    = [round(float(v), 2) for v in monthly.values]
    avg     = float(np.mean(vals)) if vals else 0

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        name="Gasto", x=labels, y=vals,
        mode="lines",
        line=dict(color="#818CF8", width=3, shape="spline"),
        fill="tozeroy",
        fillcolor="rgba(129,140,248,.18)",
        hovertemplate="$%{y:,.0f}<extra>%{x}</extra>",
    ))
    fig.add_trace(go.Scatter(
        name=f"Prom {fmt(avg)}", x=labels, y=[avg] * len(labels),
        mode="lines",
        line=dict(color="rgba(255,255,255,.18)", width=1.5, dash="dash"),
        hoverinfo="skip",
    ))
    fig.update_layout(**_layout(
        height=155, margin=dict(l=4, r=4, t=6, b=24),
        hovermode="x unified", showlegend=False,
        xaxis=dict(**_XDEF),
        yaxis=dict(**_YDEF, showticklabels=False),
    ))
    st.plotly_chart(fig, use_container_width=True, key="trend")


def pc_top_merchants(df: pd.DataFrame, highlight_cat: str | None = None, n: int = 8):
    src    = df if highlight_cat is None else df[df["cat"] == highlight_cat]
    top    = src.groupby("comercio")["monto"].sum().sort_values(ascending=True).tail(n)
    if top.empty:
        st.caption("Sin datos")
        return
    n_bars = len(top)
    colors = [f"rgba(99,102,241,{.3 + .7 * i / max(n_bars - 1, 1):.2f})"
              for i in range(n_bars)]
    fig = go.Figure(go.Bar(
        x=list(top.values), y=list(top.index),
        orientation="h",
        marker=dict(color=colors, line=dict(width=0)),
        text=[fmt(float(v)) for v in top.values],
        textposition="outside",
        textfont=dict(color="rgba(255,255,255,.5)", size=10, family="Inter"),
        hovertemplate="<b>%{y}</b><br>$%{x:,.0f}<extra></extra>",
    ))
    fig.update_layout(**_layout(
        height=max(180, n * 28),
        margin=dict(l=4, r=52, t=6, b=6),
        showlegend=False,
        xaxis=dict(**_XDEF, showticklabels=False,
                   range=[0, float(top.max()) * 1.32]),
        yaxis={**_YDEF, "showgrid": False,
               "tickfont": dict(color="rgba(255,255,255,.55)", size=10)},
    ))
    st.plotly_chart(fig, use_container_width=True, key="merchants")


def pc_card_split(df: pd.DataFrame):
    by_card = df.groupby("card_name")["monto"].sum().sort_values(ascending=False)
    total   = by_card.sum()
    COLORS  = ["#6366f1", "#059669", "#9333ea", "#b45309"]
    labels  = list(by_card.index)
    values  = [round(float(v), 2) for v in by_card.values]

    fig = go.Figure(go.Bar(
        x=labels, y=values,
        marker=dict(color=[COLORS[i % 4] for i in range(len(labels))],
                    line=dict(width=0)),
        text=[f"{fmt(v)}<br>{v / total * 100:.0f}%" for v in values],
        textposition="outside",
        textfont=dict(color="rgba(255,255,255,.55)", size=9, family="Inter"),
        hovertemplate="<b>%{x}</b><br>$%{y:,.0f}<extra></extra>",
    ))
    fig.update_layout(**_layout(
        height=185, margin=dict(l=4, r=4, t=30, b=10),
        showlegend=False, bargap=0.35,
        xaxis={**_XDEF, "tickangle": -12,
               "tickfont": dict(color="rgba(255,255,255,.45)", size=9)},
        yaxis=dict(**_YDEF, showticklabels=False),
    ))
    st.plotly_chart(fig, use_container_width=True, key="cards")


def pc_budget_gauge(pct: float):
    color = "#22C55E" if pct < 65 else ("#FBBF24" if pct < 85 else "#F87171")
    fig   = go.Figure(go.Indicator(
        mode="gauge+number",
        value=min(pct, 100),
        number=dict(suffix="%", font=dict(size=20, color=color, family="Inter")),
        gauge=dict(axis=dict(range=[0, 100], visible=False),
                   bar=dict(color=color, thickness=0.7),
                   bgcolor="rgba(255,255,255,.07)", borderwidth=0),
        domain=dict(x=[0, 1], y=[0.15, 1]),
    ))
    fig.add_annotation(text="del ingreso", x=0.5, y=0.05,
                       font=dict(size=9.5, color="rgba(255,255,255,.32)", family="Inter"),
                       showarrow=False)
    fig.update_layout(**_layout(height=155, margin=dict(l=20, r=20, t=20, b=30)))
    st.plotly_chart(fig, use_container_width=True, key="gauge")


# ══════════════════════════  STORY ENGINE  ═══════════════════════════════════
def story_banner(df: pd.DataFrame, total: float, avg_m: float,
                 n_months: int, budget_pct: float, savings_m: float) -> str:
    """Return a 1–2 sentence financial health narrative."""
    month_label = df["mes"].max()
    month_str   = pd.Timestamp(month_label).strftime("%B")
    top_cat     = df.groupby("cat")["monto"].sum().idxmax() if len(df) else "—"
    top_v       = df.groupby("cat")["monto"].sum().max() if len(df) else 0

    if n_months <= 1:
        scope = f"Este mes ({month_str})"
    elif n_months <= 3:
        scope = f"En los últimos {n_months} meses"
    else:
        scope = "En los últimos 6 meses"

    if budget_pct < 65:
        verdict = (f"💚 <strong>Vas muy bien</strong> — gastaste el "
                   f"<strong>{budget_pct:.0f}%</strong> de tu ingreso mensual.")
        tip     = f"Tu mayor gasto es <strong>{top_cat}</strong> ({fmt(top_v)}). Tienes margen para ahorrar {fmt(savings_m)}/mes."
    elif budget_pct < 85:
        verdict = (f"🟡 <strong>Atención</strong> — gastaste el "
                   f"<strong>{budget_pct:.0f}%</strong> de tu ingreso mensual.")
        tip     = f"<strong>{top_cat}</strong> absorbe {fmt(top_v)} ({top_v/total*100:.0f}% del total). Reducir ahí libera {fmt(top_v*0.15)}/mes."
    else:
        verdict = (f"🔴 <strong>Alerta de presupuesto</strong> — gastaste el "
                   f"<strong>{budget_pct:.0f}%</strong> de tu ingreso mensual.")
        tip     = (f"Con {fmt(avg_m)}/mes de gasto vs {fmt(income_m)} de ingreso "
                   f"solo ahorras {fmt(max(savings_m,0))}. <strong>{top_cat}</strong> es tu mayor rubro.")

    return f"{scope}: {verdict} {tip}"


def compute_insights(df, df_prev, income_m=_INCOME_DEFAULT):
    out      = []
    total    = df["monto"].sum()
    n_months = max(df["mes"].nunique(), 1)
    prev_t   = df_prev["monto"].sum() if len(df_prev) else 0
    cat_tot  = df.groupby("cat")["monto"].sum().sort_values(ascending=False)
    merch    = df.groupby("comercio")["monto"].sum().sort_values(ascending=False)
    daily    = total / max((df["fecha"].max() - df["fecha"].min()).days, 1)
    avg_m    = total / n_months
    sav_m    = income_m - avg_m
    sav_rate = sav_m / income_m * 100

    # ── MoM change ─────────────────────────────────────────────────────────── #
    if prev_t > 0:
        pct = (total - prev_t) / prev_t * 100
        if pct > 10:
            out.append(dict(icon="📈", accent="#F87171",
                title=f"Gasto subió {pct:.0f}% vs periodo anterior",
                body=(f"Pasaste de {fmt(prev_t)} a {fmt(total)}. "
                      f"Diferencia: {fmt(total-prev_t)} extra."),
                action="Ver periodo anterior", action_cat=None, action_period="Mes anterior"))
        elif pct < -10:
            out.append(dict(icon="🎉", accent="#22C55E",
                title=f"¡{abs(pct):.0f}% menos que el periodo anterior!",
                body=f"Ahorraste {fmt(prev_t-total)} vs el periodo anterior. ¡Sigue así!",
                action=None, action_cat=None, action_period=None))

    # ── Top heavy category ─────────────────────────────────────────────────── #
    if len(cat_tot) and total > 0:
        top_cat = cat_tot.index[0]
        top_pct = cat_tot.iloc[0] / total * 100
        if top_pct > 28 and top_cat not in ("Transferencias",):
            saving_potential = cat_tot.iloc[0] * 0.20
            out.append(dict(icon="⚠️", accent="#FBBF24",
                title=f"{top_cat} = {top_pct:.0f}% de tu presupuesto",
                body=(f"Gastaste {fmt(cat_tot.iloc[0])} en {top_cat}. "
                      f"Reducir 20% → {fmt(saving_potential)}/mes · {fmt(saving_potential*12)}/año."),
                action=f"Explorar {top_cat}", action_cat=top_cat, action_period=None))

    # ── Burn rate ──────────────────────────────────────────────────────────── #
    out.append(dict(icon="🔥", accent="#FB923C",
        title=f"Burn rate {fmt(daily)}/día — {fmt(daily*30)}/mes estimado",
        body=(f"A este ritmo gastarás {fmt(daily*365)}/año. "
              f"Ahorrar $200/día = {fmt(200*365)}/año adicionales."),
        action="Ver comercios", action_cat=None, action_period=None))

    # ── Savings vs income ─────────────────────────────────────────────────── #
    if sav_m > 0:
        icon_sav = "💚" if sav_rate >= SAVINGS_TARGET*100 else "💡"
        status   = "¡Meta de 20% alcanzada!" if sav_rate >= SAVINGS_TARGET*100 else f"Meta: 20% ({fmt(income_m*.20)}/mes)"
        out.append(dict(icon=icon_sav, accent="#22C55E",
            title=f"Ahorro proyectado: {fmt(sav_m)}/mes ({sav_rate:.0f}%)",
            body=f"Ingreso {fmt(income_m)} · Gasto {fmt(avg_m)}. {status}",
            action=None, action_cat=None, action_period=None))
    else:
        over = abs(sav_m)
        out.append(dict(icon="🚨", accent="#F87171",
            title=f"Gastas {fmt(over)}/mes más de lo que ingresas",
            body=(f"Ingreso {fmt(income_m)} · Gasto {fmt(avg_m)}. "
                  f"Revisar {cat_tot.index[0] if len(cat_tot) else '—'} primero."),
            action="Ver categoría", action_cat=cat_tot.index[0] if len(cat_tot) else None,
            action_period=None))

    # ── Top merchant concentration ─────────────────────────────────────────── #
    if len(merch) and merch.iloc[0] / total > 0.10:
        out.append(dict(icon="🏪", accent="#A78BFA",
            title=f"{merch.index[0][:22]} representa el {merch.iloc[0]/total*100:.0f}%",
            body=(f"Gastaste {fmt(merch.iloc[0])} en un solo comercio. "
                  f"¿Es recurrente o fue un gasto puntual?"),
            action=None, action_cat=None, action_period=None))

    # ── Entertainment vs Food ratio ─────────────────────────────────────────── #
    ent = float(cat_tot.get("Entretenimiento", 0))
    food = float(cat_tot.get("Comida", 0))
    if ent > 0 and food > 0 and ent > food * 1.5:
        out.append(dict(icon="🎭", accent="#818CF8",
            title=f"Entretenimiento ({fmt(ent)}) supera Comida ({fmt(food)}) en {ent/food:.1f}x",
            body=(f"Tus gastos sociales/ocio son más altos que los de sustento. "
                  f"Ajustar baja {fmt((ent-food)*.5)}/mes."),
            action="Ver Entretenimiento", action_cat="Entretenimiento", action_period=None))

    return out[:5]


# ══════════════════════════  DASHBOARD  ══════════════════════════════════════
def show_dashboard(user_id: str):
    # ── Session state ── #
    if "chart_cat" not in st.session_state:
        st.session_state["chart_cat"] = None
    if "click_ver" not in st.session_state:
        st.session_state["click_ver"] = 0

    # ── Auto-sync on first visit of each session ── #
    if not st.session_state.get("_data_loaded"):
        with st.spinner("🔄 Sincronizando correos..."):
            msg = sync_user_data(user_id)
        st.session_state["_data_loaded"] = True
        st.session_state["_last_sync_msg"] = msg
        load_all.clear()

    aliases        = load_card_aliases(user_id)
    income_monthly = get_user_income(aliases)
    income_biweekly = income_monthly / 2

    with st.spinner(""):
        rows = load_all(user_id)
    if not rows:
        st.warning("Sin transacciones. Corre el pipeline de ingesta.")
        if st.button("Salir"): st.session_state.clear(); st.rerun()
        return

    df_all = build_df(rows, aliases)

    # ── Header ── #
    ha, hb, hc = st.columns([7, 1, 1])
    with ha:
        st.markdown(
            "<p style='font-size:1.2rem;font-weight:900;margin:0 0 1px;color:#F8FAFC;'>"
            "💳 Mis Finanzas</p>"
            f"<p style='color:rgba(255,255,255,.22);font-size:.64rem;margin:0 0 4px;'>"
            f"Inteligencia financiera · {datetime.now().strftime('%d %b %Y')}</p>",
            unsafe_allow_html=True)
    with hb:
        if st.button("↺", type="secondary", use_container_width=True, help="Sincronizar correos"):
            with st.spinner("🔄 Sincronizando..."):
                msg = sync_user_data(user_id)
            st.session_state["_last_sync_msg"] = msg
            load_all.clear()
            st.rerun()
    with hc:
        if st.button("Salir", type="secondary", use_container_width=True):
            _clear_session_cookies()
            st.session_state.clear(); st.rerun()

    # ── Income + Card alias manager ── #
    card_endings = sorted(df_all["tarjeta"].dropna().unique())
    has_mp = (df_all.get("fuente", pd.Series()) == "mercado_pago").any() if "fuente" in df_all.columns else False
    with st.expander("⚙️ Mi perfil — ingreso y tarjetas", expanded=False):
        st.markdown(
            "<p style='color:rgba(255,255,255,.4);font-size:.72rem;margin:0 0 10px;'>"
            "Todo se guarda en tu perfil y se aplica en todo el dashboard.</p>",
            unsafe_allow_html=True)

        # ── Ingreso mensual ── #
        st.markdown("<span style='color:rgba(255,255,255,.5);font-size:.62rem;font-weight:700;"
                    "text-transform:uppercase;letter-spacing:.1em;'>💵 Ingreso mensual (MXN)</span>",
                    unsafe_allow_html=True)
        new_income = st.number_input(
            "Ingreso mensual", value=float(income_monthly),
            min_value=0.0, step=500.0, format="%.0f",
            label_visibility="collapsed", key="income_input")
        if new_income != income_monthly:
            if st.button("Guardar ingreso", type="primary", key="save_income"):
                save_card_alias(user_id, _INCOME_KEY, str(int(new_income)))
                st.success(f"✅ Ingreso actualizado: {fmt(new_income)}/mes")
                load_card_aliases.clear()
                st.rerun()

        st.markdown("<div style='height:10px'/>", unsafe_allow_html=True)
        st.markdown("<span style='color:rgba(255,255,255,.5);font-size:.62rem;font-weight:700;"
                    "text-transform:uppercase;letter-spacing:.1em;'>💳 Nombres de tarjetas</span>",
                    unsafe_allow_html=True)
        pending = {}
        cols_per_row = 3
        all_keys = list(card_endings) + (["mp"] if has_mp else [])
        for i in range(0, len(all_keys), cols_per_row):
            cols = st.columns(cols_per_row)
            for j, key in enumerate(all_keys[i:i+cols_per_row]):
                label = f"Mercado Pago" if key == "mp" else f"****{key}"
                default = aliases.get(key, "Mercado Pago 💜" if key == "mp" else f"****{key}")
                val = cols[j].text_input(label, value=default, key=f"ca_{key}")
                if val != default:
                    pending[key] = val
        if pending:
            if st.button("💾 Guardar nombres", type="primary"):
                for k, v in pending.items():
                    save_card_alias(user_id, k, v)
                st.success("✅ Nombres guardados")
                st.rerun()

    # ── Filters (single row) ── #
    st.markdown('<div class="fs">', unsafe_allow_html=True)
    f1, f2, f3, f4 = st.columns([2, 2.2, 2, 2.2])
    with f1:
        period = st.selectbox("Periodo",
            ["Últimos 6 meses","Este mes","Mes anterior","Últimos 3 meses","Personalizado"],
            label_visibility="collapsed", key="period_sel")
    with f2:
        cards_avail = sorted(df_all["tarjeta"].dropna().unique())
        card_opts   = ["Todas las tarjetas"] + [
            f"{card_display_name(c, aliases)} (****{c})" for c in cards_avail]
        card_sel = st.selectbox("Tarjeta", card_opts, label_visibility="collapsed")
    with f3:
        all_cats = ["Todas las categorías"] + sorted(df_all["cat"].unique())
        default_idx = 0
        if st.session_state["chart_cat"] in all_cats:
            default_idx = all_cats.index(st.session_state["chart_cat"])
        cat_sel = st.selectbox("Categoría", all_cats, index=default_idx,
                               label_visibility="collapsed", key="cat_sel_box")
        if cat_sel == "Todas las categorías":
            st.session_state["chart_cat"] = None
    with f4:
        q = st.text_input("q", placeholder="🔍  Buscar…", label_visibility="collapsed")
    st.markdown('</div>', unsafe_allow_html=True)

    # Custom date range (only when Personalizado)
    if period == "Personalizado":
        all_m  = sorted(df_all["mes"].unique())
        m_lbls = [pd.Timestamp(m).strftime("%b %Y") for m in all_m]
        pa, pb, _ = st.columns([2, 2, 5])
        with pa: s_lbl = st.selectbox("Desde", m_lbls, 0)
        with pb: e_lbl = st.selectbox("Hasta", m_lbls, len(m_lbls)-1)
        start_m = all_m[m_lbls.index(s_lbl)]
        end_m   = all_m[m_lbls.index(e_lbl)]
    else:
        now = pd.Timestamp(datetime.now()).floor("D")
        if   period == "Este mes":
            start_m = now.to_period("M").to_timestamp(); end_m = now
        elif period == "Mes anterior":
            prev    = now - relativedelta(months=1)
            start_m = prev.to_period("M").to_timestamp()
            end_m   = start_m + relativedelta(months=1) - relativedelta(days=1)
        elif period == "Últimos 3 meses":
            start_m = (now - relativedelta(months=3)).to_period("M").to_timestamp(); end_m = now
        else:
            start_m = (now - relativedelta(months=6)).to_period("M").to_timestamp(); end_m = now

    # Apply filters
    df = df_all[(df_all["mes"] >= start_m) & (df_all["mes"] <= end_m)].copy()
    if card_sel != "Todas las tarjetas":
        last4 = card_sel.split("****")[-1].rstrip(")")
        df = df[df["tarjeta"] == last4]
    if cat_sel != "Todas las categorías":
        df = df[df["cat"] == cat_sel]
    if q:
        df = df[df["concepto"].str.contains(q, case=False, na=False)]

    if df.empty:
        st.warning("Sin transacciones con los filtros actuales.")
        return

    prev_s  = pd.Timestamp(start_m - relativedelta(months=1))
    prev_e  = pd.Timestamp(start_m - relativedelta(days=1))
    df_prev = df_all[(df_all["mes"] >= prev_s) & (df_all["mes"] <= prev_e)]

    # ── Core metrics ── #
    total        = df["monto"].sum()
    n_months     = max(df["mes"].nunique(), 1)
    avg_m        = total / n_months
    prev_t       = df_prev["monto"].sum() if len(df_prev) else 0
    dpct         = (total - prev_t) / prev_t * 100 if prev_t else 0
    days         = max((df["fecha"].max() - df["fecha"].min()).days, 1)
    budget_pct   = avg_m / income_monthly * 100
    savings_m    = income_monthly - avg_m
    savings_rate = max(0, savings_m / income_monthly * 100)
    bar_color    = "#22C55E" if budget_pct < 65 else ("#FBBF24" if budget_pct < 85 else "#F87171")
    sav_color    = "#22C55E" if savings_rate >= SAVINGS_TARGET * 100 else "#FBBF24"
    pay_date, pay_days = next_payday()
    cat_totals   = df.groupby("cat")["monto"].sum()
    top_cat      = cat_totals.idxmax() if len(cat_totals) else "—"
    top_cat_pct  = f"{cat_totals.max()/total*100:.0f}%" if len(cat_totals) and total else "—"

    # ── Last sync result ── #
    if st.session_state.get("_last_sync_msg"):
        msg = st.session_state.pop("_last_sync_msg")
        if "✅" in msg:
            st.toast(msg, icon="✅")
        elif "⚠️" in msg:
            st.toast(msg, icon="⚠️")

    # ── Active chart-filter chip ── #
    hcat = st.session_state["chart_cat"]
    if hcat:
        bc1, bc2 = st.columns([7, 1])
        with bc1:
            st.markdown(
                f'<div class="cf-banner">🔍 Filtrando por: <strong>{hcat}</strong>'
                ' — clic en otra categoría para cambiar →</div>',
                unsafe_allow_html=True)
        with bc2:
            if st.button("✕ Limpiar", type="secondary", use_container_width=True):
                st.session_state["chart_cat"] = None
                st.rerun()

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 0 · KPI strip — 7 cards, each with a colored top accent line        #
    # ──────────────────────────────────────────────────────────────────────── #
    k = st.columns(7, gap="small")
    kpis = [
        ("💰 TOTAL",       fmt(total),
         f"{'▲' if dpct>0 else '▼'} {abs(dpct):.0f}% vs ant.",
         "up" if dpct > 0 else "dn",  "#F87171" if dpct > 0 else "#22C55E"),
        ("📅 MENSUAL",     fmt(avg_m),
         f"{n_months} mes(es)",          "nt", "#6366f1"),
        ("📋 TXNS",        str(len(df)),
         "movimientos",                  "nt", "#818CF8"),
        ("🔥 DIARIO",      fmt(total/days),
         "burn rate",                    "nt", "#FB923C"),
        ("🏆 TOP CAT.",    top_cat,
         top_cat_pct + " del gasto",     "nt", "#A78BFA"),
        ("💚 AHORRO",      fmt(savings_m),
         f"tasa {savings_rate:.0f}% · meta 20%", "nt", sav_color),
        ("📅 PRÓX. PAGO",  f"{pay_days}d",
         f"jue {pay_date} · {fmt(income_biweekly)}", "nt", "#67E8F9"),
    ]
    for col, (lbl, val, sub, cls, ac) in zip(k, kpis):
        is_text = not val.replace("$","").replace("k","").replace(".","").replace(",","").isdigit()
        v_class = "kv kv-txt" if is_text else "kv"
        col.markdown(
            f'<div class="gc" style="border-top:2px solid {ac};">'
            f'<div class="kl">{lbl}</div>'
            f'<div class="{v_class}">{val}</div>'
            f'<div class="ks {cls}">{sub}</div></div>',
            unsafe_allow_html=True)

    # ── Budget strip (slim, below KPIs) ── #
    st.markdown(
        f'<div class="bstrip">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        f'<span style="color:rgba(255,255,255,.32);font-size:.58rem;font-weight:700;'
        f'text-transform:uppercase;letter-spacing:.1em;">💵 Presupuesto mensual · Ingreso {fmt(income_monthly)}</span>'
        f'<span style="color:{bar_color};font-size:.68rem;font-weight:700;">'
        f'{fmt(avg_m)} gastado ({budget_pct:.0f}%)'
        f'<span style="color:rgba(255,255,255,.28);font-weight:400;"> · Restante: {fmt(max(income_monthly-avg_m,0))}'
        f'</span></span></div>'
        f'<div class="bbar-wrap"><div class="bbar-fill" '
        f'style="width:{min(budget_pct,100):.0f}%;background:{bar_color};"></div></div>'
        f'</div>',
        unsafe_allow_html=True)

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 1 · Main charts — IMMEDIATELY VISIBLE after KPIs                    #
    # ──────────────────────────────────────────────────────────────────────── #
    st.markdown(
        '<p style="color:rgba(255,255,255,.18);font-size:.60rem;margin:0 0 5px;">'
        '💡 <em>Haz clic en una categoría para filtrar todas las gráficas</em></p>',
        unsafe_allow_html=True)

    ver = st.session_state["click_ver"]
    r1a, r1b = st.columns([5.5, 2.8], gap="small")
    with r1a:
        with st.container(border=True):
            st.markdown('<span class="sl">📊 Gasto mensual por categoría</span>',
                        unsafe_allow_html=True)
            ev_monthly = pc_monthly(df, highlight_cat=hcat, ver=ver)
        if ev_monthly and ev_monthly not in ("Total", None):
            new = None if ev_monthly == st.session_state["chart_cat"] else ev_monthly
            st.session_state["chart_cat"] = new
            st.session_state["click_ver"] += 1
            st.rerun()
    with r1b:
        with st.container(border=True):
            st.markdown('<span class="sl">🍩 Distribución por categoría</span>',
                        unsafe_allow_html=True)
            ev_donut = pc_donut(df, highlight_cat=hcat, ver=ver)
        if ev_donut:
            new = None if ev_donut == st.session_state["chart_cat"] else ev_donut
            st.session_state["chart_cat"] = new
            st.session_state["click_ver"] += 1
            st.rerun()

    st.markdown("<div style='height:8px'/>", unsafe_allow_html=True)

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 2 · Trend + Card split                                               #
    # ──────────────────────────────────────────────────────────────────────── #
    r2a, r2b = st.columns([3.8, 2.4], gap="small")
    with r2a:
        with st.container(border=True):
            st.markdown('<span class="sl">📈 Tendencia mensual de gasto</span>',
                        unsafe_allow_html=True)
            pc_trend(df)
    with r2b:
        with st.container(border=True):
            st.markdown('<span class="sl">💳 Gasto por tarjeta</span>',
                        unsafe_allow_html=True)
            pc_card_split(df)

    st.markdown("<div style='height:8px'/>", unsafe_allow_html=True)

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 3 · Story banner + Insights (compact horizontal, BELOW charts)       #
    # ──────────────────────────────────────────────────────────────────────── #
    story = story_banner(df, total, avg_m, n_months, budget_pct, savings_m)
    st.markdown(f'<div class="story-banner">{story}</div>', unsafe_allow_html=True)

    insights = compute_insights(df, df_prev, income_m=income_monthly)
    st.markdown('<span class="sl">💡 Insights · Acciones recomendadas</span>',
                unsafe_allow_html=True)
    ins_cols = st.columns(len(insights), gap="small")
    for i, (col, ins) in enumerate(zip(ins_cols, insights)):
        with col:
            st.markdown(
                f'<div class="ic" style="--a:{ins["accent"]}">'
                f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
                f'<span class="ii">{ins["icon"]}</span>'
                f'<span class="it">{ins["title"]}</span></div>'
                f'<div class="ib">{ins["body"]}</div>'
                f'</div>', unsafe_allow_html=True)
            if ins.get("action"):
                if ins.get("action_cat"):
                    if st.button(f"→ {ins['action']}", key=f"ins_{i}", type="secondary"):
                        st.session_state["chart_cat"] = ins["action_cat"]
                        st.rerun()
                elif ins.get("action_period"):
                    if st.button(f"→ {ins['action']}", key=f"ins_{i}", type="secondary"):
                        st.session_state["period_sel"] = ins["action_period"]
                        st.rerun()

    st.markdown("<div style='height:8px'/>", unsafe_allow_html=True)

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 4 · Top merchants + Transaction table                                #
    # ──────────────────────────────────────────────────────────────────────── #
    r3a, r3b = st.columns([3, 5], gap="small")
    with r3a:
        with st.container(border=True):
            lbl_extra = f" · {hcat}" if hcat else ""
            st.markdown(f'<span class="sl">🏪 Top comercios{lbl_extra}</span>',
                        unsafe_allow_html=True)
            pc_top_merchants(df, highlight_cat=hcat, n=8)
    with r3b:
        with st.container(border=True):
            st.markdown(f'<span class="sl">📄 Transacciones ({len(df)})</span>',
                        unsafe_allow_html=True)
            disp = df[["fecha","comercio","monto","cat","card_name"]].copy()
            disp = disp.sort_values("monto", ascending=False)
            disp["fecha"] = disp["fecha"].dt.tz_localize(None)  # remove tz for display
            disp.columns  = ["Fecha","Comercio","Monto","Categoría","Tarjeta"]
            st.dataframe(
                disp,
                use_container_width=True,
                hide_index=True,
                height=min(400, 35*min(len(disp),13)+38),
                column_config={
                    "Fecha": st.column_config.DatetimeColumn(
                        "Fecha", format="DD/MM/YYYY", width="small"),
                    "Monto": st.column_config.NumberColumn(
                        "Monto", format="$%.2f", width="small"),
                    "Comercio": st.column_config.TextColumn("Comercio", width="medium"),
                    "Categoría": st.column_config.TextColumn("Categoría", width="small"),
                    "Tarjeta": st.column_config.TextColumn("Tarjeta", width="small"),
                },
            )


# ══════════════════════════  GMAIL CONNECT PAGE  ═════════════════════════════
def show_gmail_connect(user_id: str):
    """Full-screen Gmail OAuth connect page shown after first login."""
    client_id = st.secrets.get("GMAIL_CLIENT_ID", "")
    if not client_id:
        st.warning("Gmail OAuth no está configurado.")
        if st.button("Salir", type="secondary"):
            st.session_state.clear(); st.rerun()
        return

    auth_url = _google_gmail_url(client_id, user_id)

    _, col, _ = st.columns([1, 1.4, 1])
    with col:
        st.markdown(f"""
        <div style="margin-top:60px;background:#0d1933;
             border:1px solid rgba(99,102,241,.25);border-radius:10px;
             padding:32px 28px 24px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:12px;">📧</div>
          <div style="font-size:1.25rem;font-weight:800;color:#F8FAFC;margin-bottom:8px;">
            Conecta tu Gmail</div>
          <div style="color:rgba(255,255,255,.45);font-size:.82rem;line-height:1.6;margin-bottom:20px;">
            Mis Finanzas leerá tus correos de Santander para importar<br>
            tus movimientos automáticamente cada día.<br><br>
            <strong style="color:rgba(255,255,255,.65);">Permiso solicitado:</strong>
            sólo lectura de Gmail — nunca escribe ni envía correos.
          </div>
        </div>""", unsafe_allow_html=True)
        st.link_button("🔗 Conectar con Gmail", auth_url,
                       use_container_width=True, type="primary")
        st.markdown("<div style='height:8px'/>", unsafe_allow_html=True)
        if st.button("Salir", type="secondary", use_container_width=True):
            st.session_state.clear(); st.rerun()


# ══════════════════════════  MAIN  ═══════════════════════════════════════════
def _set_session_cookies(access_token: str, refresh_token: str, user_id: str):
    """Persist session in browser cookies so refresh doesn't require re-login."""
    max_age = 7 * 24 * 3600
    secure = "; secure" if _redirect_uri().startswith("https") else ""
    st.markdown(f"""<script>
(function(){{
  var exp = "; max-age={max_age}; path=/{secure}; samesite=strict";
  document.cookie = "sf_at={access_token}" + exp;
  document.cookie = "sf_rt={refresh_token}" + exp;
  document.cookie = "sf_uid={user_id}" + exp;
}})();
</script>""", unsafe_allow_html=True)


def _clear_session_cookies():
    st.markdown("""<script>
(function(){
  ["sf_at","sf_rt","sf_uid"].forEach(function(n){
    document.cookie = n + "=; max-age=0; path=/";
  });
})();
</script>""", unsafe_allow_html=True)


def _restore_session_from_cookies() -> bool:
    """Try to restore session from browser cookies. Returns True if successful."""
    try:
        cookies     = st.context.cookies
        access_token = cookies.get("sf_at", "")
        refresh_token = cookies.get("sf_rt", "")
        user_id      = cookies.get("sf_uid", "")
        if not access_token or not user_id:
            return False
        # Validate token with Supabase
        user_resp = _anon.auth.get_user(access_token)
        if user_resp and user_resp.user:
            st.session_state.update(access_token=access_token, user_id=user_resp.user.id)
            return True
    except Exception:
        # Token expired — try refresh
        try:
            cookies = st.context.cookies
            refresh_token = cookies.get("sf_rt", "")
            if refresh_token:
                resp = _anon.auth.refresh_session(refresh_token)
                _set_session_cookies(resp.session.access_token,
                                     resp.session.refresh_token,
                                     resp.user.id)
                st.session_state.update(access_token=resp.session.access_token,
                                        user_id=resp.user.id)
                return True
        except Exception:
            pass
    return False


def _handle_login_callback(code: str) -> None:
    """Login-only callback: openid/email/profile — no Gmail scope, no scary warning."""
    client_id     = st.secrets.get("GMAIL_CLIENT_ID", "")
    client_secret = st.secrets.get("GMAIL_CLIENT_SECRET", "")
    with st.spinner("Iniciando sesión..."):
        try:
            tokens   = _exchange_gmail_code(code, client_id, client_secret, _redirect_uri())
            id_token = tokens.get("id_token", "")
            resp     = _anon.auth.sign_in_with_id_token({"provider": "google", "token": id_token})
            user_id  = resp.user.id
            st.query_params.clear()
            st.cache_data.clear()
            st.session_state.update(access_token=resp.session.access_token, user_id=user_id)
            _set_session_cookies(resp.session.access_token,
                                 resp.session.refresh_token or "", user_id)
            st.rerun()
        except Exception as exc:
            st.query_params.clear()
            st.error(f"Error al iniciar sesión: {exc}")


def _handle_gmail_callback(code: str, user_id: str) -> None:
    """Gmail callback: stores gmail.readonly tokens in vault for ingestion pipeline."""
    client_id     = st.secrets.get("GMAIL_CLIENT_ID", "")
    client_secret = st.secrets.get("GMAIL_CLIENT_SECRET", "")
    with st.spinner("Conectando Gmail..."):
        try:
            tokens = _exchange_gmail_code(code, client_id, client_secret, _redirect_uri())
            _store_gmail_token(user_id, tokens)
            st.query_params.clear()
            st.success("✅ Gmail conectado. Tus transacciones se importarán automáticamente.")
            st.rerun()
        except Exception as exc:
            st.query_params.clear()
            st.error(f"Error al conectar Gmail: {exc}")


def main():
    # ── Handle OAuth callbacks ── #
    qp    = st.query_params
    state = qp.get("state", "")
    if "code" in qp:
        if state.startswith("gmail:"):
            _handle_gmail_callback(qp.get("code", ""), state.split(":", 1)[1])
        else:
            _handle_login_callback(qp.get("code", ""))
        return

    # ── Restore session from cookies if session_state was cleared ── #
    if not st.session_state.get("access_token"):
        _restore_session_from_cookies()

    # ── Route ── #
    if not st.session_state.get("access_token"):
        show_login()
    else:
        uid = st.session_state["user_id"]
        if not _check_gmail_connected(uid):
            show_gmail_connect(uid)
        else:
            show_dashboard(uid)

# ── Runtime detection ───────────────────────────────────────────────────── #
# Call main() when we are genuinely inside a Streamlit execution context:
#   • locally via our subprocess launcher  (_SF_LAUNCHED=1)
#   • on Streamlit Community Cloud         (ScriptRunContext is active)
# Do NOT call it when the file is invoked directly by the editor to launch
# the dev server — that path is handled by the __main__ block below.
import os as _os

def _in_streamlit_runtime() -> bool:
    if _os.environ.get("_SF_LAUNCHED") == "1":
        return True                          # our local launcher
    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx
        return get_script_run_ctx() is not None   # Streamlit Cloud / any runner
    except Exception:
        return False

if _in_streamlit_runtime():
    main()

# ══════════════════════════  DIRECT RUN  ════════════════════════════════════
# Pressing ▶ in VS Code launches the app and opens the browser automatically.
#
# HOW THE LOOP IS PREVENTED:
#   Streamlit re-executes app.py on every rerun, and in some versions
#   __name__ is still "__main__". We use a sentinel env-var _SF_LAUNCHED=1
#   so only the FIRST invocation (from the editor) triggers the launcher.
#   All subsequent Streamlit-internal re-executions see the flag and skip.
#
# HOW STALE SERVERS ARE KILLED:
#   Before starting, any streamlit process already running on PORT is killed,
#   so pressing ▶ always gives you a fresh server with the latest code.

if __name__ == "__main__" and __import__("os").environ.get("_SF_LAUNCHED") != "1" and not _in_streamlit_runtime():
    import os
    import subprocess
    import threading
    import webbrowser
    import time as _time

    PORT = 8501

    # ── 1. Kill any existing Streamlit on this port ── #
    subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         f"Get-NetTCPConnection -LocalPort {PORT} -ErrorAction SilentlyContinue"
         f" | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
        capture_output=True,
    )
    _time.sleep(1)   # brief pause so the port is released

    # ── 2. Open browser after server is ready ── #
    def _open_browser():
        _time.sleep(3)
        webbrowser.open(f"http://localhost:{PORT}")

    threading.Thread(target=_open_browser, daemon=True).start()

    # ── 3. Launch Streamlit — pass sentinel so re-executions skip this block ── #
    env = {
        **os.environ,
        "_SF_LAUNCHED": "1",                                       # sentinel
        "PYTHONPATH": str(Path(__file__).resolve().parent.parent), # backend on path
    }
    subprocess.run([
        sys.executable, "-m", "streamlit", "run", __file__,
        f"--server.port={PORT}",
        "--server.headless=true",          # we open the browser ourselves (1 tab only)
        "--browser.gatherUsageStats=false",
    ], env=env)
