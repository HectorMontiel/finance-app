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
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import numpy as np
import pandas as pd
import streamlit as st
from dateutil.relativedelta import relativedelta
from streamlit_echarts import st_echarts
from supabase import create_client

st.set_page_config(page_title="Mis Finanzas", page_icon="💳",
                   layout="wide", initial_sidebar_state="collapsed")

# ══════════════════════════  CONSTANTS  ══════════════════════════════════════
INCOME_BIWEEKLY = 13_000
INCOME_MONTHLY  = INCOME_BIWEEKLY * 2          # 26 000 MXN
SAVINGS_TARGET  = 0.20

CARD_MAP = {
    "8518": "Like U 💜", "0528": "Gold 🟡",
    "9567": "Gold Digital 🔵", "4521": "Débito 🟢",
}
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

# ══════════════════════════  AUTH  ═══════════════════════════════════════════
_anon = create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_ANON_KEY"])

def show_login():
    _, col, _ = st.columns([1, 1.2, 1])
    with col:
        st.markdown("""
        <div style="margin-top:60px;background:#0d1933;
             border:1px solid rgba(255,255,255,.08);border-radius:10px;
             padding:36px 32px 28px;">
          <div style="font-size:1.7rem;font-weight:800;color:#F8FAFC;margin-bottom:4px;">
              💳 Mis Finanzas</div>
          <div style="color:rgba(255,255,255,.38);font-size:.82rem;margin-bottom:24px;">
              Inteligencia financiera personal</div>
        </div>""", unsafe_allow_html=True)
        email = st.text_input("Email", placeholder="correo@gmail.com")
        pw    = st.text_input("Contraseña", type="password", placeholder="••••••••")
        if st.button("Iniciar sesión", type="primary", use_container_width=True):
            try:
                s = _anon.auth.sign_in_with_password({"email": email, "password": pw})
                st.session_state.update(access_token=s.session.access_token,
                                        user_id=s.user.id)
                st.rerun()
            except Exception:
                st.error("Credenciales incorrectas.")

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

def build_df(rows):
    df = pd.DataFrame(rows)
    df["fecha"]     = pd.to_datetime(df["fecha"], format="ISO8601", utc=True)
    df["monto"]     = df["monto"].astype(float)
    df["mes"]       = df["fecha"].dt.to_period("M").dt.to_timestamp()
    df["cat"]       = df["categoria"].map(lambda c: CAT_LABELS.get(c, c.title()))
    df["tarjeta"]   = df["concepto"].str.extract(r"\*{4}(\d{4})")
    # MP transactions carry no card ending → label them distinctly
    df["card_name"] = df.apply(
        lambda r: "Mercado Pago 💜"
        if r.get("fuente") == "mercado_pago"
        else (CARD_MAP.get(r["tarjeta"], f"****{r['tarjeta']}")
              if pd.notna(r["tarjeta"]) else "Sin tarjeta"),
        axis=1,
    )
    df["comercio"]  = df["concepto"].str.replace(r"\s*\*{4}\d{4}$", "", regex=True)
    return df

# ══════════════════════════  ECHARTS HELPERS  ════════════════════════════════
_EC = dict(backgroundColor="transparent", animation=True,
           animationDuration=600, animationEasing="cubicOut",
           textStyle=dict(fontFamily="Inter"))
_TIP = dict(
    backgroundColor="rgba(2,6,23,.97)",
    borderColor="rgba(255,255,255,.10)", borderWidth=1,
    textStyle=dict(color="#F8FAFC", fontSize=12),
    extraCssText="backdrop-filter:blur(12px);border-radius:10px;padding:8px 12px;",
)
_AX = dict(
    axisLine=dict(show=False), axisTick=dict(show=False),
    axisLabel=dict(color="rgba(255,255,255,.35)", fontSize=10),
    splitLine=dict(lineStyle=dict(color="rgba(255,255,255,.05)", type="dashed")),
)


def ec_monthly(df: pd.DataFrame, highlight_cat: str | None = None, ver: int = 0):
    months = sorted(df["mes"].unique())
    m_lbl  = [pd.Timestamp(m).strftime("%b '%y") for m in months]
    cats   = [c for c in CAT_CLR if c in df["cat"].unique()]
    mc     = df.groupby(["mes","cat"])["monto"].sum().unstack(fill_value=0)
    totals = [float(mc.loc[m].sum()) if m in mc.index else 0 for m in months]

    series = []
    for i, cat in enumerate(cats):
        vals    = [float(mc.loc[m, cat]) if (m in mc.index and cat in mc.columns) else 0
                   for m in months]
        is_top  = (i == len(cats) - 1)
        opacity = 1.0 if (highlight_cat is None or highlight_cat == cat) else 0.18
        series.append(dict(
            name=cat, type="bar", stack="total", data=vals,
            itemStyle=dict(color=CAT_CLR[cat], opacity=opacity,
                           borderRadius=[6,6,0,0] if is_top else [0]*4),
            emphasis=dict(focus="series"), barMaxWidth=52,
            label=dict(show=False),
        ))
    # Total line — NO symbols/bubbles
    total_data = [
        dict(value=v, label=dict(show=True, position="top",
                                  formatter=fmt(v), color="rgba(255,255,255,.7)",
                                  fontSize=9, fontWeight="bold"))
        for v in totals
    ]
    series.append(dict(
        name="Total", type="line", data=total_data,
        symbol="none", symbolSize=0,
        lineStyle=dict(color="rgba(255,255,255,.45)", width=2, type="dashed"),
        z=10,
    ))
    opts = {**_EC,
        "tooltip": dict(trigger="axis", **_TIP,
                        axisPointer=dict(type="shadow",
                            shadowStyle=dict(color="rgba(255,255,255,.02)"))),
        "legend": dict(data=cats+["Total"], bottom=0, left="center",
                       textStyle=dict(color="rgba(255,255,255,.4)", fontSize=9),
                       itemWidth=8, itemHeight=8, itemGap=10),
        "grid": dict(left="1%", right="2%", top="6%", bottom="22%", containLabel=True),
        "xAxis": dict(type="category", data=m_lbl,
                      axisLine=dict(show=False), axisTick=dict(show=False),
                      axisLabel=dict(color="rgba(255,255,255,.35)", fontSize=9.5),
                      splitLine=dict(show=False)),
        "yAxis": dict(type="value", axisLabel=dict(show=False),
                      splitLine=dict(lineStyle=dict(color="rgba(255,255,255,.04)", type="dashed")),
                      axisLine=dict(show=False), axisTick=dict(show=False)),
        "series": series,
    }
    ev = st_echarts(opts, height="260px", key=f"monthly_v{ver}",
                    events={"click": "function(p){return p.seriesName}"})
    return ev


def ec_donut(df: pd.DataFrame, highlight_cat: str | None = None, ver: int = 0):
    by_cat = df.groupby("cat")["monto"].sum().sort_values(ascending=False)
    total  = by_cat.sum()
    data   = [dict(
        name=cat, value=round(float(v), 2),
        itemStyle=dict(
            color=CAT_CLR.get(cat, "#64748B"),
            opacity=1.0 if (highlight_cat is None or highlight_cat == cat) else 0.2,
        ))
        for cat, v in by_cat.items()
    ]
    opts = {**_EC,
        "tooltip": dict(trigger="item", **_TIP,
                        formatter="{b}<br/><b>{d}%</b>  ·  ${c}"),
        "legend": dict(orient="vertical", right="1%", top="middle",
                       textStyle=dict(color="rgba(255,255,255,.45)", fontSize=9.5),
                       itemWidth=8, itemHeight=8, itemGap=7),
        "graphic": [
            dict(type="text", left="29%", top="42%",
                 style=dict(text=fmt(total), textAlign="center",
                            fill="#F8FAFC", fontSize=18, fontWeight="800", fontFamily="Inter")),
            dict(type="text", left="29%", top="57%",
                 style=dict(text="total", textAlign="center",
                            fill="rgba(255,255,255,.3)", fontSize=10, fontFamily="Inter")),
        ],
        "series": [dict(
            type="pie", radius=["50%","74%"], center=["31%","50%"], data=data,
            label=dict(show=False), labelLine=dict(show=False),
            itemStyle=dict(borderRadius=5, borderColor="rgba(2,6,23,.5)", borderWidth=2),
            emphasis=dict(scale=True, scaleSize=4,
                          itemStyle=dict(shadowBlur=14, shadowColor="rgba(0,0,0,.5)")),
        )],
    }
    ev = st_echarts(opts, height="240px", key=f"donut_v{ver}",
                    events={"click": "function(p){return p.name}"})
    return ev


def ec_trend(df: pd.DataFrame):
    monthly = df.groupby("mes")["monto"].sum().sort_index()
    labels  = [pd.Timestamp(m).strftime("%b '%y") for m in monthly.index]
    vals    = [round(float(v), 2) for v in monthly.values]
    avg     = float(np.mean(vals)) if vals else 0

    avg_pts = [dict(value=avg, label=dict(show=False)) for _ in labels]
    if avg_pts:
        avg_pts[-1]["label"] = dict(show=True, position="insideEndTop",
                                     formatter=f"prom {fmt(avg)}",
                                     color="rgba(255,255,255,.3)", fontSize=9)
    opts = {**_EC,
        "tooltip": dict(trigger="axis", **_TIP),
        "grid": dict(left="1%", right="6%", top="10%", bottom="14%", containLabel=True),
        "xAxis": dict(
            type="category", data=labels, boundaryGap=False,
            axisLine=dict(show=False), axisTick=dict(show=False),
            axisLabel=dict(color="rgba(255,255,255,.35)", fontSize=10),
            splitLine=dict(show=False),
        ),
        "yAxis": dict(
            type="value",
            axisLine=dict(show=False), axisTick=dict(show=False),
            axisLabel=dict(show=False),
            splitLine=dict(lineStyle=dict(color="rgba(255,255,255,.04)", type="dashed")),
        ),
        "series": [
            dict(name="Gasto", type="line", data=vals,
                 smooth=True, symbol="none",                   # NO bubbles
                 lineStyle=dict(color="#818CF8", width=3),
                 itemStyle=dict(color="#818CF8"),
                 areaStyle=dict(color=dict(type="linear", x=0, y=0, x2=0, y2=1,
                     colorStops=[dict(offset=0, color="rgba(129,140,248,.28)"),
                                  dict(offset=1, color="rgba(129,140,248,.01)")]))),
            dict(name="Promedio", type="line", data=avg_pts,
                 smooth=False, symbol="none",
                 lineStyle=dict(color="rgba(255,255,255,.18)", width=1.5, type="dashed"),
                 tooltip=dict(show=False)),
        ],
    }
    st_echarts(opts, height="155px", key="trend")


def ec_top_merchants(df: pd.DataFrame, highlight_cat: str | None = None, n: int = 8):
    src = df if highlight_cat is None else df[df["cat"] == highlight_cat]
    top = src.groupby("comercio")["monto"].sum().sort_values(ascending=True).tail(n)
    if top.empty:
        st.caption("Sin datos")
        return
    mx = float(top.max())
    bars = [dict(
        value=round(float(v), 2),
        itemStyle=dict(
            color=dict(type="linear", x=0, y=0, x2=1, y2=0,
                colorStops=[
                    dict(offset=0, color=f"rgba(99,102,241,{.3+.7*i/max(len(top)-1,1):.2f})"),
                    dict(offset=1, color=f"rgba(139,92,246,{.3+.7*i/max(len(top)-1,1):.2f})")]),
            borderRadius=[0,6,6,0]),
        label=dict(show=True, position="right", formatter=fmt(float(v)),
                   color="rgba(255,255,255,.5)", fontSize=10),
    ) for i, (_, v) in enumerate(top.items())]

    opts = {**_EC,
        "tooltip": dict(trigger="axis", **_TIP, axisPointer=dict(type="none")),
        "grid": dict(left="2%", right="22%", top="3%", bottom="3%", containLabel=True),
        "xAxis": dict(type="value", show=False, max=mx*1.32),
        "yAxis": dict(type="category", data=list(top.index), inverse=False,
                      axisLine=dict(show=False), axisTick=dict(show=False),
                      axisLabel=dict(color="rgba(255,255,255,.55)", fontSize=10)),
        "series": [dict(type="bar", data=bars, barMaxWidth=16)],
    }
    st_echarts(opts, height=f"{max(180, n*28)}px", key="merchants")


def ec_card_split(df: pd.DataFrame):
    by_card = df.groupby("card_name")["monto"].sum().sort_values(ascending=False)
    total   = by_card.sum()
    GRADS   = [("#6366f1","#818CF8"),("#059669","#34D399"),
               ("#9333ea","#C084FC"),("#b45309","#FCD34D")]
    bars = [dict(
        value=round(float(v), 2),
        itemStyle=dict(
            color=dict(type="linear", x=0, y=0, x2=0, y2=1,
                       colorStops=[dict(offset=0, color=GRADS[i%4][0]),
                                   dict(offset=1, color=GRADS[i%4][1])]),
            borderRadius=[8,8,0,0]),
        label=dict(show=True, position="top",
                   formatter=f"{fmt(float(v))}\n{float(v)/total*100:.0f}%",
                   color="rgba(255,255,255,.55)", fontSize=9, lineHeight=14),
    ) for i, (_, v) in enumerate(by_card.items())]

    opts = {**_EC,
        "tooltip": dict(trigger="axis", **_TIP),
        "grid": dict(left="4%", right="4%", top="20%", bottom="10%", containLabel=True),
        "xAxis": dict(type="category", data=list(by_card.index),
                      axisLine=dict(show=False), axisTick=dict(show=False),
                      axisLabel=dict(color="rgba(255,255,255,.45)", fontSize=9, interval=0)),
        "yAxis": dict(type="value", show=False),
        "series": [dict(type="bar", data=bars, barMaxWidth=48,
                        emphasis=dict(itemStyle=dict(opacity=.8)))],
    }
    st_echarts(opts, height="185px", key="cards")


def ec_budget_gauge(pct: float):
    color = "#22C55E" if pct < 65 else ("#FBBF24" if pct < 85 else "#F87171")
    opts = {**_EC,
        "series": [dict(
            type="gauge",
            startAngle=210, endAngle=-30,
            min=0, max=100,
            radius="90%",
            progress=dict(show=True, width=10,
                          itemStyle=dict(color=color)),
            axisLine=dict(lineStyle=dict(width=10,
                color=[[1, "rgba(255,255,255,.07)"]])),
            axisTick=dict(show=False),
            splitLine=dict(show=False),
            axisLabel=dict(show=False),
            pointer=dict(show=False),
            anchor=dict(show=False),
            detail=dict(
                valueAnimation=True,
                formatter=f"{pct:.0f}%",
                color=color, fontSize=20, fontWeight="800",
                fontFamily="Inter", offsetCenter=["0%","5%"],
            ),
            title=dict(offsetCenter=["0%","28%"],
                       color="rgba(255,255,255,.32)", fontSize=9.5),
            data=[dict(value=min(pct, 100), name="del ingreso")],
        )],
    }
    st_echarts(opts, height="155px", key="gauge")


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
        tip     = (f"Con {fmt(avg_m)}/mes de gasto vs {fmt(INCOME_MONTHLY)} de ingreso "
                   f"solo ahorras {fmt(max(savings_m,0))}. <strong>{top_cat}</strong> es tu mayor rubro.")

    return f"{scope}: {verdict} {tip}"


def compute_insights(df, df_prev, income_m=INCOME_MONTHLY):
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

    with st.spinner(""):
        rows = load_all(user_id)
    if not rows:
        st.warning("Sin transacciones. Corre el pipeline de ingesta.")
        if st.button("Salir"): st.session_state.clear(); st.rerun()
        return

    df_all = build_df(rows)

    # ── Header ── #
    ha, hb = st.columns([8, 1])
    with ha:
        st.markdown(
            "<p style='font-size:1.2rem;font-weight:900;margin:0 0 1px;color:#F8FAFC;'>"
            "💳 Mis Finanzas</p>"
            f"<p style='color:rgba(255,255,255,.22);font-size:.64rem;margin:0 0 4px;'>"
            f"Inteligencia financiera · {datetime.now().strftime('%d %b %Y')}</p>",
            unsafe_allow_html=True)
    with hb:
        if st.button("Salir", type="secondary", use_container_width=True):
            st.session_state.clear(); st.rerun()

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
            f"{CARD_MAP.get(c,c)} (****{c})" for c in cards_avail]
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
    budget_pct   = avg_m / INCOME_MONTHLY * 100
    savings_m    = INCOME_MONTHLY - avg_m
    savings_rate = max(0, savings_m / INCOME_MONTHLY * 100)
    bar_color    = "#22C55E" if budget_pct < 65 else ("#FBBF24" if budget_pct < 85 else "#F87171")
    sav_color    = "#22C55E" if savings_rate >= SAVINGS_TARGET * 100 else "#FBBF24"
    pay_date, pay_days = next_payday()
    cat_totals   = df.groupby("cat")["monto"].sum()
    top_cat      = cat_totals.idxmax() if len(cat_totals) else "—"
    top_cat_pct  = f"{cat_totals.max()/total*100:.0f}%" if len(cat_totals) and total else "—"

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
         f"jue {pay_date} · {fmt(INCOME_BIWEEKLY)}", "nt", "#67E8F9"),
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
        f'text-transform:uppercase;letter-spacing:.1em;">💵 Presupuesto mensual · Ingreso {fmt(INCOME_MONTHLY)}</span>'
        f'<span style="color:{bar_color};font-size:.68rem;font-weight:700;">'
        f'{fmt(avg_m)} gastado ({budget_pct:.0f}%)'
        f'<span style="color:rgba(255,255,255,.28);font-weight:400;"> · Restante: {fmt(max(INCOME_MONTHLY-avg_m,0))}'
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
            ev_monthly = ec_monthly(df, highlight_cat=hcat, ver=ver)
        if ev_monthly and ev_monthly not in ("Total", None):
            new = None if ev_monthly == st.session_state["chart_cat"] else ev_monthly
            st.session_state["chart_cat"] = new
            st.session_state["click_ver"] += 1
            st.rerun()
    with r1b:
        with st.container(border=True):
            st.markdown('<span class="sl">🍩 Distribución por categoría</span>',
                        unsafe_allow_html=True)
            ev_donut = ec_donut(df, highlight_cat=hcat, ver=ver)
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
            ec_trend(df)
    with r2b:
        with st.container(border=True):
            st.markdown('<span class="sl">💳 Gasto por tarjeta</span>',
                        unsafe_allow_html=True)
            ec_card_split(df)

    st.markdown("<div style='height:8px'/>", unsafe_allow_html=True)

    # ──────────────────────────────────────────────────────────────────────── #
    # ROW 3 · Story banner + Insights (compact horizontal, BELOW charts)       #
    # ──────────────────────────────────────────────────────────────────────── #
    story = story_banner(df, total, avg_m, n_months, budget_pct, savings_m)
    st.markdown(f'<div class="story-banner">{story}</div>', unsafe_allow_html=True)

    insights = compute_insights(df, df_prev)
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
            ec_top_merchants(df, highlight_cat=hcat, n=8)
    with r3b:
        with st.container(border=True):
            st.markdown(f'<span class="sl">📄 Transacciones ({len(df)})</span>',
                        unsafe_allow_html=True)
            disp = df[["fecha","comercio","monto","cat","card_name"]].copy()
            disp["fecha"] = disp["fecha"].dt.strftime("%d/%m/%Y")
            disp["monto"] = disp["monto"].apply(lambda x: f"${x:,.2f}")
            disp.columns  = ["Fecha","Comercio","Monto","Categoría","Tarjeta"]
            st.dataframe(disp, use_container_width=True, hide_index=True,
                         height=min(400, 35*min(len(disp),13)+38))


# ══════════════════════════  MAIN  ═══════════════════════════════════════════
def main():
    if not st.session_state.get("access_token"):
        show_login()
    else:
        show_dashboard(st.session_state["user_id"])

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

if __name__ == "__main__" and __import__("os").environ.get("_SF_LAUNCHED") != "1":
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
