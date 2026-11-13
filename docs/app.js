/* Mis Finanzas — app personal. Sin servidor: los datos llegan cifrados
   (docs/datos/finanzas.enc, AES-256-GCM) y se abren aquí con tu código. */
'use strict';

const REPO = 'HectorMontiel/finance-app';
const WORKFLOW = 'sincronizar.yml';
const VERSION = '2.0';

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

/* ── Cifrado (mismo formato que ingesta/cifrado.py) ─────────────────────── */
const MAGIA = new TextEncoder().encode('MF1');
const b64aBytes = (s) => { s = s.trim().replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const bytesAB64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

async function importarClave(txt) {
  const raw = b64aBytes(txt);
  if (raw.length !== 32) throw new Error('clave');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function descifrar(buf, clave) {
  const u = new Uint8Array(buf);
  if (u[0] !== 77 || u[1] !== 70 || u[2] !== 49) throw new Error('formato');
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(3, 15), additionalData: MAGIA }, clave, u.slice(15));
  const flujo = new Blob([plano]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(flujo).text());
}
async function cifrar(obj, clave) {
  const flujo = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'));
  const plano = await new Response(flujo).arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: MAGIA }, clave, plano));
  const out = new Uint8Array(15 + c.length);
  out.set(MAGIA, 0); out.set(iv, 3); out.set(c, 15);
  return out;
}

/* ── Estado ─────────────────────────────────────────────────────────────── */
const E = {
  claveTxt: null, clave: null, datos: null, aj: null, movs: [],
  vista: 'inicio', periodoInicio: 'pago',
  f: { q: '', cat: null, tj: null, k: null, tipo: 'gastos', mes: null, todo: false, limite: 120 },
  an: { rango: '6m', mes: null },
  ajSha: null, subiendo: null, sincronizando: false,
};

function ajustesBase() {
  return {
    v: 1, actualizado: 0, pago_monto: 13000, frecuencia: 'catorcenal', pago_ref: '2026-06-25', pago_dia: 1,
    meta_ahorro: 20, tarjetas: {}, nombres: {}, reglas: {}, cambios: {}, revisados: {}, manuales: [],
    presupuestos: {}, gh_token: '', tema: 'auto',
  };
}

/* ── Arranque ───────────────────────────────────────────────────────────── */
async function iniciar() {
  aplicarTema(leer('mf_tema') || 'auto');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('k')) {
    try { await importarClave(h.get('k')); guardar('mf_clave', h.get('k').trim()); } catch { /* código malo */ }
    // En Safari se deja el código en la dirección para que «Agregar a inicio» lo lleve a la app.
    if (esApp() || !esIOS()) history.replaceState(null, '', location.pathname + location.search);
  }
  const k = leer('mf_clave');
  if (!k) return pantallaBloqueo();
  try {
    E.claveTxt = k;
    E.clave = await importarClave(k);
  } catch { guardar('mf_clave', null); return pantallaBloqueo('Ese código no es válido.'); }
  pintarEsqueleto();
  try {
    await cargarTodo();
  } catch (e) {
    if (e.name === 'OperationError' || e.message === 'formato') {
      guardar('mf_clave', null);
      return pantallaBloqueo('El código no abre tus datos. Revisa que sea el más reciente.');
    }
    return pantallaError(e);
  }
  $('#barra').hidden = false;
  $('#fab').hidden = false;
  ir(sessionStorage.getItem('mf_vista') || 'inicio');
  if (E.aj.gh_token && E.ajPendiente) programarSubida();
}

async function cargarTodo() {
  const r = await fetch(`datos/finanzas.enc?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`No se pudieron bajar los datos (${r.status}).`);
  E.datos = await descifrar(await r.arrayBuffer(), E.clave);
  await cargarAjustes();
  preparar();
}

async function cargarAjustes() {
  let local = null;
  try { local = JSON.parse(leer('mf_aj') || 'null'); } catch { local = null; }
  let remoto = null;
  try {
    const r = await fetch(`datos/ajustes.enc?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) remoto = await descifrar(await r.arrayBuffer(), E.clave);
  } catch { /* sin copia publicada */ }
  const token = (local && local.gh_token) || (remoto && remoto.gh_token);
  if (token) {
    try {
      const g = await fetch(`https://api.github.com/repos/${REPO}/contents/docs/datos/ajustes.enc?ref=main`, { headers: gh(token), cache: 'no-store' });
      if (g.ok) {
        const j = await g.json();
        E.ajSha = j.sha;
        const fresco = await descifrar(b64aBytes(j.content.replace(/\n/g, '')).buffer, E.clave);
        if (!remoto || (fresco.actualizado || 0) >= (remoto.actualizado || 0)) remoto = fresco;
      }
    } catch { /* sin red o token vencido: se usa lo que haya */ }
  }
  const elegido = !local ? remoto : !remoto ? local : ((local.actualizado || 0) >= (remoto.actualizado || 0) ? local : remoto);
  E.ajPendiente = !!(local && remoto && (local.actualizado || 0) > (remoto.actualizado || 0));
  E.aj = Object.assign(ajustesBase(), elegido || {});
  guardar('mf_aj', JSON.stringify(E.aj));
  guardar('mf_tema', E.aj.tema);
  aplicarTema(E.aj.tema);
}

function gh(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

/* ── Movimientos con las correcciones del usuario ───────────────────────── */
function claveDe(m) {
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
function preparar() {
  const aj = E.aj;
  const base = (E.datos.movs || []).concat((aj.manuales || []).map((m) => ({ ...m, manual: true })));
  E.movs = base.map((m) => {
    const k = claveDe(m);
    const cambio = aj.cambios[m.id] || {};
    let cat = cambio.cat || aj.reglas[k] || m.cat || 'otros';
    if (m.tipo === 'deposito' && !CATS_INGRESO.includes(cat)) cat = 'ingreso';
    if (m.tipo !== 'deposito' && cat === 'ingreso') cat = 'otros';
    return { ...m, k, cat, nota: cambio.nota || '', nombre: nombreDe(m, k) };
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
  const pendientes = gruposPorClasificar().length;
  const ultimos = E.movs.slice(0, 6);
  const finTxt = fDia(p.fin);

  const avisoIOS = esIOS() && !esApp() && leer('mf_no_instalar') !== '1'
    ? `<div class="tarjeta" style="margin-bottom:12px;display:flex;gap:12px;align-items:flex-start">
        <div class="cat-ic" style="--c:var(--acento)">${ic('i-descargar')}</div>
        <div style="flex:1"><b>Instálala en tu iPhone</b><div class="texto-2 peq" style="margin-top:3px">Toca <b>Compartir</b> y luego <b>«Agregar a inicio»</b>. Abrirá como app, sin barra de Safari y ya desbloqueada.</div></div>
        <button class="icono-btn" style="box-shadow:none;width:30px;height:30px" data-acc="noInstalar" aria-label="Cerrar">${ic('i-x')}</button></div>`
    : '';

  return `
  <header class="encabezado">
    <div><h1>${saludo()}</h1><div class="sub">${esc(fDiaLargo(hoyS))}</div></div>
    <button class="icono-btn ${E.sincronizando ? 'girando' : ''}" data-acc="sincronizar" aria-label="Actualizar">${ic('i-actualizar')}</button>
  </header>
  ${avisoIOS}
  <section class="tarjeta heroe">
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

  ${pendientes ? `<button class="llamado" data-acc="clasificar">
      <span class="ic">${ic('i-chispa')}</span>
      <span><b>${pendientes} ${pendientes === 1 ? 'comercio' : 'comercios'} por clasificar</b><span>Un toque cada uno y la app aprende para siempre</span></span>
      ${ic('i-der')}</button>` : ''}

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
      <div class="tarjeta plana">${ultimos.map(filaMov).join('') || vacio('i-lista', 'Sin movimientos', 'Aparecerán aquí en cuanto lleguen')}</div>
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
  const filtroExtra = f.k || f.desde
    ? `<div style="margin-top:12px"><button class="chip on" data-acc="quitarFiltroExtra">${esc(f.k ? (E.movs.find((m) => m.k === f.k)?.nombre || 'Comercio') : `${fDia(f.desde)} – ${fDia(iso(sumaDias(fecha(f.hasta), -1)))}`)} ${ic('i-x')}</button></div>`
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

function vistaAnalisis() {
  const R = rangoAnalisis();
  const g = gastos(R.desde, R.hasta);
  const total = suma(g);
  const prev = R.prevDesde ? suma(gastos(R.prevDesde, R.desde)) : 0;
  const ing = suma(E.movs.filter((m) => esIngreso(m) && m.f >= R.desde && m.f < R.hasta));
  const porCat = agrupar(g, 'cat');
  const prevCat = R.prevDesde ? Object.fromEntries(agrupar(gastos(R.prevDesde, R.desde), 'cat').map((x) => [x.k, x.total])) : {};
  const porComercio = agrupar(g, 'k').slice(0, 10);
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
  const rangos = [['mes', 'Mes'], ['3m', '3 m'], ['6m', '6 m'], ['12m', '1 año'], ['todo', 'Todo']];
  const recurrentes = pagosRecurrentes();

  return `
  <header class="encabezado"><div><h1>Análisis</h1><div class="sub">${esc(R.etiqueta)}</div></div></header>
  <div class="seg">${rangos.map(([v, n]) => `<button class="${E.an.rango === v ? 'on' : ''}" data-acc="rango" data-v="${v}">${n}</button>`).join('')}</div>
  ${E.an.rango === 'mes' ? `<div class="navmes">
    <button class="icono-btn" data-acc="mesAn" data-d="-1" aria-label="Mes anterior">${ic('i-izq')}</button><b>${esc(R.etiqueta)}</b>
    <button class="icono-btn" data-acc="mesAn" data-d="1" aria-label="Mes siguiente" ${(E.an.mes || mesK) >= mesK ? 'disabled style="opacity:.35"' : ''}>${ic('i-der')}</button></div>` : ''}

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
        return `<button class="fila" data-acc="verComercio" data-k="${esc(x.k)}">
          <span class="cat-ic" style="--c:${cat.c}">${ic('c-' + m0.cat)}</span>
          <span class="cuerpo"><span class="t1">${esc(m0.nombre)}</span><span class="t2">${x.n} ${x.n === 1 ? 'vez' : 'veces'} · ${esc(cat.n)}</span></span>
          <span class="monto num">${fmt(x.total)}</span></button>`;
      }).join('') || vacio('i-cartera', 'Sin gastos', '')}</div>

      <div class="seccion"><h2>Qué día gastas más</h2></div>
      <div class="tarjeta"><div class="texto-2 peq">Promedio por día de la semana</div>
        ${graficaColumnas(dow, { alto: 150, etiquetaTodas: false })}
        ${tablaDatos(dow.map((x) => [x.et, fmt(x.v)]), ['Día', 'Promedio'])}</div>

      ${recurrentes.length ? `<div class="seccion"><h2>Pagos que se repiten</h2><span class="texto-3 peq">${fmt(recurrentes.reduce((a, r) => a + r.prom, 0))}/mes</span></div>
      <div class="tarjeta plana">${recurrentes.map((r) => `<button class="fila" data-acc="verComercio" data-k="${esc(r.k)}">
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
  for (const x of agrupar(gastos(desde, hasta).filter((m) => m.tipo === 'compra'), 'k')) {
    const porMes = {};
    for (const m of x.movs) porMes[mesDe(m.f)] = (porMes[mesDe(m.f)] || 0) + m.m;
    const vals = Object.values(porMes);
    if (vals.length < 3) continue;
    const prom = vals.reduce((a, v) => a + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - prom) ** 2, 0) / vals.length);
    const veces = x.n / vals.length;
    if (sd / prom < 0.25 && veces <= 2) out.push({ k: x.k, nombre: x.movs[0].nombre, cat: x.movs[0].cat, prom, meses: vals.length });
  }
  return out.sort((a, b) => b.prom - a.prom).slice(0, 8);
}

/* ── Gráfica de columnas (SVG) ──────────────────────────────────────────── */
function graficaColumnas(datos, { prom = 0, alto = 180 } = {}) {
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
    if ((i === iMax || i === iUlt) && d.v > 0) s += `<text class="valor-col" x="${cx}" y="${(H - bot - h - 6).toFixed(1)}" text-anchor="middle">${fmtK(d.v)}</text>`;
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
  <div class="seccion"><h2>Orden</h2></div>
  <div class="tarjeta plana lista-aj">
    ${item('clasificar', 'i-chispa', 'Clasificar comercios', `${gruposPorClasificar().length} pendientes`)}
    ${item('editarReglas', 'i-regla', 'Lo que la app aprendió', `${nReglas} ${nReglas === 1 ? 'regla' : 'reglas'}`)}
    ${item('editarTarjetas', 'i-tarjeta', 'Nombres de tarjetas y cuentas', `${E.tarjetasVistas.length}`)}
  </div>
  </div><div>
  <div class="seccion"><h2>Sincronización</h2></div>
  <div class="tarjeta plana lista-aj">
    <div class="item">${ic('i-actualizar')}<span class="cuerpo">Correos de Santander<div class="texto-3 peq">${E.datos.movs.length.toLocaleString('es-MX')} movimientos${primero ? ` desde ${esc(fMes(mesDe(primero)))}` : ''} · ${esc(haceCuanto(E.datos.generado))}</div></span></div>
    ${item('sincronizar', 'i-actualizar', 'Actualizar ahora', aj.gh_token ? '' : 'cada 3 h sola')}
    ${item('editarGitHub', 'i-candado', 'Conexión con GitHub', aj.gh_token ? 'Conectada' : 'Opcional')}
  </div>
  <div class="seccion"><h2>Dispositivos y datos</h2></div>
  <div class="tarjeta plana lista-aj">
    ${item('agregarDispositivo', 'i-qr', 'Abrir en otro dispositivo', '')}
    ${item('exportar', 'i-descargar', 'Descargar en Excel (CSV)', '')}
    ${item('editarTema', 'i-ajustes', 'Apariencia', { auto: 'Automática', claro: 'Clara', oscuro: 'Oscura' }[aj.tema])}
    <button class="item" data-acc="bloquear">${ic('i-candado')}<span class="cuerpo" style="color:var(--critico)">Cerrar en este dispositivo</span></button>
  </div>
  <p class="texto-3 peq centro" style="margin-top:22px">Mis Finanzas ${VERSION} · tus datos viajan cifrados; sólo este código los abre.</p>
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
      <button class="btn" data-acc="verComercio" data-k="${esc(m.k)}">Ver todos</button>
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

/* Clasificar en serie */
function gruposPorClasificar() {
  const g = new Map();
  for (const m of E.movs) {
    const pendiente = (m.cat === 'otros' && m.tipo === 'compra') || (m.tipo === 'transferencia' && !E.aj.reglas[m.k] && !E.aj.revisados[m.k] && !(E.aj.cambios[m.id] || {}).cat);
    if (!pendiente) continue;
    const x = g.get(m.k) || { k: m.k, total: 0, n: 0, ultimo: m.f, m };
    x.total += m.m; x.n += 1;
    g.set(m.k, x);
  }
  return [...g.values()].sort((a, b) => b.total - a.total);
}

function hojaClasificar(i = 0) {
  const grupos = gruposPorClasificar();
  if (!grupos.length || i >= grupos.length) {
    abrirHoja(`${cabHoja('Clasificar')}${vacio('i-check', '¡Todo en orden!', 'No quedan comercios por clasificar.')}<button class="btn primario ancho" data-acc="cerrar">Listo</button>`);
    return;
  }
  const x = grupos[i];
  const lista = x.m.tipo === 'transferencia' ? ['transferencias', 'propias', 'servicios', 'comida', 'compras', 'super', 'apuestas', 'salud', 'entretenimiento', 'viajes', 'efectivo', 'otros'] : CATS_GASTO.filter((c) => c !== 'otros');
  const hechos = Math.min(E.clasifPos || 0, E.clasifTotal - 1);
  abrirHoja(`${cabHoja('Clasificar')}
    <div class="progreso"><i style="width:${((hechos / E.clasifTotal) * 100).toFixed(1)}%"></i></div>
    <div class="texto-3 peq">${hechos + 1} de ${E.clasifTotal}</div>
    <div class="clasif"><div class="comercio">
      <div class="n">${esc(x.m.nombre)}</div>
      <div class="d">${x.n} ${x.n === 1 ? 'movimiento' : 'movimientos'} · <span class="num">${fmt(x.total)}</span> · último ${esc(fDia(x.ultimo))}</div>
      <div class="crudo">${esc(x.m.c)}</div>
      ${x.m.tipo === 'transferencia' ? '<div class="texto-2 peq" style="margin-top:10px">¿Es un gasto o dinero que mueves entre tus cuentas?</div>' : ''}
    </div></div>
    ${rejillaCats(lista, null, 'clasifCat', `data-k="${esc(x.k)}" data-i="${i}"`)}
    <label class="campo" style="margin-top:14px"><span>Ponle un nombre (opcional)</span><input id="clasifNombre" placeholder="${esc(x.m.nombre)}" autocomplete="off"></label>
    <div class="dos"><button class="btn" data-acc="clasifSaltar" data-i="${i}">Saltar</button><button class="btn" data-acc="cerrar">Terminar</button></div>`,
  () => { E.clasifTotal = 0; repintar(); });
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

function hojaGitHub() {
  const t = E.aj.gh_token;
  abrirHoja(`${cabHoja('Conexión con GitHub')}
    <p class="texto-2" style="margin-top:0">Es opcional. Sirve para dos cosas: el botón <b>Actualizar ahora</b> y que tus categorías y nombres aparezcan igual en todos tus dispositivos. Sin esto, la app se actualiza sola cada 3 horas y lo que ajustes se queda en este dispositivo.</p>
    <ol class="pasos">
      <li><span>Abre <b>github.com → Settings → Developer settings → Fine-grained tokens → Generate new token</b>.</span></li>
      <li><span>En <b>Repository access</b> elige sólo <b>finance-app</b>. En permisos: <b>Contents</b> y <b>Actions</b> en «Read and write».</span></li>
      <li><span>Copia el token y pégalo aquí. Se guarda cifrado con tus datos.</span></li>
    </ol>
    <label class="campo"><span>Token</span><input id="ghToken" value="${t ? '••••••••' + esc(t.slice(-4)) : ''}" placeholder="github_pat_…" autocomplete="off" spellcheck="false"></label>
    <div class="dos">${t ? '<button class="btn peligro" data-acc="quitarToken">Desconectar</button>' : '<span></span>'}<button class="btn primario" data-acc="guardarToken">Guardar</button></div>`);
}

function hojaDispositivo() {
  const url = `${location.origin}${location.pathname}#k=${E.claveTxt}`;
  let qr = '';
  try {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch { qr = ''; }
  abrirHoja(`${cabHoja('Abrir en otro dispositivo')}
    <p class="texto-2" style="margin-top:0">Escanea este código con la cámara del otro celular. Se abrirá ya desbloqueada.</p>
    <div class="qr">${qr}</div>
    <p class="texto-3 peq centro">No compartas este código: abre todos tus movimientos.</p>
    <div class="dos"><button class="btn" data-acc="copiarCodigo">Copiar código</button><button class="btn primario" data-acc="cerrar">Listo</button></div>`);
}

function hojaTema() {
  abrirHoja(`${cabHoja('Apariencia')}
    <div class="seg">${[['auto', 'Automática'], ['claro', 'Clara'], ['oscuro', 'Oscura']].map(([v, n]) => `<button class="${E.aj.tema === v ? 'on' : ''}" data-acc="ponerTema" data-v="${v}">${n}</button>`).join('')}</div>
    <div style="height:10px"></div>`);
}

/* ── Sincronizar ────────────────────────────────────────────────────────── */
async function sincronizarAhora() {
  if (E.sincronizando) return;
  const t = E.aj.gh_token;
  if (!t) {
    abrirHoja(`${cabHoja('Actualizar')}
      <p class="texto-2" style="margin-top:0">La app revisa tus correos de Santander <b>cada 3 horas</b> por su cuenta. Última vez: <b>${esc(haceCuanto(E.datos.generado))}</b>.</p>
      <p class="texto-2">Para poder actualizar al momento, conecta GitHub (un paso, una sola vez).</p>
      <div class="dos"><button class="btn" data-acc="recargar">Recargar datos</button><button class="btn primario" data-acc="editarGitHub">Conectar</button></div>`);
    return;
  }
  E.sincronizando = true; repintar();
  avisar('Revisando tus correos…', null, 60000);
  try {
    const t0 = Date.now();
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', headers: gh(t), body: JSON.stringify({ ref: 'main' }) });
    if (r.status === 401 || r.status === 403) throw new Error('GitHub no aceptó el token. Revísalo en Ajustes.');
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}.`);
    let run = null;
    for (let i = 0; i < 90; i++) {
      await espera(i < 3 ? 3000 : 4000);
      const l = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=3&event=workflow_dispatch`, { headers: gh(t), cache: 'no-store' });
      const j = await l.json();
      run = (j.workflow_runs || []).find((x) => new Date(x.created_at) >= t0 - 15000);
      if (run && run.status === 'completed') break;
      if (i === 8) avisar('Leyendo correos y publicando… (≈1 min)', null, 60000);
    }
    if (!run || run.status !== 'completed') throw new Error('Tardó demasiado; se terminará solo en un momento.');
    if (run.conclusion !== 'success') throw new Error('La actualización falló en GitHub. Revisa la pestaña Actions.');
    const antes = E.datos.movs.length;
    await cargarTodo();
    const nuevos = E.datos.movs.length - antes;
    avisar(nuevos > 0 ? `${nuevos} ${nuevos === 1 ? 'movimiento nuevo' : 'movimientos nuevos'}` : 'Ya estabas al día');
  } catch (e) {
    avisar(e.message || 'No se pudo actualizar.');
  } finally {
    E.sincronizando = false; repintar();
  }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Guardar ajustes (local + GitHub si hay token) ──────────────────────── */
function guardarAjustes() {
  E.aj.actualizado = Date.now();
  guardar('mf_aj', JSON.stringify(E.aj));
  if (E.aj.gh_token) programarSubida();
}
function programarSubida() {
  clearTimeout(E.subiendo);
  E.subiendo = setTimeout(subirAjustes, 2500);
}
async function subirAjustes(intento = 0) {
  const t = E.aj.gh_token;
  if (!t) return;
  const url = `https://api.github.com/repos/${REPO}/contents/docs/datos/ajustes.enc`;
  try {
    if (!E.ajSha) {
      const g = await fetch(`${url}?ref=main`, { headers: gh(t), cache: 'no-store' });
      if (g.ok) E.ajSha = (await g.json()).sha;
    }
    const bytes = await cifrar(E.aj, E.clave);
    const body = { message: 'ajustes: cambios desde la app', content: bytesAB64(bytes), branch: 'main' };
    if (E.ajSha) body.sha = E.ajSha;
    const r = await fetch(url, { method: 'PUT', headers: gh(t), body: JSON.stringify(body) });
    if ((r.status === 409 || r.status === 422) && intento < 2) { E.ajSha = null; return subirAjustes(intento + 1); }
    if (!r.ok) throw new Error(String(r.status));
    E.ajSha = (await r.json()).content.sha;
  } catch {
    avisar('No se pudieron subir tus ajustes; quedaron guardados aquí.');
  }
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
    <p>Tus gastos de Santander, claros y en un solo lugar. Es privada: tus datos viajan cifrados y sólo se abren con tu código de acceso.</p>
    <ol class="pasos"><li><span>Abre tu <b>enlace de acceso</b> (el que termina en <b>#k=…</b>) o escanea su QR: entra solo.</span></li>
      <li><span>Si ya está abierta en otro dispositivo: <b>Ajustes → Abrir en otro dispositivo</b>.</span></li>
      <li><span>O pega aquí el código o el enlace completo.</span></li></ol>
    <label class="campo"><span>Código de acceso</span>
      <span style="display:flex;gap:8px"><input id="codigo" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Código o enlace" style="flex:1;min-width:0;width:auto">
      <button class="btn" data-acc="pegarCodigo" style="height:48px">Pegar</button></span></label>
    ${error ? `<p style="color:var(--critico);margin:-4px 0 14px">${esc(error)}</p>` : ''}
    <button class="btn primario ancho" data-acc="entrar">Entrar</button></div>`;
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
  verCategoria: (d) => { Object.assign(E.f, { cat: d.cat, tj: null, k: null, q: '', tipo: d.cat === 'ingreso' ? 'ingresos' : 'gastos', desde: d.desde, hasta: d.hasta, limite: 120 }); ir('movimientos'); },
  verComercio: (d) => { cerrarHojaSinGuardar(); Object.assign(E.f, { k: d.k, cat: null, tj: null, q: '', tipo: 'todo', desde: null, hasta: null, todo: true, limite: 120 }); ir('movimientos'); },
  verTarjeta: (d) => { const R = rangoAnalisis(); Object.assign(E.f, { tj: d.tj, cat: null, k: null, q: '', tipo: 'gastos', desde: R.desde, hasta: R.hasta, limite: 120 }); ir('movimientos'); },
  quitarFiltroExtra: () => { Object.assign(E.f, { k: null, desde: null, hasta: null, todo: false }); repintar(); },
  tipoMov: (d) => { E.f.tipo = d.v; E.f.cat = null; E.f.limite = 120; repintar(); },
  catMov: (d) => { E.f.cat = d.v || null; E.f.limite = 120; repintar(); },
  tjMov: (d) => { E.f.tj = d.v || null; E.f.limite = 120; repintar(); },
  mesMov: (d) => { E.f.mes = mesMas(E.f.mes, +d.d); E.f.limite = 120; repintar(); },
  todoMov: () => { E.f.todo = !E.f.todo; E.f.limite = 120; repintar(); },
  masMovs: () => { E.f.limite += 200; repintar(); },
  limpiarQ: () => { E.f.q = ''; repintar(); },
  rango: (d) => { E.an.rango = d.v; if (d.v === 'mes') E.an.mes = mesDe(iso(hoy())); repintar(); },
  mesAn: (d) => { E.an.mes = mesMas(E.an.mes || mesDe(iso(hoy())), +d.d); repintar(); },
  clasificar: () => { E.clasifTotal = Math.max(1, gruposPorClasificar().length); E.clasifPos = 0; hojaClasificar(0); },
  clasifCat: (d) => {
    E.aj.reglas[d.k] = d.cat; E.aj.revisados[d.k] = 1;
    const n = $('#clasifNombre') && $('#clasifNombre').value.trim();
    if (n) E.aj.nombres[d.k] = n;
    E.clasifPos = (E.clasifPos || 0) + 1;
    guardarAjustes(); preparar(); hojaClasificar(+d.i);
  },
  clasifSaltar: (d) => { E.clasifPos = (E.clasifPos || 0) + 1; hojaClasificar(+d.i + 1); },
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
  editarGitHub: hojaGitHub,
  guardarToken: async () => {
    const v = $('#ghToken').value.trim();
    if (!v || v.startsWith('••')) { cerrarHoja(); return; }
    const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: gh(v) }).catch(() => null);
    if (!r || !r.ok) { avisar('Ese token no funciona con finance-app.'); return; }
    const j = await r.json();
    if (!j.permissions || !j.permissions.push) { avisar('El token necesita permiso de escritura (Contents).'); return; }
    E.aj.gh_token = v; guardarAjustes(); cerrarHoja(); repintar(); avisar('GitHub conectado');
  },
  quitarToken: () => { E.aj.gh_token = ''; guardarAjustes(); cerrarHoja(); repintar(); },
  agregarDispositivo: hojaDispositivo,
  copiarCodigo: async () => { try { await navigator.clipboard.writeText(E.claveTxt); avisar('Código copiado'); } catch { avisar('No se pudo copiar'); } },
  exportar: exportarCSV,
  editarTema: hojaTema,
  ponerTema: (d) => { E.aj.tema = d.v; guardar('mf_tema', d.v); aplicarTema(d.v); guardarAjustes(); cerrarHoja(); repintar(); },
  bloquear: () => {
    if (!confirm('¿Cerrar Mis Finanzas en este dispositivo? Necesitarás el código o el QR para volver a abrirla.')) return;
    ['mf_clave', 'mf_aj'].forEach((k) => guardar(k, null));
    location.replace(location.pathname);
  },
  entrar: async () => {
    const v = $('#codigo').value.trim().replace(/^.*#k=/, '').replace(/\s+/g, '');
    if (!v) { $('#codigo').focus(); return avisar('Primero pega tu código o tu enlace de acceso'); }
    try { await importarClave(v); } catch { return pantallaBloqueo('Ese código no es válido: deben ser 43 caracteres.'); }
    guardar('mf_clave', v); location.reload();
  },
  pegarCodigo: async () => {
    try { $('#codigo').value = (await navigator.clipboard.readText()).trim(); ACC.entrar(); }
    catch { $('#codigo').focus(); avisar('Mantén presionado el campo y elige «Pegar»'); }
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
    if (nav.closest('#barra') && nav.dataset.ir === 'movimientos') Object.assign(E.f, { cat: null, tj: null, k: null, desde: null, hasta: null, todo: false, limite: 120 });
    if (nav.closest('.tarjeta, .seccion') && nav.dataset.ir === 'movimientos') Object.assign(E.f, { cat: null, tj: null, k: null, q: '', desde: null, hasta: null, todo: false, tipo: 'todo', limite: 120 });
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
