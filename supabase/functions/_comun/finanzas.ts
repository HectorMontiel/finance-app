// Lógica compartida de Mis Finanzas para las funciones de Supabase.
// Los patrones vienen de reglas.ts (generado desde ingesta/ en Python).
import { PATRONES, REGLAS } from "./reglas.ts";

const RX: Record<string, RegExp> = Object.fromEntries(
  Object.entries(PATRONES).map(([k, p]) => [k, new RegExp(p, "iu")]),
);
const REGLAS_RX: [RegExp, string][] = REGLAS.map(([p, c]) => [new RegExp(p, "iu"), c]);

export interface Mov {
  id: string; f: string; h?: string; m: number; tipo: string; c: string;
  tj?: string; cat_auto?: string; fmt?: string; extra?: Record<string, string>; clave?: string; dup?: string[];
}

export const ASUNTOS = [
  "Pago/Compra", "Tu compra ha sido registrada", "Autorización por encima del límite",
  "Confirmación de transferencia", "Has recibido un depósito", "RETIRO SIN TARJETA EN ATM",
];

export function consultaGmail(dias: number | null): string {
  const q = `from:santander (${ASUNTOS.map((a) => `subject:"${a}"`).join(" OR ")})`;
  return dias ? `${q} newer_than:${dias}d` : q;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function aTexto(raw: string): string {
  let s = raw.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/td>|<\/tr>/gi, " ").replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    const nombres: Record<string, string> = { ...ENT, aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", iexcl: "¡", iquest: "¿", bull: "•" };
    return nombres[e] ?? m;
  });
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

const monto = (s: string) => Math.round(parseFloat(s.replace(/,/g, "")) * 100) / 100;
const fecha = (dmy: string) => { const [d, m, y] = dmy.split("/"); return `${y}-${m}-${d}`; };
const hora = (h?: string) => { if (!h) return ""; const [a, b] = h.split(":"); return `${a.padStart(2, "0")}:${b}`; };
const limpia = (c: string) => c.replace(/\s+/g, " ").replace(/^[\s.,:;]+|[\s.,:;]+$/g, "").toUpperCase().slice(0, 60);

export function categorizarRegla(comercio: string, tipo = "compra"): string {
  if (tipo === "transferencia") return "transferencias";
  if (tipo === "retiro") return "efectivo";
  if (tipo === "deposito") return "ingreso";
  for (const [rx, cat] of REGLAS_RX) if (rx.test(comercio || "")) return cat;
  return "otros";
}

export function parsear(t: string, id: string, asunto = ""): Mov | null {
  const a = asunto.toLowerCase();
  const tl = t.toLowerCase();
  if (a.includes("tarjeta de crédito propias") || a.includes("tarjeta de credito propias")) return null;
  if (a.includes("referencia de retiro")) return null;

  if (a.includes("transferencia") || RX.TRANSF.test(t)) {
    const m = t.match(RX.TRANSF);
    if (!m?.groups) return null;
    const g = m.groups;
    const banco = (g.banco || "CUENTA").replace(/\s+/g, " ").trim().toUpperCase();
    const extra: Record<string, string> = { origen: g.origen };
    if (g.ref) extra.ref = g.ref;
    const conc = t.match(RX.TRANSF_CONCEPTO);
    if (conc) extra.concepto = conc[1].trim().slice(0, 60);
    return { id, f: fecha(g.f), h: hora(g.h), m: monto(g.m), tipo: "transferencia", c: `${banco} ·${g.dest.slice(-4)}`, tj: g.origen.slice(-4), cat_auto: "transferencias", fmt: "T", extra };
  }

  if (a.includes("depósito") || a.includes("deposito") || tl.includes("abono por")) {
    const m = t.match(RX.DEPOSITO);
    if (!m?.groups) return null;
    const g = m.groups;
    const banco = t.match(RX.DEP_BANCO), origen = t.match(RX.DEP_ORIGEN), quien = t.match(RX.DEP_ORDENANTE), conc = t.match(RX.DEP_CONCEPTO);
    let nombre = (quien ? quien[1] : banco ? banco[1] : "DEPÓSITO").trim().toUpperCase();
    if (origen) nombre = `${nombre} ·${origen[1].slice(-4)}`;
    const extra: Record<string, string> = {};
    if (conc) extra.concepto = conc[1].trim().slice(0, 60);
    return { id, f: fecha(g.f), h: hora(g.h), m: monto(g.m), tipo: "deposito", c: nombre.slice(0, 60), tj: g.cuenta.slice(-4), cat_auto: "ingreso", fmt: "E", extra };
  }

  if ((a.includes("retiro") && a.includes("atm")) || tl.includes("retiro de efectivo sin tarjeta por")) {
    const m = t.match(RX.RETIRO);
    if (!m?.groups) return null;
    const g = m.groups;
    return { id, f: fecha(g.f), h: hora(g.h), m: monto(g.m), tipo: "retiro", c: "RETIRO SIN TARJETA", tj: g.cuenta.slice(-4), cat_auto: "efectivo", fmt: "R" };
  }

  for (const [fmt, k] of [["A", "A"], ["C", "C"], ["C", "C2"], ["C", "C3"], ["B", "B"]]) {
    const m = t.match(RX[k]);
    if (!m?.groups) continue;
    const g = { ...m.groups };
    if (g.d) g.f = `${g.d.padStart(2, "0")}/${g.mes.padStart(2, "0")}/${g.a}`;
    const mov: Mov = { id, f: fecha(g.f), h: hora(g.h), m: monto(g.m), tipo: "compra", c: limpia(g.c), tj: (g.tj || "").slice(-4), fmt };
    const mon = (g.mon || "MXN").toUpperCase();
    if (!["MXN", "MXP", "M.N."].includes(mon)) mov.extra = { moneda: mon };
    mov.cat_auto = categorizarRegla(mov.c);
    return mov;
  }

  const mm = t.match(RX.D_MONTO), mf = t.match(RX.D_FECHA), mc = t.match(RX.D_COMERCIO);
  if (mm?.groups && mf && mc && /compra|cargo|pago/i.test(t)) {
    const tj = t.match(RX.D_TJ);
    const mov: Mov = { id, f: fecha(mf[1]), h: hora(mf[2]), m: monto(mm.groups.m), tipo: "compra", c: limpia(mc[1]), tj: tj ? tj[1].slice(-4) : "", fmt: "D" };
    mov.cat_auto = categorizarRegla(mov.c);
    return mov;
  }
  return null;
}

/** Llave del diccionario: comercio sin prefijos de pasarela ni números de sucursal. */
export function normComercio(c: string): string {
  const orig = String(c || "").toUpperCase();
  let s = orig.replace(/\s*\*{2,}\d+$/, "");
  s = s.replace(/^(MERCADO ?PAGO|MERPAGO|MP|CLIP ?MX|BPK|CONEKTA|NMX|SQ|STR|LKL|SYSPAGO|PAYPAL|DLO|DL|OPLINEA|ABTS|ZETTLE|SP|IZ|EB|SR|PAYU|OPENPAY|GOFNDME|SIPAY|NETPAY|BZPAY|LUPAY|RESTS?)\s*\*\s*/, "");
  s = s.replace(/^M\.N\.\s+/, "").replace(/[#*]/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();
  return s || orig;
}
export function claveDe(m: Mov): string {
  if (m.tipo === "transferencia") return "T:" + m.c;
  if (m.tipo === "deposito") return "E:" + m.c;
  if (m.tipo === "retiro") return "R:";
  return "C:" + normComercio(m.c);
}

/* ── Cifrado del token de Gmail (AES-256-GCM, llave TOKEN_KEY en base64) ── */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function llave(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", deb64(Deno.env.get("TOKEN_KEY")!), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function cifrarTexto(t: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(), new TextEncoder().encode(t)));
  return b64(iv) + "." + b64(c);
}
export async function descifrarTexto(s: string): Promise<string> {
  const [iv, c] = s.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deb64(iv) }, await llave(), deb64(c)));
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });
