/* Mis Finanzas — app personal. Sin servidor: los datos llegan cifrados
   (docs/datos/finanzas.enc, AES-256-GCM) y se abren aquí con tu código. */
'use strict';

const VERSION = '3.0';

/* ── Categorías ─────────────────────────────────────────────────────────── */
const CATS = {
  super:           { n: 'Súper',            c: '#1baf7a' },
  comida:          { n: 'Comida fuera',     c: '#eb6834' },
  transporte:      { n: 'Transporte',       c: '#2a78d6' },
  suscripciones:   { n: 'Suscripciones',    c: '#6250d6' },
  entretenimiento: { n: 'Diversión',        c: '#e0679a' },
  apuestas:        { n: 'Apuestas',         c: '#e34948' },
  salud:           { n: 'Salud',            c: '#0f8a3c' },
  servicios:       { n: 'Servicios',        c: '#d99400' },
  compras:         { n: 'Compras',          c: '#a0662b' },
  viajes:          { n: 'Viajes',           c: '#0e9bb5' },
  transferencias:  { n: 'Transferencias',   c: '#64748b' },
  efectivo:        { n: 'Efectivo',         c: '#6b8e23' },
  otros:           { n: 'Sin clasificar',   c: '#94a3b8' },
  ingreso:         { n: 'Ingreso',          c: '#15803d' },
  propias:         { n: 'Entre mis cuentas', c: '#8b8a85' },
};
const CATS_GASTO = ['super', 'comida', 'transporte', 'suscripciones', 'entretenimiento', 'apuestas', 'salud',
  'servicios', 'compras', 'viajes', 'transferencias', 'efectivo', 'otros', 'propias'];
const CATS_INGRESO = ['ingreso', 'propias'];

/* ── Utilidades ─────────────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (id, extra = '') => `<svg ${extra}><use href="#${id}"/></svg>`;
const fmtMX = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fmtMX2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmt = (v) => fmtMX.format(Math.round(v || 0)).replace('MX$', '$');
const fmt2 = (v) => fmtMX2.format(v || 0).replace('MX$', '$');
const fmtK = (v) => (Math.abs(v) >= 10000 ? '$' + Math.round(v / 1000) + 'k' : Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(1).replace('.0', '') + 'k' : '$' + Math.round(v));
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fecha = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const sumaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const difDias = (a, b) => Math.round((fecha(iso(b)) - fecha(iso(a))) / 864e5);
const hoy = () => fecha(iso(new Date()));
const fDia = (s) => { const d = fecha(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const fDiaLargo = (s) => { const d = fecha(s); const a = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''; return `${DIAS_L[d.getDay()]} ${d.getDate()} de ${MESES_L[d.getMonth()]}${a}`; };
const fMes = (k) => { const [y, m] = k.split('-').map(Number); return `${MESES_L[m - 1]} ${y}`; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const mesDe = (s) => s.slice(0, 7);
const mesMas = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const suma = (arr) => arr.reduce((a, m) => a + m.m, 0);
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const esApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const haceCuanto = (isoTxt) => {
  const min = Math.round((Date.now() - new Date(isoTxt)) / 60000);
  if (min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

function bonito(s) {
  s = String(s || '').replace(/\s+(S\.?A\.?|SA)( DE)?( C\.?V\.?| CV)?$/i, '').replace(/\s+S DE RL.*$/i, '');
  return s.toLowerCase().replace(/(^|[\s/.\-·(])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Dq|Kfc|Cfe|Bbva|Spei|Atm|Hsbc|Oxxo|Qro|Gdl|Cdmx|Mx|Tv|Bp|Heb|Ado|Etn)\b/g, (m) => m.toUpperCase());
}

function normComercio(c) {
  let s = String(c || '').toUpperCase().replace(/\s*\*{2,}\d+$/, '');
  s = s.replace(/^(MERCADO ?PAGO|MERPAGO|MP|CLIP ?MX|BPK|CONEKTA|NMX|SQ|STR|LKL|SYSPAGO|PAYPAL|DLO|DL|OPLINEA|ABTS|ZETTLE|SP|IZ|EB|SR|PAYU|OPENPAY|GOFNDME|SIPAY|RESTS?)\s*\*\s*/, '');
  s = s.replace(/[#*]/g, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  return s || String(c || '').toUpperCase();
}

/* ── Conexión (Supabase + Google) ───────────────────────────────────────── */
const SUPA_URL = 'https://otxgrrczeznexxobamtv.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90eGdycmN6ZXpuZXh4b2JhbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MTk4NTIsImV4cCI6MjExMDE5NTg1Mn0.eVS16h-Wc4TwSTWzw3CiWxmMFC0l9jJc2hz1gwC3YEw'; // llave pública: sólo deja ver lo propio de cada quien (RLS)
const GOOGLE_ID = '108907084207-t72q2gh330g4pajgad82ulflmonqpd6r.apps.googleusercontent.com';
const ALCANCES = 'openid email profile https://www.googleapis.com/auth/gmail.readonly';
const URL_APP = location.origin + location.pathname;
const sb = window.supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mf_sesion' },
});

async function llamar(fn, body = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPA_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPA_ANON, Authorization: `Bearer ${session ? session.access_token : SUPA_ANON}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

async function todas(tabla, columnas) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from(tabla).select(columnas).range(desde, desde + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/* ── Estado ─────────────────────────────────────────────────────────────── */
const E = {
  usuario: null, perfil: null, dicc: {}, datos: null, aj: null, movs: [],
  vista: 'inicio', periodoInicio: 'pago',
  f: { q: '', cat: null, tj: null, k: null, tipo: 'gastos', mes: null, todo: false, limite: 120 },
  an: { rango: '6m', mes: null },
  subiendo: null, sincronizando: false, progreso: null,
};

function ajustesBase() {
  return {
    v: 1, actualizado: 0, pago_monto: 0, frecuencia: 'quincenal', pago_ref: iso(hoy()), pago_dia: 1,
    meta_ahorro: 10, tarjetas: {}, nombres: {}, reglas: {}, cambios: {}, revisados: {}, manuales: [],
    presupuestos: {}, tema: 'auto',
  };
}

/* ── Arranque ───────────────────────────────────────────────────────────── */
async function iniciar() {
  aplicarTema(leer('mf_tema') || 'auto');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  guardar('mf_clave', null); // la versión con código ya no se usa
  if (location.hash.includes('k=')) history.replaceState(null, '', location.pathname);

  const q = new URLSearchParams(location.search);
  if (q.get('code') || q.get('error')) {
    const estado = q.get('state') || '';
    history.replaceState(null, '', location.pathname);
    if (q.get('error')) { guardar('mf_pareo', null); return pantallaBloqueo('No se dio el permiso en Google. Puedes intentarlo otra vez.'); }
    // ¿Regresó a la misma ventana que pidió entrar? (computadora, Android, Safari normal)
    const mio = estado && (estado === sessionStorage.getItem('mf_estado') || estado === leer('mf_pareo'));
    pintarCargando('Entrando…');
    try {
      if (mio) {
        const r = await llamar('entrar', { code: q.get('code'), redirect_uri: URL_APP });
        const { error } = await sb.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
        if (error) throw error;
        guardar('mf_pareo', null);
      } else if (/^[a-f0-9]{32}$/.test(estado)) {
        // iPhone con la app instalada: Google se abrió en otra ventana. Se deja el pase para la app.
        await llamar('entrar', { code: q.get('code'), redirect_uri: URL_APP, pareo: estado });
        return pantallaVuelveALaApp();
      } else {
        return pantallaBloqueo('El inicio de sesión tardó demasiado. Intenta otra vez.');
      }
    } catch (e) { return pantallaBloqueo(e.message || 'No se pudo entrar.'); }
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const pase = leer('mf_pareo');
    if (pase && Date.now() - (+leer('mf_pareo_t') || 0) < 10 * 60_000) return esperarPase(pase);
    return pantallaBloqueo();
  }
  E.usuario = session.user;
  pintarEsqueleto();
  try { await cargarTodo(); } catch (e) { return pantallaError(e); }
  $('#barra').hidden = false;
  ir(sessionStorage.getItem('mf_vista') || 'inicio');
  // Primera vez (o historial a medias): leer los correos ya, con barra de progreso.
  if (E.perfil.gmail_conectado && (!E.perfil.historial_completo || E.perfil.sync_pendientes > 0)) sincronizarAhora(true);
}

function entrarConGoogle() {
  const estado = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem('mf_estado', estado);
  guardar('mf_pareo', estado);
  guardar('mf_pareo_t', String(Date.now()));
  const p = new URLSearchParams({
    client_id: GOOGLE_ID, redirect_uri: URL_APP, response_type: 'code', scope: ALCANCES,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: estado,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  // En la app instalada, Google se abre aparte y la app espera aquí su pase.
  if (esApp()) {
    const w = window.open(url, '_blank');
    if (w) return esperarPase(estado);
  }
  location.href = url;
}

/* La app instalada espera a que la ventana de Google deje el pase. */
let esperaT = null;
function esperarPase(estado) {
  $('#barra').hidden = true; $('#fab').hidden = true;
  $('#app').classList.add('sin-barra');
  $('#app').innerHTML = `<div class="bloqueo">
    <img class="logo" src="icono.svg" alt="">
    <h1>Termina en Google</h1>
    <ol class="pasos">
      <li><span>Elige tu cuenta y da el permiso de Gmail en la ventana que se abrió.</span></li>
      <li><span>Cuando veas <b>«Listo, ya puedes volver»</b>, cierra esa ventana con la <b>X</b> de arriba.</span></li>
      <li><span>Esta pantalla entra sola en cuanto regreses.</span></li>
    </ol>
    <div class="pildora" style="align-self:flex-start;margin-bottom:18px">${ic('i-actualizar', 'class="gira"')}Esperando a Google…</div>
    <button class="btn primario ancho" data-acc="revisarPase">Ya terminé</button>
    <button class="btn ancho" style="margin-top:10px" data-acc="cancelarPase">Cancelar</button>
  </div>`;
  clearInterval(esperaT);
  const inicio = Date.now();
  esperaT = setInterval(() => {
    if (Date.now() - inicio > 10 * 60_000) { clearInterval(esperaT); guardar('mf_pareo', null); pantallaBloqueo('Se acabó el tiempo. Intenta otra vez.'); return; }
    revisarPase(estado);
  }, 2500);
}
let revisandoPase = false;
async function revisarPase(estado = leer('mf_pareo')) {
  if (!estado || revisandoPase) return;
  revisandoPase = true;
  try {
    const r = await llamar('entrar', { accion: 'recoger', pareo: estado });
    if (r.token_hash) {
      clearInterval(esperaT);
      guardar('mf_pareo', null);
      pintarCargando('Entrando…');
      const { error } = await sb.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
      if (error) throw error;
      location.replace(location.pathname);
    }
  } catch (e) {
    clearInterval(esperaT); guardar('mf_pareo', null);
    pantallaBloqueo(e.message || 'No se pudo entrar.');
  } finally { revisandoPase = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && leer('mf_pareo') && !E.usuario) revisarPase(); });

/* Ventana de Google (otra que la app): ya se dejó el pase. */
function pantallaVuelveALaApp() {
  $('#barra').hidden = true; $('#fab').hidden = true;
  $('#app').classList.add('sin-barra');
  $('#app').innerHTML = `<div class="bloqueo centro">
    <img class="logo" src="icono.svg" alt="" style="margin:0 auto 18px">
    <h1>Listo, ya puedes volver</h1>
    <p>Cierra esta ventana con la <b>X</b> de arriba y regresa a <b>Mis Finanzas</b>: entrará sola.</p>
    <button class="btn primario ancho" data-acc="cerrarVentana">Cerrar esta ventana</button>
  </div>`;
  setTimeout(() => { try { window.close(); } catch { /* iOS no siempre deja */ } }, 1500);
}

async function cargarTodo() {
  const [perf, movs, dicc] = await Promise.all([
    sb.from('perfiles').select('*').eq('user_id', E.usuario.id).maybeSingle(),
    todas('movimientos', 'id,f,h,m,tipo,c,tj,clave,cat_auto,extra'),
    todas('diccionario', 'clave,cat,sub,esencial,nombre,confianza,ia,creado'),
  ]);
  if (perf.error) throw new Error(perf.error.message);
  E.perfil = perf.data || { gmail_conectado: false, ajustes: {} };
  E.dicc = Object.fromEntries(dicc.map((d) => [d.clave, d]));
  E.datos = { movs: movs.map((r) => ({ ...r, m: Number(r.m) })), generado: E.perfil.ultima_sync };
  cargarAjustes(E.perfil.ajustes || {});
  if (!E.aj.revisado_en && E.datos.movs.length) { E.aj.revisado_en = Date.now(); guardarAjustes(); }
  preparar();
  E.ultimaCarga = Date.now();
}

function cargarAjustes(remoto) {
  let local = null;
  try { local = JSON.parse(leer('mf_aj') || 'null'); } catch { local = null; }
  if (local && local.uid !== E.usuario.id) local = null; // otra cuenta en este dispositivo
  const elegido = !local ? remoto : ((local.actualizado || 0) > (remoto.actualizado || 0) ? local : remoto);
  E.aj = Object.assign(ajustesBase(), elegido || {}, { uid: E.usuario.id });
  delete E.aj.gh_token;
  guardar('mf_aj', JSON.stringify(E.aj));
  guardar('mf_tema', E.aj.tema);
  aplicarTema(E.aj.tema);
  if (local && elegido === local) programarSubida();
}

/* ── Movimientos con las correcciones del usuario ───────────────────────── */
function claveDe(m) {
  if (m.clave) return m.clave;
  if (m.tipo === 'transferencia') return 'T:' + m.c;
  if (m.tipo === 'deposito') return 'E:' + m.c;
  if (m.tipo === 'retiro') return 'R:';
  return 'C:' + normComercio(m.c);
}
function nombreDe(m, k) {
  if (E.aj.nombres[k]) return E.aj.nombres[k];
  if (m.tipo === 'retiro') return 'Retiro de efectivo';
  if (m.tipo === 'transferencia') return bonito(m.c.replace(/^CUENTA ·/, 'Cuenta ·'));
  if (m.tipo === 'deposito') return bonito(m.c);
  return bonito(normComercio(m.c));
}
const ESENCIAL = { super: true, transporte: true, salud: true, servicios: true, comida: false, suscripciones: false, entretenimiento: false, apuestas: false, compras: false, viajes: false, otros: null, transferencias: null, efectivo: null };
const terminacion = (c) => (String(c).split('·')[1] || '').trim();
function preparar() {
  const aj = E.aj;
  const base = (E.datos.movs || []).concat((aj.manuales || []).map((m) => ({ ...m, manual: true })));
  // Dinero entre tus cuentas: una cuenta a la que mandas Y de la que recibes es tuya (o se compensa).
  const recibes = new Set(base.filter((m) => m.tipo === 'deposito').map((m) => terminacion(m.c)).filter(Boolean));
  const mandas = new Set(base.filter((m) => m.tipo === 'transferencia').map((m) => terminacion(m.c)).filter(Boolean));
  E.movs = base.map((m) => {
    const k = claveDe(m);
    const cambio = aj.cambios[m.id] || {};
    const t = terminacion(m.c);
    const propia = (m.tipo === 'transferencia' && recibes.has(t)) || (m.tipo === 'deposito' && mandas.has(t)) ? 'propias' : null;
    const d = E.dicc[k];
    let cat = cambio.cat || aj.reglas[k] || propia || (d && d.cat) || m.cat_auto || m.cat || 'otros';
    const origen = cambio.cat || aj.reglas[k] ? 'tu' : propia ? 'auto' : d ? (d.ia ? 'ia' : 'regla') : 'regla';
    if (m.tipo === 'deposito' && !CATS_INGRESO.includes(cat)) cat = 'ingreso';
    if (m.tipo !== 'deposito' && cat === 'ingreso') cat = 'otros';
    const usaDicc = origen === 'ia' || origen === 'regla';
    const sub = usaDicc && d ? d.sub || '' : '';
    const esencial = cat === 'propias' || cat === 'otros' || m.tipo === 'deposito' ? null
      : usaDicc && d && d.esencial != null ? d.esencial : ESENCIAL[cat] ?? null;
    const nombre = aj.nombres[k] || (d && d.nombre) || nombreDe(m, k);
    return { ...m, k, cat, sub, esencial, origen, conf: d ? d.confianza : null, nota: cambio.nota || '', nombre, g: nombre.toLowerCase() };
  }).sort((a, b) => (b.f + (b.h || '')).localeCompare(a.f + (a.h || '')));
  E.tarjetasVistas = [...new Set(E.movs.map((m) => m.tj).filter(Boolean))];
}
const esGasto = (m) => m.tipo !== 'deposito' && m.cat !== 'propias';
const esIngreso = (m) => m.tipo === 'deposito' && m.cat !== 'propias';
const gastos = (desde, hasta) => E.movs.filter((m) => esGasto(m) && (!desde || m.f >= desde) && (!hasta || m.f < hasta));
const nombreTarjeta = (tj) => (tj ? (E.aj.tarjetas[tj] || (tj === 'EFECTIVO' ? 'Efectivo' : `•••• ${tj}`)) : '');

/* ── Periodo de pago ────────────────────────────────────────────────────── */
function periodo() {
  const aj = E.aj; const h = hoy();
  let inicio; let fin;
  if (aj.frecuencia === 'quincenal') {
    const d = h.getDate();
    const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
    if (d >= 15 && d < ultimo) { inicio = new Date(h.getFullYear(), h.getMonth(), 15); fin = new Date(h.getFullYear(), h.getMonth(), ultimo); }
    else if (d === ultimo) { inicio = h; fin = new Date(h.getFullYear(), h.getMonth() + 1, 15); }
    else { inicio = new Date(h.getFullYear(), h.getMonth(), 0); fin = new Date(h.getFullYear(), h.getMonth(), 15); }
  } else if (aj.frecuencia === 'mensual') {
    const dia = Math.min(28, Math.max(1, +aj.pago_dia || 1));
    inicio = new Date(h.getFullYear(), h.getMonth() - (h.getDate() < dia ? 1 : 0), dia);
    fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, dia);
  } else {
    const ref = fecha(aj.pago_ref || iso(h));
    const n = Math.floor(difDias(ref, h) / 14);
    inicio = sumaDias(ref, n * 14); fin = sumaDias(inicio, 14);
  }
  const dias = difDias(inicio, fin);
  return { inicio: iso(inicio), fin: iso(fin), dias, pasados: difDias(inicio, h) + 1, faltan: Math.max(1, difDias(h, fin)) };
}
const presupuestoPeriodo = () => (+E.aj.pago_monto || 0) * (1 - (+E.aj.meta_ahorro || 0) / 100);
const ingresoMensual = () => {
  const p = +E.aj.pago_monto || 0;
  return E.aj.frecuencia === 'mensual' ? p : E.aj.frecuencia === 'quincenal' ? p * 2 : p * 26 / 12;
};

/* ── Navegación ─────────────────────────────────────────────────────────── */
const VISTAS = { inicio: vistaInicio, movimientos: vistaMovimientos, analisis: vistaAnalisis, ajustes: vistaAjustes };
function ir(v, conservarScroll) {
  if (!VISTAS[v]) v = 'inicio';
  E.vista = v;
  sessionStorage.setItem('mf_vista', v);
  document.querySelectorAll('#barra button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === v));
  $('#fab').hidden = !(v === 'inicio' || v === 'movimientos');
  $('#app').classList.remove('sin-barra');
  $('#app').innerHTML = VISTAS[v]();
  ocultarTip();
  if (!conservarScroll) window.scrollTo(0, 0);
}
const repintar = () => ir(E.vista, true);

/* ── Inicio ─────────────────────────────────────────────────────────────── */
function saludo() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function estadoSync() {
  const g = E.datos.generado;
  if (!g) return '';
  const horas = (Date.now() - new Date(g)) / 36e5;
  const cls = horas > 26 ? 'mal' : horas > 8 ? 'aviso' : '';
  return `<span class="pildora ${cls}">${horas > 8 ? ic('i-alerta') : ''}Actualizado ${haceCuanto(g)}</span>`;
}

function vistaInicio() {
  const p = periodo();
  const presu = presupuestoPeriodo();
  const delPeriodo = gastos(p.inicio, p.fin);
  const gastado = suma(delPeriodo);
  const queda = presu - gastado;
  const fracG = presu > 0 ? gastado / presu : 0;
  const fracT = p.pasados / p.dias;
  const nivel = fracG > 1 ? 'mal' : fracG > fracT + 0.08 ? 'aviso' : '';
  const porDia = Math.max(0, queda) / p.faltan;

  const hoyS = iso(hoy());
  const mesK = mesDe(hoyS);
  const gMes = suma(gastos(mesK + '-01', mesMas(mesK, 1) + '-01'));
  // Mismo tramo del mes pasado (del 1 al mismo día)
  const dHoy = hoy().getDate();
  const mesAntK = mesMas(mesK, -1);
  const finAnt = iso(sumaDias(fecha(mesAntK + '-01'), dHoy));
  const gMesAnt = suma(gastos(mesAntK + '-01', finAnt > mesK + '-01' ? mesK + '-01' : finAnt));
  const dif = gMes - gMesAnt;
  const gHoy = gastos(hoyS, iso(sumaDias(hoy(), 1)));
  const ingMes = suma(E.movs.filter((m) => esIngreso(m) && mesDe(m.f) === mesK));
  const meses6 = [1, 2, 3, 4, 5, 6].map((i) => mesMas(mesK, -i));
  const prom6 = meses6.reduce((a, k) => a + suma(gastos(k + '-01', mesMas(k, 1) + '-01')), 0) / 6;

  const usarMes = E.periodoInicio === 'mes';
  const rango = usarMes ? [mesK + '-01', mesMas(mesK, 1) + '-01'] : [p.inicio, p.fin];
  const porCat = agrupar(gastos(...rango), 'cat');
  const ultimos = E.movs.slice(0, 6);
  const porRevisar = gruposPorRevisar();
  const revisarN = porRevisar.length;
  const nuevosN = porRevisar.filter((x) => x.nuevo).length;
  const finTxt = fDia(p.fin);

  const avisoIOS = esIOS() && !esApp() && leer('mf_no_instalar') !== '1'
    ? `<div class="tarjeta" style="margin-bottom:12px;display:flex;gap:12px;align-items:flex-start">
        <div class="cat-ic" style="--c:var(--acento)">${ic('i-descargar')}</div>
        <div style="flex:1"><b>Instálala en tu iPhone</b><div class="texto-2 peq" style="margin-top:3px">Toca <b>Compartir</b> y luego <b>«Agregar a inicio»</b>. Abrirá como app; entra una vez con Google ahí dentro y quedará guardada.</div></div>
        <button class="icono-btn" style="box-shadow:none;width:30px;height:30px" data-acc="noInstalar" aria-label="Cerrar">${ic('i-x')}</button></div>`
    : '';

  return `
  <header class="encabezado">
    <div><h1>${saludo()}</h1><div class="sub">${esc(fDiaLargo(hoyS))}</div></div>
    <button class="icono-btn ${E.sincronizando ? 'girando' : ''}" data-acc="sincronizar" aria-label="Actualizar">${ic('i-actualizar')}</button>
  </header>
  ${avisoIOS}
  ${tarjetaProgreso()}
  ${!E.perfil.gmail_conectado ? `<button class="llamado" data-acc="conectarGmail" style="margin:0 0 12px">
      <span class="ic">${ic('i-candado')}</span>
      <span><b>Conecta tu Gmail</b><span>Para leer los avisos de Santander y llenar todo solo</span></span>${ic('i-der')}</button>` : ''}
  ${!(+E.aj.pago_monto) ? `<button class="llamado" data-acc="editarPago" style="margin:0 0 12px">
      <span class="ic">${ic('i-cartera')}</span>
      <span><b>¿Cuánto te pagan y cada cuándo?</b><span>Con eso te digo cuánto puedes gastar al día</span></span>${ic('i-der')}</button>` : ''}
  ${!E.sincronizando && revisarN ? `<button class="llamado" data-acc="revisar" style="margin:0 0 12px">
      <span class="ic">${ic('i-chispa')}</span>
      <span><b>${nuevosN ? `La IA clasificó ${nuevosN} ${nuevosN === 1 ? 'comercio nuevo' : 'comercios nuevos'}` : `La IA tiene duda en ${revisarN} ${revisarN === 1 ? 'comercio' : 'comercios'}`}</b><span>Ya están en su categoría. Revísalos si quieres (es opcional)</span></span>${ic('i-der')}</button>` : ''}
  <section class="tarjeta heroe" ${!(+E.aj.pago_monto) ? 'hidden' : ''}>
    <div class="etiqueta">${queda >= 0 ? `Disponible hasta tu pago del ${esc(finTxt)}` : 'Te pasaste de tu presupuesto'}</div>
    <div class="cifra num ${queda < 0 ? 'neg' : ''}">${queda < 0 ? '−' : ''}${fmt(Math.abs(queda))}</div>
    <div class="detalle">${queda > 0
      ? `Puedes gastar <b>${fmt(porDia)} al día</b> · ${p.faltan === 1 ? 'mañana cobras' : `faltan ${p.faltan} días`}`
      : `${p.faltan === 1 ? 'Mañana cobras' : `Faltan ${p.faltan} días para tu pago`}`}</div>
    <div class="medidor" role="img" aria-label="Gastado ${Math.round(fracG * 100)} % del presupuesto; van ${Math.round(fracT * 100)} % de los días">
      <i class="${nivel}" style="width:${Math.min(100, fracG * 100).toFixed(1)}%"></i>
      <em style="left:calc(${Math.min(100, fracT * 100).toFixed(1)}% - 1px)" title="Hoy"></em>
    </div>
    <div class="medidor-pie"><span>Gastado <b class="num" style="color:var(--texto)">${fmt(gastado)}</b></span><span>de ${fmt(presu)}${+E.aj.meta_ahorro ? ` · ahorras ${fmt(+E.aj.pago_monto - presu)}` : ''}</span></div>
    ${nivel ? `<div style="margin-top:12px"><span class="pildora ${nivel}">${ic('i-alerta')}${nivel === 'mal' ? 'Ya gastaste más de lo planeado' : 'Vas gastando más rápido que los días'}</span></div>` : ''}
  </section>

  <div class="mosaicos cuatro">
    <div class="mosaico"><div class="et">Este mes</div><div class="va num">${fmt(gMes)}</div>
      <div class="de ${dif > 0 ? 'sube' : 'baja'}">${gMesAnt ? `${ic(dif > 0 ? 'i-sube' : 'i-baja')}${fmt(Math.abs(dif))} vs ${MESES[fecha(mesAntK + '-01').getMonth()]}` : 'primer mes'}</div></div>
    <div class="mosaico"><div class="et">Hoy</div><div class="va num">${fmt(suma(gHoy))}</div>
      <div class="de">${gHoy.length ? `${gHoy.length} movimiento${gHoy.length > 1 ? 's' : ''}` : 'sin gastos'}</div></div>
    <div class="mosaico"><div class="et">Promedio al mes</div><div class="va num">${fmt(prom6)}</div><div class="de">últimos 6 meses</div></div>
    <div class="mosaico"><div class="et">Depósitos del mes</div><div class="va num">${fmt(ingMes)}</div><div class="de">recibidos en Santander</div></div>
  </div>


  <div class="rejilla">
    <div>
      <div class="seccion"><h2>En qué se va</h2>
        <div class="seg" style="width:190px">
          <button class="${usarMes ? '' : 'on'}" data-acc="periodoInicio" data-v="pago">Este pago</button>
          <button class="${usarMes ? 'on' : ''}" data-acc="periodoInicio" data-v="mes">Este mes</button>
        </div></div>
      <div class="tarjeta plana">${listaCategorias(porCat, usarMes ? 'mes' : 'pago', rango)}</div>
    </div>
    <div>
      <div class="seccion"><h2>Últimos movimientos</h2><button class="enlace" data-ir="movimientos">Ver todos</button></div>
      <div class="tarjeta plana">${ultimos.map(filaMov).join('') || vacio('i-lista', 'Sin movimientos todavía', E.perfil.gmail_conectado ? 'Aparecerán aquí en cuanto se lean tus correos' : 'Conecta tu Gmail para empezar')}</div>
    </div>
  </div>`;
}

function agrupar(movs, campo) {
  const g = new Map();
  for (const m of movs) {
    const k = m[campo];
    const x = g.get(k) || { k, total: 0, n: 0, movs: [] };
    x.total += m.m; x.n += 1; x.movs.push(m);
    g.set(k, x);
  }
  return [...g.values()].sort((a, b) => b.total - a.total);
}

function listaCategorias(grupos, tipo, rango) {
  if (!grupos.length) return vacio('i-cartera', 'Aún no hay gastos', 'en este periodo');
  const total = grupos.reduce((a, g) => a + g.total, 0);
  const factor = tipo === 'mes' ? 1 : (E.aj.frecuencia === 'mensual' ? 1 : E.aj.frecuencia === 'quincenal' ? 0.5 : 14 / 30.4);
  return grupos.map((g) => {
    const cat = CATS[g.k] || CATS.otros;
    const pres = (+E.aj.presupuestos[g.k] || 0) * factor;
    const pct = pres ? g.total / pres : g.total / total;
    const pie = pres
      ? `<span>${g.total > pres ? `Te pasaste ${fmt(g.total - pres)}` : `Quedan ${fmt(pres - g.total)}`}</span><span>de ${fmt(pres)}</span>`
      : `<span>${g.n} movimiento${g.n > 1 ? 's' : ''}</span><span>${Math.round((g.total / total) * 100)} %</span>`;
    return `<button class="cat-fila" style="--c:${cat.c}" data-acc="verCategoria" data-cat="${g.k}" data-desde="${rango[0]}" data-hasta="${rango[1]}">
      <span class="cat-ic">${ic('c-' + g.k)}</span>
      <span class="cuerpo"><span class="arriba"><b>${esc(cat.n)}</b><span class="monto num">${fmt(g.total)}</span></span>
      <span class="barrita"><i class="${pres && g.total > pres ? 'sobre' : ''}" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></span>
      <span class="abajo">${pie}</span></span></button>`;
  }).join('');
}

function filaMov(m) {
  const cat = CATS[m.cat] || CATS.otros;
  const entra = m.tipo === 'deposito';
  const fuera = m.cat === 'propias';
  const sub = [m.tipo === 'transferencia' ? 'Transferencia' : m.tipo === 'deposito' ? 'Depósito' : cat.n, m.h, nombreTarjeta(m.tj)].filter(Boolean).join(' · ');
  return `<button class="fila" data-acc="detalle" data-id="${esc(m.id)}">
    <span class="cat-ic" style="--c:${cat.c}">${ic('c-' + m.cat)}</span>
    <span class="cuerpo"><span class="t1">${esc(m.nombre)}</span><span class="t2">${esc(sub)}</span></span>
    <span class="monto num ${fuera ? 'fuera' : entra ? 'entra' : ''}">${entra ? '+' : ''}${fmt2(m.m)}${m.extra && m.extra.moneda ? `<small>${esc(m.extra.moneda)}</small>` : ''}</span>
  </button>`;
}

function vacio(icono, t, s) {
  return `<div class="vacio">${ic(icono)}<b>${esc(t)}</b>${esc(s || '')}</div>`;
}

/* ── Movimientos ────────────────────────────────────────────────────────── */
function filtrarMovs() {
  const f = E.f;
  const q = f.q.trim().toLowerCase();
  return E.movs.filter((m) => {
    if (f.tipo === 'gastos' && !esGasto(m)) return false;
    if (f.tipo === 'ingresos' && m.tipo !== 'deposito') return false;
    if (f.cat && m.cat !== f.cat) return false;
    if (f.tj && m.tj !== f.tj) return false;
    if (f.k && m.k !== f.k) return false;
    if (f.g && m.g !== f.g) return false;
    if (f.desde && m.f < f.desde) return false;
    if (f.hasta && m.f >= f.hasta) return false;
    if (!q && !f.todo && !f.desde && f.mes && mesDe(m.f) !== f.mes) return false;
    if (q && !(`${m.nombre} ${m.c} ${m.nota} ${CATS[m.cat]?.n || ''} ${nombreTarjeta(m.tj)} ${m.m}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

function vistaMovimientos() {
  const f = E.f;
  if (!f.mes) f.mes = mesDe(iso(hoy()));
  const lista = filtrarMovs();
  const total = suma(lista.filter((m) => (f.tipo === 'ingresos' ? true : m.tipo !== 'deposito')));
  const catsPresentes = [...new Set(E.movs.filter((m) => (f.tipo === 'ingresos' ? m.tipo === 'deposito' : f.tipo === 'gastos' ? esGasto(m) : true)).map((m) => m.cat))]
    .sort((a, b) => Object.keys(CATS).indexOf(a) - Object.keys(CATS).indexOf(b));
  const tarjetas = E.tarjetasVistas;
  const filtroExtra = f.k || f.g || f.desde
    ? `<div style="margin-top:12px"><button class="chip on" data-acc="quitarFiltroExtra">${esc(f.g ? (E.movs.find((m) => m.g === f.g)?.nombre || 'Comercio') : f.k ? (E.movs.find((m) => m.k === f.k)?.nombre || 'Comercio') : `${fDia(f.desde)} – ${fDia(iso(sumaDias(fecha(f.hasta), -1)))}`)} ${ic('i-x')}</button></div>`
    : '';
  const porMes = !f.q.trim() && !f.todo && !f.desde;

  // Agrupar por día
  let html = '';
  let diaActual = '';
  let abierto = false;
  const totDia = {};
  for (const m of lista) totDia[m.f] = (totDia[m.f] || 0) + (esGasto(m) ? m.m : 0);
  for (const m of lista.slice(0, f.limite)) {
    if (m.f !== diaActual) {
      if (abierto) html += '</div>';
      diaActual = m.f;
      html += `<div class="dia"><span>${esc(cap(fDiaLargo(m.f)))}</span><span>${totDia[m.f] ? fmt(totDia[m.f]) : ''}</span></div><div class="tarjeta plana">`;
      abierto = true;
    }
    html += filaMov(m);
  }
  if (abierto) html += '</div>';
  if (lista.length > f.limite) html += `<div class="centro" style="margin-top:16px"><button class="btn" data-acc="masMovs">Ver ${Math.min(200, lista.length - f.limite)} más</button></div>`;

  return `
  <header class="encabezado"><div><h1>Movimientos</h1>
    <div class="sub">${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'} · <span class="num">${fmt(total)}</span></div></div></header>
  <label class="buscador">${ic('i-buscar')}<input id="q" type="search" placeholder="Buscar comercio, monto, nota…" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
    ${f.q ? `<button data-acc="limpiarQ" aria-label="Borrar búsqueda">${ic('i-x')}</button>` : ''}</label>
  <div class="seg" style="margin-top:12px">
    ${[['gastos', 'Gastos'], ['ingresos', 'Depósitos'], ['todo', 'Todo']].map(([v, n]) => `<button class="${f.tipo === v ? 'on' : ''}" data-acc="tipoMov" data-v="${v}">${n}</button>`).join('')}
  </div>
  ${porMes ? `<div class="navmes">
    <button class="icono-btn" data-acc="mesMov" data-d="-1" aria-label="Mes anterior">${ic('i-izq')}</button>
    <button data-acc="todoMov"><b>${esc(cap(fMes(f.mes)))}</b></button>
    <button class="icono-btn" data-acc="mesMov" data-d="1" aria-label="Mes siguiente" ${f.mes >= mesDe(iso(hoy())) ? 'disabled style="opacity:.35"' : ''}>${ic('i-der')}</button>
  </div>` : `<div class="navmes"><b>${f.desde ? 'Rango elegido' : 'Todo el historial'}</b>${!f.q && !f.desde ? '<button class="btn chico" data-acc="todoMov">Ver por mes</button>' : ''}</div>`}
  <div class="chips" style="margin-top:6px">
    <button class="chip ${!f.cat ? 'on' : ''}" data-acc="catMov" data-v="">Todas</button>
    ${catsPresentes.map((c) => `<button class="chip ${f.cat === c ? 'on' : ''}" style="--c:${CATS[c].c}" data-acc="catMov" data-v="${c}"><span class="pt"></span>${esc(CATS[c].n)}</button>`).join('')}
  </div>
  ${tarjetas.length > 1 ? `<div class="chips" style="margin-top:6px">
    <button class="chip ${!f.tj ? 'on' : ''}" data-acc="tjMov" data-v="">${ic('i-tarjeta')}Todas</button>
    ${tarjetas.map((t) => `<button class="chip ${f.tj === t ? 'on' : ''}" data-acc="tjMov" data-v="${esc(t)}">${esc(nombreTarjeta(t))}</button>`).join('')}
  </div>` : ''}
  ${filtroExtra}
  ${html || `<div class="tarjeta" style="margin-top:14px">${vacio('i-buscar', 'Nada por aquí', f.q ? 'Prueba con otra palabra' : 'Sin movimientos con estos filtros')}</div>`}`;
}

/* ── Análisis ───────────────────────────────────────────────────────────── */
function rangoAnalisis() {
  const mesK = mesDe(iso(hoy()));
  const r = E.an.rango;
  if (r === 'mes') {
    const k = E.an.mes || mesK;
    return { desde: k + '-01', hasta: mesMas(k, 1) + '-01', meses: 1, etiqueta: cap(fMes(k)), prevDesde: mesMas(k, -1) + '-01' };
  }
  const n = { '3m': 3, '6m': 6, '12m': 12 }[r];
  if (n) {
    const desdeK = mesMas(mesK, -(n - 1));
    return { desde: desdeK + '-01', hasta: mesMas(mesK, 1) + '-01', meses: n, etiqueta: `Últimos ${n} meses`, prevDesde: mesMas(desdeK, -n) + '-01' };
  }
  const primero = E.movs.length ? E.movs[E.movs.length - 1].f : iso(hoy());
  const meses = Math.max(1, (hoy().getFullYear() - fecha(primero).getFullYear()) * 12 + hoy().getMonth() - fecha(primero).getMonth() + 1);
  return { desde: primero, hasta: mesMas(mesK, 1) + '-01', meses, etiqueta: `Desde ${fMes(mesDe(primero))}`, prevDesde: null };
}

function analisisResumen(R) {
  const g = gastos(R.desde, R.hasta);
  const total = suma(g);
  const prev = R.prevDesde ? suma(gastos(R.prevDesde, R.desde)) : 0;
  const ing = suma(E.movs.filter((m) => esIngreso(m) && m.f >= R.desde && m.f < R.hasta));
  const porCat = agrupar(g, 'cat');
  const prevCat = R.prevDesde ? Object.fromEntries(agrupar(gastos(R.prevDesde, R.desde), 'cat').map((x) => [x.k, x.total])) : {};
  const porComercio = agrupar(g, 'g').slice(0, 10);
  const porTj = agrupar(g.filter((m) => m.tj), 'tj');

  // 12 meses en columnas
  const mesK = mesDe(iso(hoy()));
  const doce = [];
  for (let i = 11; i >= 0; i--) {
    const k = mesMas(mesK, -i);
    doce.push({ k, et: MESES[fecha(k + '-01').getMonth()], tip: fMes(k), v: suma(gastos(k + '-01', mesMas(k, 1) + '-01')), actual: k + '-01' >= R.desde && k + '-01' < R.hasta });
  }
  const completos = doce.slice(0, 11).filter((x) => x.v > 0);
  const prom = completos.length ? completos.reduce((a, x) => a + x.v, 0) / completos.length : 0;

  // Día de la semana (promedio por día de calendario en el rango)
  const diasRango = Math.max(1, difDias(fecha(R.desde), new Date(Math.min(fecha(R.hasta), sumaDias(hoy(), 1)))));
  const porDow = [0, 0, 0, 0, 0, 0, 0];
  for (const m of g) porDow[fecha(m.f).getDay()] += m.m;
  const semanas = diasRango / 7;
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ et: DIAS[d], v: porDow[d] / Math.max(1, semanas), actual: true }));

  const delta = prev ? (total - prev) / prev : null;
  const recurrentes = pagosRecurrentes();

  return `

  <div class="mosaicos cuatro">
    <div class="mosaico"><div class="et">Gastaste</div><div class="va num">${fmt(total)}</div>
      <div class="de ${delta == null ? '' : delta > 0 ? 'sube' : 'baja'}">${delta == null ? `${g.length} movimientos` : `${ic(delta > 0 ? 'i-sube' : 'i-baja')}${Math.abs(Math.round(delta * 100))} % vs periodo anterior`}</div></div>
    <div class="mosaico"><div class="et">Al mes</div><div class="va num">${fmt(total / R.meses)}</div><div class="de">de ${fmt(ingresoMensual())} que ganas</div></div>
    <div class="mosaico"><div class="et">Depósitos</div><div class="va num">${fmt(ing)}</div><div class="de">recibidos</div></div>
    <div class="mosaico"><div class="et">Gasto típico</div><div class="va num">${fmt(mediana(g.filter((m) => m.tipo === 'compra').map((m) => m.m)))}</div><div class="de">por compra (mediana)</div></div>
  </div>

  <div class="rejilla">
    <div>
      <div class="seccion"><h2>Gasto por mes</h2></div>
      <div class="tarjeta">
        <div class="texto-2 peq">Últimos 12 meses · promedio ${fmt(prom)}</div>
        ${graficaColumnas(doce, { prom, alto: 190 })}
        <div class="leyenda"><span><i style="--c:var(--acento)"></i>Gasto del mes</span><span><i class="linea" style="--c:var(--texto-2)"></i>Promedio</span></div>
        ${tablaDatos(doce.map((x) => [fMes(x.k), fmt(x.v)]), ['Mes', 'Gasto'])}
      </div>
      <div class="seccion"><h2>Por categoría</h2></div>
      <div class="tarjeta plana">${listaCategoriasAnalisis(porCat, prevCat, total, R)}</div>
    </div>
    <div>
      <div class="seccion"><h2>Dónde más gastas</h2></div>
      <div class="tarjeta plana">${porComercio.map((x) => {
        const m0 = x.movs[0]; const cat = CATS[m0.cat] || CATS.otros;
        return `<button class="fila" data-acc="verComercio" data-g="${esc(x.k)}">
          <span class="cat-ic" style="--c:${cat.c}">${ic('c-' + m0.cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(m0.nombre)}</span><span class="t2">${x.n} ${x.n === 1 ? 'vez' : 'veces'} · ${esc(cat.n)}</span></span>
          <span class="monto num">${fmt(x.total)}</span></button>`;
      }).join('') || vacio('i-cartera', 'Sin gastos', '')}</div>

      <div class="seccion"><h2>Qué día gastas más</h2></div>
      <div class="tarjeta"><div class="texto-2 peq">Promedio por día de la semana</div>
        ${graficaColumnas(dow, { alto: 150, etiquetaTodas: false })}
        ${tablaDatos(dow.map((x) => [x.et, fmt(x.v)]), ['Día', 'Promedio'])}</div>

      ${recurrentes.length ? `<div class="seccion"><h2>Pagos que se repiten</h2><span class="texto-3 peq">${fmt(recurrentes.reduce((a, r) => a + r.prom, 0))}/mes</span></div>
      <div class="tarjeta plana">${recurrentes.map((r) => `<button class="fila" data-acc="verComercio" data-g="${esc(r.g)}">
          <span class="cat-ic" style="--c:${(CATS[r.cat] || CATS.otros).c}">${ic('c-' + r.cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(r.nombre)}</span><span class="t2">${r.meses} de los últimos 4 meses</span></span>
          <span class="monto num">${fmt(r.prom)}<small>al mes</small></span></button>`).join('')}</div>` : ''}

      ${porTj.length > 1 ? `<div class="seccion"><h2>Por tarjeta o cuenta</h2></div>
      <div class="tarjeta plana">${porTj.map((x) => `<button class="fila" data-acc="verTarjeta" data-tj="${esc(x.k)}">
          <span class="cat-ic" style="--c:var(--texto-2)">${ic('i-tarjeta')}</span>
          <span class="cuerpo"><span class="t1">${esc(nombreTarjeta(x.k))}</span><span class="t2">${x.n} movimientos · ${Math.round((x.total / total) * 100)} %</span></span>
          <span class="monto num">${fmt(x.total)}</span></button>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function listaCategoriasAnalisis(grupos, prev, total, R) {
  if (!grupos.length) return vacio('i-cartera', 'Sin gastos', 'en este periodo');
  return grupos.map((g) => {
    const cat = CATS[g.k] || CATS.otros;
    const p = prev[g.k] || 0;
    const d = R.prevDesde && p ? (g.total - p) / p : null;
    return `<button class="cat-fila" style="--c:${cat.c}" data-acc="verCategoria" data-cat="${g.k}" data-desde="${R.desde}" data-hasta="${R.hasta}">
      <span class="cat-ic">${ic('c-' + g.k)}</span>
      <span class="cuerpo"><span class="arriba"><b>${esc(cat.n)}</b><span class="monto num">${fmt(g.total)}</span></span>
      <span class="barrita"><i style="width:${((g.total / grupos[0].total) * 100).toFixed(1)}%"></i></span>
      <span class="abajo"><span>${Math.round((g.total / total) * 100)} % · ${fmt(g.total / R.meses)} al mes</span>
      <span class="${d == null ? '' : d > 0.05 ? 'sube' : d < -0.05 ? 'baja' : ''}">${d == null ? (R.prevDesde ? 'nuevo' : '') : `${d > 0 ? '+' : ''}${Math.round(d * 100)} %`}</span></span></span></button>`;
  }).join('');
}

function mediana(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function pagosRecurrentes() {
  const mesK = mesDe(iso(hoy()));
  const ventana = [1, 2, 3, 4].map((i) => mesMas(mesK, -i));
  const desde = ventana[3] + '-01';
  const hasta = mesK + '-01';
  const out = [];
  for (const x of agrupar(gastos(desde, hasta).filter((m) => m.tipo === 'compra'), 'g')) {
    const porMes = {};
    for (const m of x.movs) porMes[mesDe(m.f)] = (porMes[mesDe(m.f)] || 0) + m.m;
    const vals = Object.values(porMes);
    if (vals.length < 3) continue;
    const prom = vals.reduce((a, v) => a + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - prom) ** 2, 0) / vals.length);
    const veces = x.n / vals.length;
    if (sd / prom < 0.25 && veces <= 2) out.push({ g: x.k, nombre: x.movs[0].nombre, cat: x.movs[0].cat, prom, meses: vals.length });
  }
  return out.sort((a, b) => b.prom - a.prom).slice(0, 8);
}

const vecesTxt = (v) => { const r = v >= 3 ? Math.round(v) : Math.round(v * 10) / 10; return `${String(r).replace('.', ',')} ${r === 1 ? 'vez' : 'veces'}`; };
/* ── Análisis a fondo: pestañas ─────────────────────────────────────────── */
const FRANJAS = [['Madrugada', 0, 6], ['Mañana', 6, 12], ['Mediodía', 12, 16], ['Tarde', 16, 20], ['Noche', 20, 24]];
const horaDe = (m) => (m.h ? +m.h.slice(0, 2) : null);
const DIAS_LMD = [1, 2, 3, 4, 5, 6, 0];

function vistaAnalisis() {
  const v = E.an.vista || 'resumen';
  const R = rangoAnalisis();
  const pestanas = [['resumen', 'General'], ['dia', 'Día a día'], ['habitos', 'Hábitos'], ['ahorro', 'Ahorrar']];
  const mesK = mesDe(iso(hoy()));
  const rangos = [['mes', 'Mes'], ['3m', '3 m'], ['6m', '6 m'], ['12m', '1 año'], ['todo', 'Todo']];
  let selector = '';
  if (v === 'dia') {
    const k = E.an.mesDia || mesK;
    selector = `<div class="navmes"><button class="icono-btn" data-acc="mesDia" data-d="-1" aria-label="Mes anterior">${ic('i-izq')}</button><b>${esc(cap(fMes(k)))}</b>
      <button class="icono-btn" data-acc="mesDia" data-d="1" aria-label="Mes siguiente" ${k >= mesK ? 'disabled style="opacity:.35"' : ''}>${ic('i-der')}</button></div>`;
  } else {
    selector = `<div class="seg" style="margin-top:10px">${rangos.map(([r, n]) => `<button class="${E.an.rango === r ? 'on' : ''}" data-acc="rango" data-v="${r}">${n}</button>`).join('')}</div>
      ${E.an.rango === 'mes' ? `<div class="navmes"><button class="icono-btn" data-acc="mesAn" data-d="-1" aria-label="Mes anterior">${ic('i-izq')}</button><b>${esc(R.etiqueta)}</b>
      <button class="icono-btn" data-acc="mesAn" data-d="1" aria-label="Mes siguiente" ${(E.an.mes || mesK) >= mesK ? 'disabled style="opacity:.35"' : ''}>${ic('i-der')}</button></div>` : ''}`;
  }
  const cuerpo = v === 'dia' ? analisisDia() : v === 'habitos' ? analisisHabitos(R) : v === 'ahorro' ? analisisAhorro(R) : analisisResumen(R);
  return `<header class="encabezado"><div><h1>Análisis</h1><div class="sub">${v === 'dia' ? 'Cada día, a detalle' : esc(R.etiqueta)}</div></div></header>
    <div class="seg pestanas">${pestanas.map(([p, n]) => `<button class="${v === p ? 'on' : ''}" data-acc="pestanaAn" data-v="${p}">${n}</button>`).join('')}</div>
    ${selector}${cuerpo}`;
}

/* Escala secuencial (un solo tono, de claro a oscuro) para los mapas de calor */
function nivelesCalor(valores) {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return () => 0;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  const cortes = [q(0.2), q(0.45), q(0.7), q(0.9)];
  return (x) => (x <= 0 ? 0 : 1 + cortes.filter((c) => x > c).length);
}
const leyendaCalor = () => `<div class="leyenda-calor"><span>Menos</span>${[0, 1, 2, 3, 4, 5].map((n) => `<i class="c${n}"></i>`).join('')}<span>Más</span></div>`;

/* ── Día a día ──────────────────────────────────────────────────────────── */
function analisisDia() {
  const mesK = mesDe(iso(hoy()));
  const k = E.an.mesDia || mesK;
  const [y, mo] = k.split('-').map(Number);
  const diasMes = new Date(y, mo, 0).getDate();
  const actual = k === mesK;
  const pasados = actual ? hoy().getDate() : diasMes;
  const g = gastos(k + '-01', mesMas(k, 1) + '-01');
  const porDia = {}; const nDia = {};
  for (const m of g) { porDia[m.f] = (porDia[m.f] || 0) + m.m; nDia[m.f] = (nDia[m.f] || 0) + 1; }
  const total = suma(g);
  const promDia = total / pasados;
  const proy = actual ? promDia * diasMes : total;
  const diaS = (d) => `${k}-${pad(d)}`;
  let sinGasto = 0; let racha = 0; let rachaMax = 0;
  for (let d = 1; d <= pasados; d++) { if (!porDia[diaS(d)]) { sinGasto++; racha++; rachaMax = Math.max(rachaMax, racha); } else racha = 0; }
  const presMes = +E.aj.pago_monto ? ingresoMensual() * (1 - (+E.aj.meta_ahorro || 0) / 100) : 0;

  // Calendario de calor
  const nivel = nivelesCalor(Object.values(porDia));
  const offset = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
  let cal = `<div class="calendario">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cab">${d}</span>`).join('')}`;
  for (let i = 0; i < offset; i++) cal += '<span></span>';
  for (let d = 1; d <= diasMes; d++) {
    const f = diaS(d); const v = porDia[f] || 0; const futuro = actual && d > pasados;
    cal += `<button class="dia-cal c${futuro ? 'f' : nivel(v)} ${actual && d === pasados ? 'hoy' : ''}" ${futuro ? 'disabled' : `data-acc="verDia" data-f="${f}"`} data-tip="${esc(`<b>${cap(fDia(f))}</b> · ${v ? fmt(v) : 'sin gastos'}`)}">
      <b>${d}</b><small>${v ? fmtK(v) : ''}</small></button>`;
  }
  cal += '</div>';

  // Acumulado del mes contra el mes pasado y contra tu presupuesto
  const prevK = mesMas(k, -1);
  const [py, pm] = prevK.split('-').map(Number);
  const diasPrev = new Date(py, pm, 0).getDate();
  const prevPorDia = {};
  for (const m of gastos(prevK + '-01', k + '-01')) prevPorDia[+m.f.slice(8)] = (prevPorDia[+m.f.slice(8)] || 0) + m.m;
  const acum = []; let s = 0;
  for (let d = 1; d <= pasados; d++) { s += porDia[diaS(d)] || 0; acum.push([d, s]); }
  const acumPrev = []; s = 0;
  for (let d = 1; d <= diasPrev; d++) { s += prevPorDia[d] || 0; acumPrev.push([d, s]); }
  const series = [
    { nombre: cap(MESES_L[pm - 1]), clase: 'l-prev', pts: acumPrev },
    { nombre: cap(MESES_L[mo - 1]), clase: 'l-act', pts: acum, etiquetaFinal: true },
  ];
  if (presMes) series.unshift({ nombre: 'Tu presupuesto', clase: 'l-pres', pts: [[1, presMes / diasMes], [diasMes, presMes]] });

  const caros = Object.entries(porDia).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dowHoy = hoy().getDay();
  const mismosDias = [];
  for (let i = 1; i <= 8; i++) { const f = iso(sumaDias(hoy(), -7 * i)); mismosDias.push(suma(gastos(f, iso(sumaDias(fecha(f), 1))))); }
  const promMismoDia = mismosDias.reduce((a, b) => a + b, 0) / mismosDias.length;
  const gHoy = suma(gastos(iso(hoy()), iso(sumaDias(hoy(), 1))));

  return `
  <div class="mosaicos cuatro">
    <div class="mosaico"><div class="et">${actual ? 'Llevas este mes' : 'Gastaste'}</div><div class="va num">${fmt(total)}</div><div class="de">${g.length} movimientos</div></div>
    <div class="mosaico"><div class="et">Promedio por día</div><div class="va num">${fmt(promDia)}</div><div class="de">mediana ${fmt(mediana(Object.values(porDia)))} los días que gastas</div></div>
    <div class="mosaico"><div class="et">${actual ? 'Así cerrarías el mes' : 'Días sin gastar'}</div><div class="va num">${actual ? fmt(proy) : sinGasto}</div>
      <div class="de ${actual && presMes ? (proy > presMes ? 'sube' : 'baja') : ''}">${actual ? (presMes ? `${proy > presMes ? 'arriba' : 'abajo'} de tu presupuesto por ${fmt(Math.abs(proy - presMes))}` : 'al ritmo de hoy') : `racha más larga: ${rachaMax}`}</div></div>
    <div class="mosaico"><div class="et">${actual ? 'Días sin gastar' : 'Día más caro'}</div><div class="va num">${actual ? `${sinGasto} de ${pasados}` : caros[0] ? fmt(caros[0][1]) : '—'}</div>
      <div class="de">${actual ? `racha más larga: ${rachaMax} día${rachaMax === 1 ? '' : 's'}` : caros[0] ? esc(fDia(caros[0][0])) : ''}</div></div>
  </div>
  ${actual ? `<div class="tarjeta" style="margin-top:12px;display:flex;gap:12px;align-items:center">
    <span class="cat-ic" style="--c:var(--acento)">${ic('i-calendario')}</span>
    <span class="peq texto-2" style="flex:1">Hoy llevas <b style="color:var(--texto)">${fmt(gHoy)}</b>. Un ${DIAS_L[dowHoy]} normal gastas <b style="color:var(--texto)">${fmt(promMismoDia)}</b> (promedio de los últimos 8).</span></div>` : ''}
  <div class="rejilla">
    <div>
      <div class="seccion"><h2>Calendario</h2><span class="texto-3 peq">toca un día</span></div>
      <div class="tarjeta">${cal}${leyendaCalor()}</div>
    </div>
    <div>
      <div class="seccion"><h2>Cómo se acumula</h2></div>
      <div class="tarjeta"><div class="texto-2 peq">Gasto acumulado por día del mes</div>
        ${graficaLinea(series, { maxX: Math.max(diasMes, diasPrev), alto: 220 })}
        <div class="leyenda">${series.map((x) => `<span><i class="linea ${x.clase}"></i>${esc(x.nombre)}</span>`).join('')}</div>
        ${tablaDatos(acum.map(([d, v]) => [`${d} de ${MESES[mo - 1]}`, fmt(v)]), ['Día', 'Acumulado'])}</div>
      <div class="seccion"><h2>Días más caros</h2></div>
      <div class="tarjeta plana">${caros.map(([f, v]) => {
        const top = agrupar(gastos(f, iso(sumaDias(fecha(f), 1))), 'g')[0];
        return `<button class="fila" data-acc="verDia" data-f="${f}"><span class="cat-ic" style="--c:var(--acento)">${ic('i-calendario')}</span>
          <span class="cuerpo"><span class="t1">${esc(cap(fDiaLargo(f)))}</span><span class="t2">${nDia[f]} movimientos · sobre todo ${esc(top ? top.movs[0].nombre : '')}</span></span>
          <span class="monto num">${fmt(v)}</span></button>`;
      }).join('') || vacio('i-calendario', 'Sin gastos', 'en este mes')}</div>
    </div>
  </div>`;
}

function hojaDia(f) {
  const lista = E.movs.filter((m) => m.f === f).sort((a, b) => (a.h || '').localeCompare(b.h || ''));
  const g = lista.filter(esGasto);
  const porCat = agrupar(g, 'cat');
  abrirHoja(`${cabHoja(cap(fDiaLargo(f)))}
    <div class="grande" style="padding-bottom:8px"><div class="m num">${fmt(suma(g))}</div><div class="d">${g.length} gasto${g.length === 1 ? '' : 's'}${lista.length > g.length ? ` · ${lista.length - g.length} otros movimientos` : ''}</div></div>
    ${porCat.length ? `<div class="chips" style="margin:0 -18px 6px;padding:0 18px">${porCat.map((c) => `<span class="chip" style="--c:${CATS[c.k].c}"><span class="pt"></span>${esc(CATS[c.k].n)} ${fmt(c.total)}</span>`).join('')}</div>` : ''}
    <div class="tarjeta plana" style="box-shadow:none;background:var(--sup-2)">${lista.map(filaMov).join('') || vacio('i-calendario', 'Sin movimientos', '')}</div>`);
}

/* ── Hábitos ────────────────────────────────────────────────────────────── */
function diasDelRango(R) {
  const fin = new Date(Math.min(fecha(R.hasta), sumaDias(hoy(), 1)));
  return Math.max(1, difDias(fecha(R.desde), fin));
}
function pagosEntre(desde, hasta) {
  const out = []; const aj = E.aj; const a = fecha(desde); const b = fecha(hasta);
  if (aj.frecuencia === 'catorcenal') {
    let d = fecha(aj.pago_ref || desde);
    while (d > a) d = sumaDias(d, -14);
    for (; d < b; d = sumaDias(d, 14)) if (d >= a) out.push(iso(d));
  } else {
    for (let x = new Date(a.getFullYear(), a.getMonth(), 1); x < b; x = new Date(x.getFullYear(), x.getMonth() + 1, 1)) {
      const dias = aj.frecuencia === 'quincenal' ? [15, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()] : [Math.min(28, +aj.pago_dia || 1)];
      for (const d of dias) { const f = new Date(x.getFullYear(), x.getMonth(), d); if (f >= a && f < b) out.push(iso(f)); }
    }
  }
  return out;
}

function analisisHabitos(R) {
  const g = gastos(R.desde, R.hasta);
  if (!g.length) return `<div class="tarjeta" style="margin-top:14px">${vacio('i-grafica', 'Sin gastos', 'en este periodo')}</div>`;
  const dias = diasDelRango(R);
  const semanas = dias / 7;
  const total = suma(g);

  // Por hora (sólo compras: una transferencia a medianoche no es un hábito de consumo)
  const compras = g.filter((m) => m.tipo === 'compra');
  const totalCompras = suma(compras) || 1;
  const porHora = Array(24).fill(0); const nHora = Array(24).fill(0);
  for (const m of compras) { const h = horaDe(m); if (h != null) { porHora[h] += m.m; nHora[h]++; } }
  const horas = porHora.map((v, h) => ({ et: h % 3 === 0 ? `${h}` : '', tip: `${h}:00 a ${h}:59 · ${nHora[h]} compras`, v: v / R.meses, actual: true }));
  const madrugada = compras.filter((m) => { const h = horaDe(m); return h != null && h < 6; });
  const noche = compras.filter((m) => { const h = horaDe(m); return h != null && h >= 20; });

  // Día × franja (promedio por semana)
  const mat = DIAS_LMD.map(() => FRANJAS.map(() => 0));
  for (const m of compras) {
    const h = horaDe(m); if (h == null) continue;
    const fi = FRANJAS.findIndex(([, a, b]) => h >= a && h < b);
    mat[DIAS_LMD.indexOf(fecha(m.f).getDay())][fi] += m.m / semanas;
  }
  const nivel = nivelesCalor(mat.flat());
  const mapa = `<div class="mapa-franjas"><span></span>${FRANJAS.map(([n]) => `<span class="cab">${n}</span>`).join('')}
    ${DIAS_LMD.map((d, i) => `<span class="cab izq">${DIAS[d]}</span>${FRANJAS.map((fr, j) => `<span class="celda c${nivel(mat[i][j])}" data-tip="${esc(`<b>${cap(DIAS_L[d])}, ${fr[0].toLowerCase()}</b> · ${fmt(mat[i][j])} por semana`)}">${mat[i][j] >= 50 ? fmtK(mat[i][j]) : ''}</span>`).join('')}`).join('')}</div>`;

  // Fin de semana contra entre semana (por día de calendario)
  let nFin = 0; let nSem = 0;
  for (let x = fecha(R.desde); x < new Date(Math.min(fecha(R.hasta), sumaDias(hoy(), 1))); x = sumaDias(x, 1)) (x.getDay() % 6 === 0 ? nFin++ : nSem++);
  const gFin = suma(g.filter((m) => fecha(m.f).getDay() % 6 === 0));
  const diaFin = gFin / Math.max(1, nFin); const diaSem = (total - gFin) / Math.max(1, nSem);

  // Gastos hormiga: compras chicas (< $150)
  const hormiga = g.filter((m) => m.tipo === 'compra' && m.m < 150);
  const hormigaTop = agrupar(hormiga, 'g').sort((a, b) => b.n - a.n).slice(0, 5);

  // Frecuencia por comercio
  const frecuentes = agrupar(g.filter((m) => m.tipo === 'compra'), 'g').sort((a, b) => b.n - a.n).slice(0, 8);

  // Subcategorías
  const subs = agrupar(g.map((m) => ({ ...m, sc: m.cat + '|' + (m.sub || '') })), 'sc').slice(0, 12);

  // Efecto del día de pago: gasto por día en los 3 días después de cobrar contra el resto
  let efecto = '';
  if (+E.aj.pago_monto) {
    const pagos = pagosEntre(iso(sumaDias(fecha(R.desde), -31)), R.hasta).map(fecha);
    let gCerca = 0; let dCerca = 0; let gLejos = 0; let dLejos = 0;
    const porDia = {}; for (const m of g) porDia[m.f] = (porDia[m.f] || 0) + m.m;
    for (let x = fecha(R.desde); x < new Date(Math.min(fecha(R.hasta), hoy())); x = sumaDias(x, 1)) {
      const ult = pagos.filter((p) => p <= x).pop();
      if (!ult) continue;
      const cerca = difDias(ult, x) < 3;
      const v = porDia[iso(x)] || 0;
      if (cerca) { gCerca += v; dCerca++; } else { gLejos += v; dLejos++; }
    }
    if (dCerca && dLejos) {
      const a = gCerca / dCerca; const b = gLejos / dLejos;
      efecto = `<div class="tarjeta dato"><span class="cat-ic" style="--c:var(--acento)">${ic('i-cartera')}</span><div>
        <b>Los 3 días después de cobrar gastas ${fmt(a)} al día</b><div class="texto-2 peq">El resto de los días, ${fmt(b)}. ${a > b * 1.3 ? `Es ${(a / b).toFixed(1)} veces más: el dinero recién cobrado se va rápido.` : 'Tu gasto es parejo durante el periodo.'}</div></div></div>`;
    }
  }

  return `
  <div class="mosaicos cuatro">
    <div class="mosaico"><div class="et">Compras al día</div><div class="va num">${(g.filter((m) => m.tipo === 'compra').length / dias).toFixed(1)}</div><div class="de">ticket típico ${fmt(mediana(g.filter((m) => m.tipo === 'compra').map((m) => m.m)))}</div></div>
    <div class="mosaico"><div class="et">Fin de semana</div><div class="va num">${fmt(diaFin)}</div><div class="de ${diaFin > diaSem ? 'sube' : 'baja'}">al día · entre semana ${fmt(diaSem)}</div></div>
    <div class="mosaico"><div class="et">Gastos hormiga</div><div class="va num">${fmt(suma(hormiga) / R.meses)}</div><div class="de">al mes · ${Math.round(hormiga.length / R.meses)} compras chicas</div></div>
    <div class="mosaico"><div class="et">De noche y madrugada</div><div class="va num">${fmt((suma(noche) + suma(madrugada)) / R.meses)}</div><div class="de">al mes · ${Math.round(((suma(noche) + suma(madrugada)) / totalCompras) * 100)} % de tus compras</div></div>
  </div>
  ${efecto}
  <div class="rejilla">
    <div>
      <div class="seccion"><h2>A qué hora gastas</h2></div>
      <div class="tarjeta"><div class="texto-2 peq">Compras: promedio al mes por hora del día</div>
        ${graficaColumnas(horas, { alto: 170, sinValores: true })}
        ${madrugada.length ? `<p class="peq texto-2" style="margin:10px 0 0">Entre 12 y 6 de la mañana: <b style="color:var(--texto)">${fmt(suma(madrugada) / R.meses)} al mes</b> en ${madrugada.length} compras, sobre todo en ${esc(agrupar(madrugada, 'g').slice(0, 2).map((x) => x.movs[0].nombre).join(' y '))}.</p>` : ''}
        ${tablaDatos(porHora.map((v, h) => [`${h}:00`, fmt(v / R.meses)]), ['Hora', 'Al mes'])}</div>
      <div class="seccion"><h2>Día y momento</h2><span class="texto-3 peq">compras por semana</span></div>
      <div class="tarjeta">${mapa}${leyendaCalor()}</div>
      <div class="seccion"><h2>En qué exactamente</h2><span class="texto-3 peq">subcategorías</span></div>
      <div class="tarjeta plana">${subs.map((x) => {
        const [cat, sub] = x.k.split('|'); const c = CATS[cat] || CATS.otros;
        return `<button class="cat-fila" style="--c:${c.c}" data-acc="verCategoria" data-cat="${cat}" data-desde="${R.desde}" data-hasta="${R.hasta}">
          <span class="cat-ic">${ic('c-' + cat)}</span>
          <span class="cuerpo"><span class="arriba"><b>${esc(sub ? cap(sub) : c.n)}</b><span class="monto num">${fmt(x.total / R.meses)}<small class="texto-3"> /mes</small></span></span>
          <span class="barrita"><i style="width:${((x.total / subs[0].total) * 100).toFixed(1)}%"></i></span>
          <span class="abajo"><span>${esc(c.n)} · ${x.n} ${cat === 'transferencias' ? 'envíos' : 'compras'}</span><span>ticket ${fmt(x.total / x.n)}</span></span></span></button>`;
      }).join('')}</div>
    </div>
    <div>
      <div class="seccion"><h2>Gastos hormiga</h2><span class="texto-3 peq">compras de menos de $150</span></div>
      <div class="tarjeta plana">${hormigaTop.map((x) => `<button class="fila" data-acc="verComercio" data-g="${esc(x.k)}">
          <span class="cat-ic" style="--c:${CATS[x.movs[0].cat].c}">${ic('c-' + x.movs[0].cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(x.movs[0].nombre)}</span><span class="t2">${vecesTxt(x.n)} · ${vecesTxt(x.n / R.meses)} al mes · ticket ${fmt(x.total / x.n)}</span></span>
          <span class="monto num">${fmt(x.total / R.meses)}<small>al mes</small></span></button>`).join('') || vacio('i-cartera', 'Sin gastos hormiga', '')}</div>
      <div class="seccion"><h2>A dónde vas más seguido</h2></div>
      <div class="tarjeta plana">${frecuentes.map((x) => `<button class="fila" data-acc="verComercio" data-g="${esc(x.k)}">
          <span class="cat-ic" style="--c:${CATS[x.movs[0].cat].c}">${ic('c-' + x.movs[0].cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(x.movs[0].nombre)}</span><span class="t2">${vecesTxt(x.n / R.meses)} al mes · ticket ${fmt(x.total / x.n)}</span></span>
          <span class="monto num">${fmt(x.total / R.meses)}<small>al mes</small></span></button>`).join('')}</div>
    </div>
  </div>`;
}

/* ── Ahorrar ────────────────────────────────────────────────────────────── */
function analisisAhorro(R) {
  const g = gastos(R.desde, R.hasta);
  if (!g.length) return `<div class="tarjeta" style="margin-top:14px">${vacio('i-cartera', 'Sin gastos', 'en este periodo')}</div>`;
  const meses = R.meses;
  const nec = suma(g.filter((m) => m.esencial === true));
  const gus = suma(g.filter((m) => m.esencial === false));
  const otros = suma(g) - nec - gus;

  // Cada gasto evitable cae en UN solo grupo (para no contar doble el ahorro)
  const grupos = { apuestas: [], madrugada: [], hormiga: [], gustos: {} };
  for (const m of g) {
    if (m.cat === 'apuestas') { grupos.apuestas.push(m); continue; }
    if (m.esencial !== false) continue;
    const h = horaDe(m);
    if (h != null && h < 6) grupos.madrugada.push(m);
    else if (m.tipo === 'compra' && m.m < 150) grupos.hormiga.push(m);
    else { const k = m.cat + '|' + (m.sub || ''); (grupos.gustos[k] = grupos.gustos[k] || []).push(m); }
  }
  const acciones = [];
  if (grupos.apuestas.length) {
    const t = suma(grupos.apuestas) / meses;
    acciones.push({ icono: 'c-apuestas', c: CATS.apuestas.c, titulo: 'Deja las apuestas', ahorro: t,
      texto: `Apostaste ${fmt(t)} al mes en ${Math.round(grupos.apuestas.length / meses)} jugadas. Es dinero que casi siempre se pierde: poner un tope semanal o dejarlo es el ahorro más directo.` });
  }
  if (grupos.madrugada.length) {
    const t = suma(grupos.madrugada) / meses;
    acciones.push({ icono: 'i-alerta', c: '#6250d6', titulo: 'Cuida lo de la madrugada', ahorro: t * 0.5,
      texto: `Entre 12 y 6 a. m. se van ${fmt(t)} al mes (${esc(agrupar(grupos.madrugada, 'g').slice(0, 2).map((x) => x.movs[0].nombre).join(', '))}). Salir con un monto fijo en efectivo y dejar las tarjetas en casa suele cortarlo a la mitad.` });
  }
  if (grupos.hormiga.length) {
    const t = suma(grupos.hormiga) / meses;
    const top = agrupar(grupos.hormiga, 'g').sort((a, b) => b.n - a.n)[0];
    acciones.push({ icono: 'c-super', c: CATS.super.c, titulo: 'Junta los gastos hormiga', ahorro: t * 0.4,
      texto: `${Math.round(grupos.hormiga.length / meses)} compras chicas al mes suman ${fmt(t)}. La que más se repite: ${esc(top.movs[0].nombre)} (${vecesTxt(top.n / meses)} al mes). Comprar por paquete en el súper rinde más.` });
  }
  // Sólo hábitos: lo que se repite (3+ veces y al menos una vez al mes); un vuelo no es un hábito
  const topGustos = Object.entries(grupos.gustos).map(([k, ms]) => ({ k, ms, t: suma(ms) / meses }))
    .filter((x) => x.ms.length >= 3 && x.ms.length / meses >= 1).sort((a, b) => b.t - a.t).slice(0, 3);
  for (const x of topGustos) {
    const [cat, sub] = x.k.split('|');
    const visitas = x.ms.length / meses;
    acciones.push({ icono: 'c-' + cat, c: CATS[cat].c, titulo: `Baja una cuarta parte en ${sub || CATS[cat].n.toLowerCase()}`, ahorro: x.t * 0.25,
      texto: `Gastas ${fmt(x.t)} al mes en ${vecesTxt(visitas)} (ticket de ${fmt(x.t / visitas)}). Si en lugar de ${vecesTxt(visitas)} fueran ${vecesTxt(visitas * 0.75)}, ahorras ${fmt(x.t * 0.25)}.` });
  }
  acciones.sort((a, b) => b.ahorro - a.ahorro);
  const totalAhorro = acciones.reduce((a, x) => a + x.ahorro, 0);
  const recurrentes = pagosRecurrentes();

  // Ahorro real por mes (ingreso estimado − gasto)
  let ahorroReal = '';
  if (+E.aj.pago_monto) {
    const mesK = mesDe(iso(hoy()));
    const meta = ingresoMensual() * (+E.aj.meta_ahorro || 0) / 100;
    const filas = [];
    for (let i = 6; i >= 1; i--) { const k = mesMas(mesK, -i); filas.push({ k, v: ingresoMensual() - suma(gastos(k + '-01', mesMas(k, 1) + '-01')) }); }
    const prom = filas.reduce((a, f) => a + f.v, 0) / filas.length;
    ahorroReal = `<div class="seccion"><h2>Lo que de verdad ahorras</h2></div>
      <div class="tarjeta"><div class="texto-2 peq">Lo que ganas al mes (${fmt(ingresoMensual())}) menos lo que gastas</div>
      <div class="barras-signo">${filas.map((f) => {
        const max = Math.max(...filas.map((x) => Math.abs(x.v)), 1);
        return `<div class="fila-signo" data-tip="${esc(`<b>${cap(fMes(f.k))}</b> · ${f.v >= 0 ? 'ahorraste' : 'faltaron'} ${fmt(Math.abs(f.v))}`)}"><span>${esc(cap(MESES[fecha(f.k + '-01').getMonth()]))}</span>
          <span class="pista-signo"><i class="${f.v >= 0 ? 'pos' : 'neg'}" style="width:${((Math.abs(f.v) / max) * 50).toFixed(1)}%"></i></span>
          <b class="num ${f.v >= 0 ? 'baja' : 'sube'}">${f.v >= 0 ? '' : '−'}${fmt(Math.abs(f.v))}</b></div>`;
      }).join('')}</div>
      <p class="peq texto-2" style="margin:10px 0 0">${prom >= meta ? `En promedio ahorras ${fmt(prom)} al mes: cumples tu meta de ${fmt(meta)}.` : prom >= 0 ? `En promedio ahorras ${fmt(prom)} al mes; tu meta es ${fmt(meta)}. Te faltan ${fmt(meta - prom)}.` : `En promedio gastas ${fmt(-prom)} más de lo que ganas al mes. Revisa también tus transferencias: si alguna es entre tus cuentas, márcala.`}</p></div>`;
  }

  return `
  <section class="tarjeta heroe" style="margin-top:14px">
    <div class="etiqueta">${ic('i-chispa')}Podrías ahorrar</div>
    <div class="cifra num">${fmt(totalAhorro)}<small> al mes</small></div>
    <div class="detalle">${fmt(totalAhorro * 12)} al año con ${acciones.length} cambios, sin tocar lo necesario.</div>
    <div class="partes" role="img" aria-label="Necesario ${fmt(nec / meses)}, gustos ${fmt(gus / meses)}, sin clasificar ${fmt(otros / meses)} al mes">
      <i class="p-nec" style="flex:${nec}"></i><i class="p-gus" style="flex:${gus}"></i><i class="p-otr" style="flex:${otros}"></i></div>
    <div class="leyenda" style="margin-top:8px"><span><i class="p-nec"></i>Necesario ${fmt(nec / meses)}/mes</span><span><i class="p-gus"></i>Gustos ${fmt(gus / meses)}/mes</span>${otros ? `<span><i class="p-otr"></i>Transferencias y otros ${fmt(otros / meses)}/mes</span>` : ''}</div>
  </section>
  <div class="rejilla">
    <div>
      <div class="seccion"><h2>Qué hacer</h2><span class="texto-3 peq">de mayor a menor ahorro</span></div>
      ${acciones.map((a, i) => `<div class="tarjeta accion"><span class="cat-ic" style="--c:${a.c}">${ic(a.icono)}</span>
        <div><div class="arriba"><b>${i + 1}. ${esc(a.titulo)}</b><span class="monto num baja">+${fmt(a.ahorro)}<small>/mes</small></span></div>
        <div class="texto-2 peq">${a.texto}</div></div></div>`).join('') || `<div class="tarjeta">${vacio('i-check', '¡Vas muy bien!', 'No vemos gastos evitables grandes en este periodo.')}</div>`}
    </div>
    <div>
      ${ahorroReal}
      ${recurrentes.length ? `<div class="seccion"><h2>Revisa lo que pagas cada mes</h2><span class="texto-3 peq">${fmt(recurrentes.reduce((a, r) => a + r.prom, 0))}/mes</span></div>
      <div class="tarjeta plana">${recurrentes.map((r) => `<button class="fila" data-acc="verComercio" data-g="${esc(r.g)}">
          <span class="cat-ic" style="--c:${(CATS[r.cat] || CATS.otros).c}">${ic('c-' + r.cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(r.nombre)}</span><span class="t2">${r.meses} de los últimos 4 meses · ¿lo sigues usando?</span></span>
          <span class="monto num">${fmt(r.prom)}<small>al mes</small></span></button>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

/* Línea acumulada (SVG). series: [{nombre, clase, pts:[[x,y]], etiquetaFinal}] */
function graficaLinea(series, { maxX, alto = 200 } = {}) {
  const W = 360; const H = Math.round(alto * 0.62); const top = 16; const bot = 20; const izq = 30; const der = 34;
  const maxY = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p[1])));
  const paso = niceStep(maxY); const tope = Math.ceil(maxY / paso) * paso;
  const x = (d) => izq + ((W - izq - der) * (d - 1)) / Math.max(1, maxX - 1);
  const y = (v) => top + (H - top - bot) * (1 - v / tope);
  let s = `<svg class="lienzo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto acumulado por día">`;
  for (let v = 0; v <= tope + 1e-6; v += paso) s += `<line class="rej" x1="${izq}" x2="${W - der}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="eje" x="0" y="${(y(v) + 4).toFixed(1)}">${fmtK(v)}</text>`;
  for (const d of [1, 8, 15, 22, maxX]) s += `<text class="eje" x="${x(d).toFixed(1)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
  for (const se of series) {
    if (!se.pts.length) continue;
    s += `<polyline class="linea ${se.clase}" points="${se.pts.map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`;
    if (se.etiquetaFinal) {
      const [d, v] = se.pts[se.pts.length - 1];
      s += `<circle class="punto ${se.clase}" cx="${x(d).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4"/><text class="valor-col" x="${(x(d) + 6).toFixed(1)}" y="${(y(v) - 6).toFixed(1)}">${fmtK(v)}</text>`;
    }
  }
  const act = series.find((z) => z.etiquetaFinal);
  const prev = series.find((z) => z.clase === 'l-prev');
  for (let d = 1; d <= maxX; d++) {
    const a = act && act.pts[d - 1]; const p = prev && prev.pts[d - 1];
    if (!a && !p) continue;
    s += `<rect class="zona" x="${(x(d) - (W - izq - der) / maxX / 2).toFixed(1)}" y="0" width="${((W - izq - der) / maxX).toFixed(1)}" height="${H}" data-tip="${esc(`<b>Día ${d}</b>${a ? ` · llevas ${fmt(a[1])}` : ''}${p ? ` · el mes pasado ${fmt(p[1])}` : ''}`)}"/>`;
  }
  return `<div class="grafica">${s}</svg></div>`;
}

/* ── Gráfica de columnas (SVG) ──────────────────────────────────────────── */
function graficaColumnas(datos, { prom = 0, alto = 180, sinValores = false } = {}) {
  const W = 360; const H = Math.round(alto * 0.62); const top = 18; const bot = 20; const izq = 30;
  const max = Math.max(prom, ...datos.map((d) => d.v), 1);
  const paso = niceStep(max);
  const tope = Math.ceil(max / paso) * paso;
  const y = (v) => top + (H - top - bot) * (1 - v / tope);
  const banda = (W - izq) / datos.length;
  const ancho = Math.min(24, banda * 0.62);
  const iMax = datos.reduce((bi, d, i) => (d.v > datos[bi].v ? i : bi), 0);
  const iUlt = datos.length - 1;
  let s = `<svg class="lienzo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de columnas">`;
  for (let v = 0; v <= tope + 1e-6; v += paso) {
    s += `<line class="rej" x1="${izq}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
    s += `<text class="eje" x="0" y="${(y(v) + 4).toFixed(1)}">${fmtK(v)}</text>`;
  }
  datos.forEach((d, i) => {
    const cx = izq + banda * i + banda / 2;
    const x = cx - ancho / 2;
    const h = Math.max(0, H - bot - y(d.v));
    if (h > 0) {
      const r = Math.min(4, h);
      s += `<path class="col ${d.actual ? 'actual' : ''}" data-col="${i}" d="M${x},${H - bot} V${H - bot - h + r} Q${x},${H - bot - h} ${x + r},${H - bot - h} H${x + ancho - r} Q${x + ancho},${H - bot - h} ${x + ancho},${H - bot - h + r} V${H - bot} Z"/>`;
    }
    s += `<text class="eje" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(d.et)}</text>`;
    if (!sinValores && (i === iMax || i === iUlt) && d.v > 0) s += `<text class="valor-col" x="${cx}" y="${(H - bot - h - 6).toFixed(1)}" text-anchor="middle">${fmtK(d.v)}</text>`;
    s += `<rect class="zona" x="${izq + banda * i}" y="0" width="${banda}" height="${H}" data-tip="${esc(`<b>${esc(d.tip || d.et)}</b> · ${fmt(d.v)}`)}" data-colsel="${i}"/>`;
  });
  if (prom) s += `<line class="prom" x1="${izq}" x2="${W}" y1="${y(prom).toFixed(1)}" y2="${y(prom).toFixed(1)}"/>`;
  return `<div class="grafica">${s}</svg></div>`;
}
function niceStep(max) {
  const bruto = max / 3;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function tablaDatos(filas, cab) {
  return `<details class="tabla"><summary>Ver como tabla</summary><table><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></details>`;
}

/* Información al tocar o pasar por encima de una columna */
function mostrarTip(el, x, y) {
  const t = $('#tip');
  t.innerHTML = el.dataset.tip;
  t.style.left = Math.max(70, Math.min(innerWidth - 70, x)) + 'px';
  t.style.top = y + 'px';
  t.hidden = false;
  const svg = el.closest('svg');
  if (!svg) return;
  svg.querySelectorAll('.col.sel').forEach((c) => c.classList.remove('sel'));
  const col = svg.querySelector(`[data-col="${el.dataset.colsel}"]`);
  if (col) col.classList.add('sel');
}
function ocultarTip() {
  const t = $('#tip'); if (t) t.hidden = true;
  document.querySelectorAll('.col.sel').forEach((c) => c.classList.remove('sel'));
}
document.addEventListener('pointerover', (e) => {
  const z = e.target.closest && e.target.closest('[data-tip]');
  if (z) { const r = z.getBoundingClientRect(); mostrarTip(z, r.left + r.width / 2, r.top + 30); }
});
document.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('[data-tip]')) ocultarTip(); });
addEventListener('scroll', ocultarTip, { passive: true });

/* ── Ajustes ────────────────────────────────────────────────────────────── */
function vistaAjustes() {
  const aj = E.aj;
  const frec = { catorcenal: 'Cada 14 días', quincenal: 'Cada quincena', mensual: 'Cada mes' }[aj.frecuencia];
  const nReglas = Object.keys(aj.reglas).length;
  const nPres = Object.values(aj.presupuestos).filter((v) => +v > 0).length;
  const primero = E.datos.movs.length ? E.datos.movs[E.datos.movs.length - 1].f : null;
  const item = (acc, icono, t, valor) => `<button class="item" data-acc="${acc}">${ic(icono)}<span class="cuerpo">${t}</span><span class="valor">${valor || ''}</span>${ic('i-der')}</button>`;
  return `
  <header class="encabezado"><div><h1>Ajustes</h1><div class="sub">Todo se guarda solo</div></div></header>
  <div class="rejilla"><div>
  <div class="seccion"><h2>Tu dinero</h2></div>
  <div class="tarjeta plana lista-aj">
    ${item('editarPago', 'i-cartera', 'Lo que recibes por pago', `<span class="num">${fmt(aj.pago_monto)}</span>`)}
    ${item('editarPago', 'i-calendario', 'Cada cuándo te pagan', frec)}
    ${item('editarPago', 'i-chispa', 'Meta de ahorro', `${+aj.meta_ahorro || 0} %`)}
    ${item('editarPresupuestos', 'i-grafica', 'Límites por categoría', nPres ? `${nPres} activos` : 'Ninguno')}
  </div>
  <div class="seccion"><h2>Categorías y tarjetas</h2></div>
  <div class="tarjeta plana lista-aj">
    ${item('editarTarjetas', 'i-tarjeta', 'Tus tarjetas y cuentas', `${E.tarjetasVistas.length}`)}
    ${item('editarReglas', 'i-regla', 'Tus correcciones', `${nReglas}`)}
    ${item('revisar', 'i-chispa', 'Revisar lo que clasificó la IA', `${gruposPorRevisar().length}`)}
  </div>
  <p class="texto-3 peq" style="margin:8px 4px 0">La IA clasifica sola cada comercio nuevo. Las tarjetas aparecen solas con su primer correo; aquí sólo les pones nombre.</p>
  </div><div>
  <div class="seccion"><h2>Tu Gmail</h2></div>
  <div class="tarjeta plana lista-aj">
    <div class="item">${ic('i-actualizar')}<span class="cuerpo">${esc(E.usuario.email || '')}<div class="texto-3 peq">${E.perfil.gmail_conectado ? `${E.datos.movs.length.toLocaleString('es-MX')} movimientos${primero ? ` desde ${esc(fMes(mesDe(primero)))}` : ''} · ${E.datos.generado ? esc(haceCuanto(E.datos.generado)) : 'sin leer aún'}` : 'Gmail sin conectar'}</div></span></div>
    ${E.perfil.gmail_conectado ? item('sincronizar', 'i-actualizar', 'Actualizar ahora', 'sola cada hora') : item('conectarGmail', 'i-candado', 'Conectar Gmail', '')}
  </div>
  <div class="seccion"><h2>Cuenta</h2></div>
  <div class="tarjeta plana lista-aj">
    ${item('invitar', 'i-sube', 'Invitar a alguien', '')}
    ${item('exportar', 'i-descargar', 'Descargar en Excel (CSV)', '')}
    ${item('editarTema', 'i-ajustes', 'Apariencia', { auto: 'Automática', claro: 'Clara', oscuro: 'Oscura' }[aj.tema])}
    <button class="item" data-acc="cerrarSesion">${ic('i-candado')}<span class="cuerpo">Cerrar sesión</span></button>
    <button class="item" data-acc="borrarCuenta">${ic('i-papelera')}<span class="cuerpo" style="color:var(--critico)">Borrar mi cuenta y mis datos</span></button>
  </div>
  <p class="texto-3 peq centro" style="margin-top:22px">Mis Finanzas ${VERSION} · cada cuenta sólo ve sus propios movimientos. <a href="privacy.html" style="color:inherit">Privacidad</a></p>
  </div></div>`;
}

/* ── Hoja inferior ──────────────────────────────────────────────────────── */
let alCerrarHoja = null;
function abrirHoja(html, alCerrar) {
  const h = $('#hoja');
  h.innerHTML = `<div class="asa"></div>${html}`;
  h.hidden = false; $('#capa').hidden = false;
  document.body.style.overflow = 'hidden';
  alCerrarHoja = alCerrar || null;
  ocultarTip();
}
function cerrarHoja() {
  $('#hoja').hidden = true; $('#capa').hidden = true;
  document.body.style.overflow = '';
  const f = alCerrarHoja; alCerrarHoja = null;
  if (f) f();
}
$('#capa').addEventListener('click', cerrarHoja);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#hoja').hidden) cerrarHoja(); });
const cabHoja = (t) => `<div class="cab"><h3>${esc(t)}</h3><button class="icono-btn" data-acc="cerrar" aria-label="Cerrar">${ic('i-x')}</button></div>`;

function rejillaCats(lista, actual, acc, extra = '') {
  return `<div class="cats">${lista.map((c) => `<button class="${c === actual ? 'on' : ''}" style="--c:${CATS[c].c}" data-acc="${acc}" data-cat="${c}" ${extra}>
    <span class="cat-ic" style="--c:${CATS[c].c}">${ic('c-' + c)}</span>${esc(CATS[c].n)}</button>`).join('')}</div>`;
}

/* Detalle de un movimiento */
function hojaDetalle(id) {
  const m = E.movs.find((x) => x.id === id);
  if (!m) return;
  const cat = CATS[m.cat] || CATS.otros;
  const iguales = E.movs.filter((x) => x.k === m.k).length;
  const lista = m.tipo === 'deposito' ? CATS_INGRESO : CATS_GASTO;
  const todos = E.hojaTodos !== false;
  const tipoTxt = { compra: 'Compra', transferencia: 'Transferencia', deposito: 'Depósito', retiro: 'Retiro' }[m.tipo] || '';
  abrirHoja(`${cabHoja(tipoTxt + (m.manual ? ' a mano' : ''))}
    <div class="grande">
      <div class="cat-ic" style="--c:${cat.c}">${ic('c-' + m.cat)}</div>
      <div class="m num">${m.tipo === 'deposito' ? '+' : ''}${fmt2(m.m)}</div>
      <div class="n">${esc(m.nombre)}</div>
      <div class="d">${esc(fDiaLargo(m.f))}${m.h ? ` · ${m.h}` : ''}${m.tj ? ` · ${esc(nombreTarjeta(m.tj))}` : ''}</div>
      ${m.extra && m.extra.concepto ? `<div class="d">Concepto: ${esc(m.extra.concepto)}</div>` : ''}
      <div class="origen">${etiquetaOrigen(m)}</div>
    </div>
    <h4>Categoría</h4>
    ${rejillaCats(lista, m.cat, 'ponerCat', `data-id="${esc(m.id)}"`)}
    ${iguales > 1 ? `<button class="interruptor" data-acc="alternarTodos" data-id="${esc(m.id)}">
      <span><b>Aplicar a los ${iguales} de ${esc(m.nombre)}</b><small>Y a los que lleguen después</small></span>
      <span class="sw ${todos ? 'on' : ''}"></span></button>` : ''}
    <h4>Nombre y nota</h4>
    <label class="campo"><span>Nombre para «${esc(bonito(m.k.slice(2)) || m.nombre)}»</span>
      <input id="nombreCom" value="${esc(E.aj.nombres[m.k] || '')}" placeholder="${esc(m.nombre)}" autocomplete="off"></label>
    <label class="campo"><span>Nota de este movimiento</span>
      <input id="notaMov" value="${esc(m.nota)}" placeholder="Ej. cena con amigos" autocomplete="off"></label>
    <div class="texto-3 peq" style="margin:6px 2px 14px;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all">${esc(m.c)}</div>
    <div class="dos">
      <button class="btn" data-acc="verComercio" data-g="${esc(m.g)}">Ver todos</button>
      ${m.manual ? `<button class="btn peligro" data-acc="borrarManual" data-id="${esc(m.id)}">${ic('i-papelera')}Borrar</button>` : '<button class="btn primario" data-acc="cerrar">Listo</button>'}
    </div>`, () => guardarTextosDetalle(m));
}

function guardarTextosDetalle(m) {
  const n = $('#nombreCom'); const t = $('#notaMov');
  if (!n || !t) return;
  const nombre = n.value.trim(); const nota = t.value.trim();
  let cambio = false;
  if (nombre !== (E.aj.nombres[m.k] || '')) { if (nombre) E.aj.nombres[m.k] = nombre; else delete E.aj.nombres[m.k]; cambio = true; }
  if (nota !== (m.nota || '')) {
    const c = E.aj.cambios[m.id] || {};
    if (nota) c.nota = nota; else delete c.nota;
    if (Object.keys(c).length) E.aj.cambios[m.id] = c; else delete E.aj.cambios[m.id];
    cambio = true;
  }
  if (cambio) { guardarAjustes(); repintar(); }
}

function ponerCategoria(id, cat) {
  const m = E.movs.find((x) => x.id === id);
  if (!m) return;
  const antes = JSON.stringify(E.aj);
  const todos = E.hojaTodos !== false && E.movs.filter((x) => x.k === m.k).length > 1;
  if (todos) {
    E.aj.reglas[m.k] = cat;
    E.aj.revisados[m.k] = 1;
    for (const x of E.movs) if (x.k === m.k && E.aj.cambios[x.id]) { delete E.aj.cambios[x.id].cat; if (!Object.keys(E.aj.cambios[x.id]).length) delete E.aj.cambios[x.id]; }
  } else {
    E.aj.cambios[id] = { ...(E.aj.cambios[id] || {}), cat };
  }
  guardarTextosDetalle(m);
  guardarAjustes();
  preparar();
  const n = todos ? E.movs.filter((x) => x.k === m.k).length : 1;
  cerrarHojaSinGuardar();
  repintar();
  avisar(`${n > 1 ? `${n} movimientos` : 'Movimiento'} → ${CATS[cat].n}`, () => { E.aj = JSON.parse(antes); guardarAjustes(); preparar(); repintar(); });
}
function cerrarHojaSinGuardar() { alCerrarHoja = null; cerrarHoja(); }

/* Revisar lo que clasificó la IA: lo nuevo desde la última revisión y lo dudoso. Todo es opcional. */
function gruposPorRevisar() {
  const desde = E.aj.revisado_en || 0;
  const g = new Map();
  for (const m of E.movs) {
    if (m.tipo !== 'compra' || m.origen === 'tu' || E.aj.revisados[m.k]) continue;
    const d = E.dicc[m.k];
    const nuevo = d && Date.parse(d.creado) > desde;
    const dudoso = m.conf != null ? m.conf < 0.6 && m.sub !== 'persona' : m.cat === 'otros';
    if (!nuevo && !dudoso) continue;
    const x = g.get(m.k) || { k: m.k, total: 0, n: 0, ultimo: m.f, m, nuevo, dudoso };
    x.total += m.m; x.n += 1;
    g.set(m.k, x);
  }
  return [...g.values()].sort((a, b) => (b.dudoso - a.dudoso) || (b.total - a.total));
}

function etiquetaOrigen(m) {
  if (m.origen === 'tu') return `${ic('i-check')}Lo corregiste tú`;
  if (m.origen === 'auto') return `${ic('c-propias')}Detectado: cuenta a la que mandas y de la que recibes`;
  if (m.origen === 'ia') return `${ic('i-chispa')}Clasificado por IA${m.conf != null ? ` · ${Math.round(m.conf * 100)} % segura` : ''}${m.sub ? ` · ${esc(m.sub)}` : ''}${m.esencial != null ? ` · ${m.esencial ? 'necesario' : 'gusto'}` : ''}`;
  if (m.tipo === 'transferencia') return `${ic('c-transferencias')}Transferencia: sólo tú sabes a quién`;
  return `${ic('i-regla')}Regla automática (la IA lo verá esta noche)`;
}

function hojaRevisar(i = 0) {
  const grupos = gruposPorRevisar();
  if (!grupos.length || i >= grupos.length) {
    E.aj.revisado_en = Date.now(); guardarAjustes();
    abrirHoja(`${cabHoja('Revisar')}${vacio('i-check', '¡Todo revisado!', 'La IA seguirá clasificando sola lo que llegue.')}<button class="btn primario ancho" data-acc="cerrar">Listo</button>`, () => repintar());
    return;
  }
  const x = grupos[i];
  const total = E.revTotal || grupos.length;
  const hechos = Math.min(E.revPos || 0, total - 1);
  abrirHoja(`${cabHoja('Revisar lo nuevo')}
    <div class="progreso"><i style="width:${((hechos / total) * 100).toFixed(1)}%"></i></div>
    <div class="texto-3 peq">${hechos + 1} de ${total} · ${x.dudoso ? 'la IA no está segura' : 'comercio nuevo'}</div>
    <div class="clasif"><div class="comercio">
      <div class="n">${esc(x.m.nombre)}</div>
      <div class="d">${x.n} ${x.n === 1 ? 'compra' : 'compras'} · <span class="num">${fmt(x.total)}</span> · última ${esc(fDia(x.ultimo))}</div>
      <div class="crudo">${esc(x.m.c)}</div>
      <div class="origen">${etiquetaOrigen(x.m)}</div>
    </div></div>
    <button class="btn primario ancho" style="margin:4px 0 14px" data-acc="revBien" data-k="${esc(x.k)}" data-i="${i}">${ic('i-check')}Está bien: ${esc(CATS[x.m.cat].n)}</button>
    <h4>O cámbialo</h4>
    ${rejillaCats(CATS_GASTO.filter((c) => c !== 'transferencias'), x.m.cat, 'revCat', `data-k="${esc(x.k)}" data-i="${i}"`)}
    <div class="dos" style="margin-top:14px"><button class="btn" data-acc="revBienTodo">Todo está bien</button><button class="btn" data-acc="cerrar">Después</button></div>`,
  () => repintar());
}

/* Agregar gasto a mano */
function hojaManual() {
  E.manualTipo = 'compra';
  abrirHoja(`${cabHoja('Agregar movimiento')}
    <div class="seg" style="margin-bottom:14px"><button class="on" data-acc="manualTipo" data-v="compra">Gasto</button><button data-acc="manualTipo" data-v="deposito">Ingreso</button></div>
    <label class="campo"><span>Monto</span><input id="manMonto" inputmode="decimal" placeholder="$0.00" style="font-size:24px;font-weight:650;height:58px" autocomplete="off"></label>
    <label class="campo"><span>¿En qué?</span><input id="manDesc" placeholder="Ej. tacos, propina, gasolina" autocomplete="off"></label>
    <div class="dos"><label class="campo"><span>Fecha</span><input id="manFecha" type="date" value="${iso(hoy())}" max="${iso(hoy())}"></label>
      <label class="campo"><span>Pagaste con</span><select id="manTj"><option value="EFECTIVO">Efectivo</option>${E.tarjetasVistas.filter((t) => t !== 'EFECTIVO').map((t) => `<option value="${esc(t)}">${esc(nombreTarjeta(t))}</option>`).join('')}</select></label></div>
    <div id="manCats"><h4>Categoría</h4>${rejillaCats(CATS_GASTO.filter((c) => !['otros', 'propias', 'transferencias'].includes(c)), 'efectivo', 'manualCat')}</div>
    <button class="btn primario ancho" style="margin-top:18px" data-acc="guardarManual">Guardar</button>`);
  E.manualCat = 'efectivo';
  setTimeout(() => $('#manMonto') && $('#manMonto').focus(), 250);
}

/* Pago e ingreso */
function hojaPago() {
  const aj = E.aj;
  abrirHoja(`${cabHoja('Tu dinero')}
    <label class="campo"><span>Lo que recibes en cada pago</span><input id="ajMonto" inputmode="decimal" value="${aj.pago_monto}" autocomplete="off"></label>
    <label class="campo"><span>Cada cuándo te pagan</span><select id="ajFrec">
      <option value="catorcenal" ${aj.frecuencia === 'catorcenal' ? 'selected' : ''}>Cada 14 días (mismo día de la semana)</option>
      <option value="quincenal" ${aj.frecuencia === 'quincenal' ? 'selected' : ''}>Cada quincena (día 15 y último)</option>
      <option value="mensual" ${aj.frecuencia === 'mensual' ? 'selected' : ''}>Una vez al mes</option></select></label>
    <label class="campo" id="campoRef"><span>Un día en que cobraste</span><input id="ajRef" type="date" value="${esc(aj.pago_ref)}"><div class="ayuda">Cualquier pago pasado sirve; de ahí se cuentan los 14 días.</div></label>
    <label class="campo" id="campoDia"><span>Día del mes en que cobras</span><input id="ajDia" inputmode="numeric" value="${aj.pago_dia || 1}"></label>
    <label class="campo"><span>Meta de ahorro (% de cada pago)</span><input id="ajMeta" inputmode="numeric" value="${+aj.meta_ahorro || 0}"><div class="ayuda">Se aparta antes de calcular cuánto puedes gastar.</div></label>
    <button class="btn primario ancho" data-acc="guardarPago">Guardar</button>`);
  const sync = () => { const v = $('#ajFrec').value; $('#campoRef').hidden = v !== 'catorcenal'; $('#campoDia').hidden = v !== 'mensual'; };
  $('#ajFrec').addEventListener('change', sync); sync();
}

function hojaPresupuestos() {
  const p = E.aj.presupuestos;
  const mesK = mesDe(iso(hoy()));
  const prom = {};
  for (let i = 1; i <= 3; i++) {
    const k = mesMas(mesK, -i);
    for (const x of agrupar(gastos(k + '-01', mesMas(k, 1) + '-01'), 'cat')) prom[x.k] = (prom[x.k] || 0) + x.total / 3;
  }
  abrirHoja(`${cabHoja('Límites por mes')}
    <p class="texto-2 peq" style="margin-top:0">Pon cuánto quieres gastar al mes en cada categoría. Déjalo vacío para no tener límite. Abajo de cada una ves tu promedio de los últimos 3 meses.</p>
    ${CATS_GASTO.filter((c) => c !== 'propias').map((c) => `<label class="campo" style="display:flex;align-items:center;gap:12px">
      <span class="cat-ic chico" style="--c:${CATS[c].c};margin:0">${ic('c-' + c)}</span>
      <span style="flex:1;margin:0;font-size:15px;color:var(--texto)">${esc(CATS[c].n)}<div class="texto-3 peq" style="font-weight:500">promedio ${fmt(prom[c] || 0)}</div></span>
      <input data-pres="${c}" inputmode="numeric" value="${+p[c] || ''}" placeholder="Sin límite" style="width:120px;text-align:right"></label>`).join('')}
    <button class="btn primario ancho" data-acc="guardarPresupuestos">Guardar</button>`);
}

function hojaTarjetas() {
  abrirHoja(`${cabHoja('Tarjetas y cuentas')}
    <p class="texto-2 peq" style="margin-top:0">Ponles un nombre fácil de reconocer.</p>
    ${E.tarjetasVistas.filter((t) => t !== 'EFECTIVO').map((t) => {
      const n = E.movs.filter((m) => m.tj === t).length;
      return `<label class="campo"><span>Terminación ${esc(t)} · ${n} movimientos</span><input data-tj="${esc(t)}" value="${esc(E.aj.tarjetas[t] || '')}" placeholder="•••• ${esc(t)}" autocomplete="off"></label>`;
    }).join('')}
    <button class="btn primario ancho" data-acc="guardarTarjetas">Guardar</button>`);
}

function hojaReglas() {
  const reglas = Object.entries(E.aj.reglas);
  const nombres = Object.fromEntries(E.movs.map((m) => [m.k, m.nombre]));
  abrirHoja(`${cabHoja('Lo que la app aprendió')}
    ${reglas.length ? `<p class="texto-2 peq" style="margin-top:0">Cada vez que llegue un movimiento de estos, va directo a su categoría.</p>
    <div class="tarjeta plana" style="box-shadow:none;background:var(--sup-2)">${reglas.sort((a, b) => (nombres[a[0]] || a[0]).localeCompare(nombres[b[0]] || b[0])).map(([k, c]) => `<div class="fila">
      <span class="cat-ic chico" style="--c:${(CATS[c] || CATS.otros).c}">${ic('c-' + c)}</span>
      <span class="cuerpo"><span class="t1">${esc(nombres[k] || bonito(k.slice(2)))}</span><span class="t2">${esc((CATS[c] || CATS.otros).n)}</span></span>
      <button class="icono-btn" style="box-shadow:none;background:none" data-acc="borrarRegla" data-k="${esc(k)}" aria-label="Olvidar">${ic('i-papelera')}</button></div>`).join('')}</div>`
    : vacio('i-regla', 'Aún no hay reglas', 'Cuando cambies la categoría de un comercio, aparecerá aquí.')}`);
}

function hojaTema() {
  abrirHoja(`${cabHoja('Apariencia')}
    <div class="seg">${[['auto', 'Automática'], ['claro', 'Clara'], ['oscuro', 'Oscura']].map(([v, n]) => `<button class="${E.aj.tema === v ? 'on' : ''}" data-acc="ponerTema" data-v="${v}">${n}</button>`).join('')}</div>
    <div style="height:10px"></div>`);
}

/* ── Sincronizar (lee tus correos en tandas hasta terminar) ─────────────── */
async function sincronizarAhora(primeraVez) {
  if (E.sincronizando) return;
  if (!E.perfil.gmail_conectado) { hojaConectarGmail(); return; }
  E.sincronizando = true;
  E.progreso = { hechos: 0, total: 0 };
  repintar();
  const antes = E.datos.movs.length;
  try {
    for (let i = 0; i < 80; i++) {
      const r = await llamar('sincronizar');
      if (r.error === 'reconectar') { E.perfil.gmail_conectado = false; throw new Error('Google pidió volver a dar permiso a tu Gmail.'); }
      E.progreso.hechos += r.revisados || 0;
      E.progreso.total = Math.max(E.progreso.total, E.progreso.hechos + (r.pendientes || 0));
      pintarProgreso();
      if (!r.pendientes) break;
    }
    // Bonche listo: la IA clasifica junto todo comercio que aún no está en el diccionario
    E.progreso.fase = 'ia';
    for (let i = 0; i < 12; i++) {
      const c = await llamar('sincronizar', { accion: 'clasificar' });
      E.progreso.ia = (E.progreso.ia || 0) + (c.clasificados || 0);
      pintarProgreso();
      if (!c.restantes || !c.clasificados) break;
    }
    await cargarTodo();
    const nuevos = E.datos.movs.length - antes;
    avisar(primeraVez && nuevos > 0 ? `Listo: ${nuevos.toLocaleString('es-MX')} movimientos` : nuevos > 0 ? `${nuevos} ${nuevos === 1 ? 'movimiento nuevo' : 'movimientos nuevos'}` : 'Ya estabas al día');
  } catch (e) {
    avisar(e.message || 'No se pudo actualizar.');
  } finally {
    E.sincronizando = false; E.progreso = null; repintar();
  }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function tarjetaProgreso() {
  const p = E.progreso;
  if (!p) return '';
  const pct = p.total ? Math.min(100, (p.hechos / p.total) * 100) : 4;
  return `<section class="tarjeta" id="progreso" style="margin-bottom:12px">
    <div class="etiqueta texto-2" style="font-weight:600;display:flex;gap:8px;align-items:center">${ic('i-actualizar', 'class="gira"')}${p.fase === 'ia' ? `La IA está clasificando los comercios nuevos…${p.ia ? ` (${p.ia})` : ''}` : 'Leyendo tus correos de Santander…'}</div>
    <div class="medidor"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="medidor-pie"><span>${p.total ? `${p.hechos.toLocaleString('es-MX')} de ${p.total.toLocaleString('es-MX')}` : 'Buscando correos'}</span><span>la IA clasifica cada comercio</span></div>
  </section>`;
}
function pintarProgreso() {
  const el = $('#progreso');
  if (el) el.outerHTML = tarjetaProgreso();
}

function hojaConectarGmail() {
  abrirHoja(`${cabHoja('Conecta tu Gmail')}
    <p class="texto-2" style="margin-top:0">Mis Finanzas lee <b>sólo</b> los avisos de Santander (compras, transferencias, depósitos y retiros). Nunca envía ni borra correos.</p>
    <p class="texto-3 peq">Google mostrará «Google no verificó esta app»: toca <b>Configuración avanzada</b> → <b>Ir a Mis Finanzas</b> y marca el permiso de Gmail.</p>
    <button class="btn primario ancho" data-acc="entrarGoogle">Conectar con Google</button>`);
}

function hojaInvitar() {
  abrirHoja(`${cabHoja('Invitar a alguien')}
    <p class="texto-2" style="margin-top:0">Cualquiera con cuenta de Gmail que reciba avisos de Santander puede usarla. Cada quien entra con su Google y sólo ve sus propios movimientos.</p>
    <div class="campo"><input readonly value="${esc(URL_APP)}"></div>
    <div class="dos"><button class="btn" data-acc="copiarEnlace">Copiar enlace</button><button class="btn primario" data-acc="compartirEnlace">Compartir</button></div>`);
}

/* ── Guardar ajustes (en este dispositivo y en tu cuenta) ───────────────── */
function guardarAjustes() {
  E.aj.actualizado = Date.now();
  guardar('mf_aj', JSON.stringify(E.aj));
  programarSubida();
}
function programarSubida() {
  clearTimeout(E.subiendo);
  E.subiendo = setTimeout(async () => {
    const { error } = await sb.from('perfiles').update({ ajustes: E.aj }).eq('user_id', E.usuario.id);
    if (error) avisar('No se guardaron tus ajustes en la nube; siguen en este dispositivo.');
  }, 1200);
}

/* ── Aviso flotante ─────────────────────────────────────────────────────── */
let avisoT = null;
function avisar(texto, deshacer, ms = 4000) {
  const a = $('#aviso');
  a.innerHTML = `<span>${esc(texto)}</span>${deshacer ? '<button data-acc="deshacer">Deshacer</button>' : ''}`;
  a.hidden = false;
  E.deshacer = deshacer || null;
  clearTimeout(avisoT);
  avisoT = setTimeout(() => { a.hidden = true; }, ms);
}

/* ── Pantallas especiales ───────────────────────────────────────────────── */
function pintarEsqueleto() {
  $('#app').innerHTML = `<div style="height:70px"></div><div class="esq" style="height:190px"></div>
    <div class="mosaicos"><div class="esq" style="height:96px"></div><div class="esq" style="height:96px"></div></div>
    <div class="esq" style="height:300px;margin-top:24px"></div>`;
}
function pantallaBloqueo(error) {
  $('#barra').hidden = true; $('#fab').hidden = true;
  $('#app').classList.add('sin-barra');
  $('#app').innerHTML = `<div class="bloqueo">
    <img class="logo" src="icono.svg" alt="">
    <h1>Mis Finanzas</h1>
    <p>Ve en qué se va tu dinero sin capturar nada: la app lee los avisos de Santander que llegan a tu Gmail y una IA clasifica cada gasto.</p>
    <ol class="pasos">
      <li><span>Entra con tu cuenta de Google <b>una sola vez</b>; queda guardada.</span></li>
      <li><span>Da permiso de <b>sólo lectura</b> a tu Gmail. Nunca envía ni borra correos.</span></li>
      <li><span>Google dirá «no verificó esta app»: toca <b>Configuración avanzada → Ir a Mis Finanzas</b>.</span></li>
    </ol>
    ${error ? `<p style="color:var(--critico);margin:-4px 0 14px">${esc(error)}</p>` : ''}
    <button class="btn primario ancho" data-acc="entrarGoogle">${ICONO_G}Entrar con Google</button>
    <p class="texto-3 peq centro" style="margin-top:14px">Cada cuenta sólo ve sus propios movimientos. <a href="privacy.html" style="color:inherit">Privacidad</a></p>
  </div>`;
}
const ICONO_G = '<svg viewBox="0 0 48 48" style="width:20px;height:20px;stroke:none"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function pintarCargando(texto) {
  $('#app').classList.add('sin-barra');
  $('#app').innerHTML = `<div class="bloqueo centro"><img class="logo" src="icono.svg" alt="" style="margin:0 auto 18px"><p>${esc(texto)}</p></div>`;
}
function pantallaError(e) {
  $('#app').innerHTML = `<div class="bloqueo">${vacio('i-alerta', 'No se pudieron cargar tus datos', e.message || 'Revisa tu conexión.')}
    <button class="btn primario ancho" data-acc="recargar">Reintentar</button></div>`;
}

function aplicarTema(t) {
  const r = document.documentElement;
  if (t === 'claro') r.dataset.theme = 'light';
  else if (t === 'oscuro') r.dataset.theme = 'dark';
  else delete r.dataset.theme;
}

function exportarCSV() {
  const filas = [['Fecha', 'Hora', 'Tipo', 'Comercio', 'Categoría', 'Monto', 'Tarjeta', 'Nota', 'Texto original']];
  for (const m of E.movs) filas.push([m.f, m.h || '', m.tipo, m.nombre, (CATS[m.cat] || CATS.otros).n, (m.tipo === 'deposito' ? m.m : -m.m).toFixed(2), nombreTarjeta(m.tj), m.nota || '', m.c]);
  const csv = '﻿' + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `mis-finanzas-${iso(hoy())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ── Acciones (delegación de clics) ─────────────────────────────────────── */
const ACC = {
  cerrar: () => cerrarHoja(),
  recargar: () => location.reload(),
  noInstalar: () => { guardar('mf_no_instalar', '1'); repintar(); },
  sincronizar: () => { cerrarHojaSinGuardar(); sincronizarAhora(); },
  periodoInicio: (d) => { E.periodoInicio = d.v; repintar(); },
  detalle: (d) => { E.hojaTodos = true; hojaDetalle(d.id); },
  alternarTodos: (d, b) => { E.hojaTodos = !(E.hojaTodos !== false); b.querySelector('.sw').classList.toggle('on', E.hojaTodos); },
  ponerCat: (d) => ponerCategoria(d.id, d.cat),
  verCategoria: (d) => { Object.assign(E.f, { cat: d.cat, tj: null, k: null, g: null, q: '', tipo: d.cat === 'ingreso' ? 'ingresos' : 'gastos', desde: d.desde, hasta: d.hasta, limite: 120 }); ir('movimientos'); },
  verComercio: (d) => { cerrarHojaSinGuardar(); Object.assign(E.f, { k: d.k || null, g: d.g || null, cat: null, tj: null, q: '', tipo: 'todo', desde: null, hasta: null, todo: true, limite: 120 }); ir('movimientos'); },
  verTarjeta: (d) => { const R = rangoAnalisis(); Object.assign(E.f, { tj: d.tj, cat: null, k: null, g: null, q: '', tipo: 'gastos', desde: R.desde, hasta: R.hasta, limite: 120 }); ir('movimientos'); },
  quitarFiltroExtra: () => { Object.assign(E.f, { k: null, g: null, desde: null, hasta: null, todo: false }); repintar(); },
  tipoMov: (d) => { E.f.tipo = d.v; E.f.cat = null; E.f.limite = 120; repintar(); },
  catMov: (d) => { E.f.cat = d.v || null; E.f.limite = 120; repintar(); },
  tjMov: (d) => { E.f.tj = d.v || null; E.f.limite = 120; repintar(); },
  mesMov: (d) => { E.f.mes = mesMas(E.f.mes, +d.d); E.f.limite = 120; repintar(); },
  todoMov: () => { E.f.todo = !E.f.todo; E.f.limite = 120; repintar(); },
  masMovs: () => { E.f.limite += 200; repintar(); },
  limpiarQ: () => { E.f.q = ''; repintar(); },
  pestanaAn: (d) => { E.an.vista = d.v; if ((d.v === 'habitos' || d.v === 'ahorro') && E.an.rango === 'todo') E.an.rango = '6m'; repintar(); },
  mesDia: (d) => { E.an.mesDia = mesMas(E.an.mesDia || mesDe(iso(hoy())), +d.d); repintar(); },
  verDia: (d) => hojaDia(d.f),
  rango: (d) => { E.an.rango = d.v; if (d.v === 'mes') E.an.mes = mesDe(iso(hoy())); repintar(); },
  mesAn: (d) => { E.an.mes = mesMas(E.an.mes || mesDe(iso(hoy())), +d.d); repintar(); },
  revisar: () => { E.revTotal = Math.max(1, gruposPorRevisar().length); E.revPos = 0; hojaRevisar(0); },
  revBien: (d) => { E.aj.revisados[d.k] = 1; guardarAjustes(); E.revPos = (E.revPos || 0) + 1; hojaRevisar(+d.i); },
  revCat: (d) => { E.aj.reglas[d.k] = d.cat; E.aj.revisados[d.k] = 1; guardarAjustes(); preparar(); E.revPos = (E.revPos || 0) + 1; hojaRevisar(+d.i); },
  revBienTodo: () => { for (const x of gruposPorRevisar()) E.aj.revisados[x.k] = 1; E.aj.revisado_en = Date.now(); guardarAjustes(); cerrarHoja(); avisar('Listo, todo revisado'); },
  editarPago: hojaPago,
  guardarPago: () => {
    const n = (s) => parseFloat(String(s).replace(/[$,\s]/g, '')) || 0;
    Object.assign(E.aj, { pago_monto: n($('#ajMonto').value), frecuencia: $('#ajFrec').value, pago_ref: $('#ajRef').value || E.aj.pago_ref, pago_dia: Math.min(28, Math.max(1, n($('#ajDia').value) || 1)), meta_ahorro: Math.min(90, Math.max(0, n($('#ajMeta').value))) });
    guardarAjustes(); cerrarHoja(); repintar(); avisar('Guardado');
  },
  editarPresupuestos: hojaPresupuestos,
  guardarPresupuestos: () => {
    document.querySelectorAll('[data-pres]').forEach((i) => { const v = parseFloat(i.value.replace(/[$,\s]/g, '')); if (v > 0) E.aj.presupuestos[i.dataset.pres] = v; else delete E.aj.presupuestos[i.dataset.pres]; });
    guardarAjustes(); cerrarHoja(); repintar(); avisar('Límites guardados');
  },
  editarTarjetas: hojaTarjetas,
  guardarTarjetas: () => {
    document.querySelectorAll('[data-tj]').forEach((i) => { const v = i.value.trim(); if (v) E.aj.tarjetas[i.dataset.tj] = v; else delete E.aj.tarjetas[i.dataset.tj]; });
    guardarAjustes(); cerrarHoja(); repintar(); avisar('Nombres guardados');
  },
  editarReglas: hojaReglas,
  borrarRegla: (d) => { delete E.aj.reglas[d.k]; delete E.aj.revisados[d.k]; guardarAjustes(); preparar(); hojaReglas(); },
  exportar: exportarCSV,
  editarTema: hojaTema,
  ponerTema: (d) => { E.aj.tema = d.v; guardar('mf_tema', d.v); aplicarTema(d.v); guardarAjustes(); cerrarHoja(); repintar(); },
  entrarGoogle: () => entrarConGoogle(),
  revisarPase: () => revisarPase(),
  cancelarPase: () => { clearInterval(esperaT); guardar('mf_pareo', null); pantallaBloqueo(); },
  cerrarVentana: () => { try { window.close(); } catch { /* nada */ } avisar('Toca la X de arriba para cerrar'); },
  conectarGmail: () => hojaConectarGmail(),
  invitar: () => hojaInvitar(),
  copiarEnlace: async () => { try { await navigator.clipboard.writeText(URL_APP); avisar('Enlace copiado'); } catch { avisar('No se pudo copiar'); } },
  compartirEnlace: async () => {
    try { await navigator.share({ title: 'Mis Finanzas', text: 'Ve en qué se va tu dinero (avisos de Santander en Gmail):', url: URL_APP }); }
    catch { ACC.copiarEnlace(); }
  },
  cerrarSesion: async () => {
    if (!confirm('¿Cerrar sesión en este dispositivo?')) return;
    await sb.auth.signOut();
    guardar('mf_aj', null);
    location.replace(location.pathname);
  },
  borrarCuenta: async () => {
    if (!confirm('Se borrarán para siempre tu cuenta, tus movimientos y el permiso a tu Gmail. No se puede deshacer. ¿Continuar?')) return;
    try { await llamar('borrar-cuenta'); } catch (e) { avisar(e.message); return; }
    await sb.auth.signOut();
    guardar('mf_aj', null);
    location.replace(location.pathname);
  },
  deshacer: () => { const f = E.deshacer; $('#aviso').hidden = true; if (f) f(); },
  manualTipo: (d, b) => {
    E.manualTipo = d.v;
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    $('#manCats').hidden = d.v === 'deposito';
  },
  manualCat: (d, b) => { E.manualCat = d.cat; b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); },
  guardarManual: () => {
    const monto = parseFloat($('#manMonto').value.replace(/[$,\s]/g, ''));
    if (!(monto > 0)) { $('#manMonto').focus(); avisar('Escribe el monto'); return; }
    const desc = $('#manDesc').value.trim() || (E.manualTipo === 'deposito' ? 'Ingreso' : CATS[E.manualCat].n);
    const ahora = new Date();
    E.aj.manuales.push({ id: 'm' + ahora.getTime(), f: $('#manFecha').value || iso(hoy()), h: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`, m: Math.round(monto * 100) / 100,
      tipo: E.manualTipo, c: desc.toUpperCase(), cat: E.manualTipo === 'deposito' ? 'ingreso' : E.manualCat, tj: $('#manTj').value });
    const k = claveDe({ tipo: E.manualTipo, c: desc.toUpperCase() });
    if (!E.aj.nombres[k]) E.aj.nombres[k] = desc;
    guardarAjustes(); preparar(); cerrarHoja(); repintar(); avisar('Agregado');
  },
  borrarManual: (d) => {
    const antes = JSON.stringify(E.aj);
    E.aj.manuales = E.aj.manuales.filter((m) => m.id !== d.id);
    guardarAjustes(); preparar(); cerrarHojaSinGuardar(); repintar();
    avisar('Borrado', () => { E.aj = JSON.parse(antes); guardarAjustes(); preparar(); repintar(); });
  },
};

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-ir]');
  if (nav) {
    if (nav.closest('#barra') && nav.dataset.ir === 'movimientos') Object.assign(E.f, { cat: null, tj: null, k: null, g: null, desde: null, hasta: null, todo: false, limite: 120 });
    if (nav.closest('.tarjeta, .seccion') && nav.dataset.ir === 'movimientos') Object.assign(E.f, { cat: null, tj: null, k: null, g: null, q: '', desde: null, hasta: null, todo: false, tipo: 'todo', limite: 120 });
    cerrarHojaSinGuardar(); ir(nav.dataset.ir); return;
  }
  const b = e.target.closest('[data-acc]');
  if (b && ACC[b.dataset.acc]) { e.preventDefault(); ACC[b.dataset.acc](b.dataset, b, e); return; }
  if (!e.target.closest('[data-tip]')) ocultarTip();
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    E.f.q = e.target.value; E.f.limite = 120;
    clearTimeout(E.tq);
    E.tq = setTimeout(() => {
      const pos = e.target.selectionStart;
      repintar();
      const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    }, 180);
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'codigo') ACC.entrar(); });
$('#fab').addEventListener('click', hojaManual);
// Al volver a la app después de un rato, trae lo nuevo sin hacer nada.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !E.datos || E.sincronizando) return;
  if (Date.now() - (E.ultimaCarga || 0) < 10 * 60 * 1000) return;
  try { const antes = E.datos.generado; await cargarTodo(); E.ultimaCarga = Date.now(); if (E.datos.generado !== antes && $('#hoja').hidden) repintar(); } catch { /* sin red */ }
});

E.ultimaCarga = Date.now();
iniciar();
