// Lee los correos nuevos de Santander de cada usuario, los guarda y clasifica.
// - Con la sesión del usuario: procesa una tanda suya y dice cuántos faltan (la app repite hasta 0).
// - Con la cabecera x-cron: recorre a todos los usuarios con Gmail conectado (lo nuevo de cada uno).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { CORS, type Mov, aTexto, categorizarRegla, claveDe, consultaGmail, descifrarTexto, json, parsear } from "../_comun/finanzas.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Google ─────────────────────────────────────────────────────────────── */
async function accesoGmail(uid: string): Promise<string | null> {
  const { data } = await sb.from("tokens").select("refresh_cifrado").eq("user_id", uid).maybeSingle();
  if (!data) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      refresh_token: await descifrarTexto(data.refresh_cifrado), grant_type: "refresh_token",
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    if (j.error === "invalid_grant") {
      await sb.from("tokens").delete().eq("user_id", uid);
      await sb.from("perfiles").update({ gmail_conectado: false, sync_estado: "reconectar" }).eq("user_id", uid);
    }
    return null;
  }
  return j.access_token;
}

async function gmail(at: string, ruta: string, intento = 0): Promise<any> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + ruta, { headers: { Authorization: "Bearer " + at } });
  if ((r.status === 429 || r.status >= 500) && intento < 4) { await espera(1500 * (intento + 1)); return gmail(at, ruta, intento + 1); }
  if (!r.ok) throw new Error(`Gmail ${r.status}`);
  return r.json();
}

async function listarIds(at: string, q: string): Promise<string[]> {
  const ids: string[] = [];
  let token = "";
  do {
    const j = await gmail(at, `messages?maxResults=500&q=${encodeURIComponent(q)}${token ? "&pageToken=" + token : ""}`);
    for (const m of j.messages || []) ids.push(m.id);
    token = j.nextPageToken || "";
  } while (token);
  return ids;
}

function decodificar(d: string): string {
  const b = atob(d.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}
function cuerpo(payload: any): string {
  const partes: [string, string][] = [];
  const andar = (p: any) => {
    if (p?.mimeType?.startsWith("text/") && p.body?.data) partes.push([p.mimeType, decodificar(p.body.data)]);
    for (const q of p?.parts || []) andar(q);
  };
  andar(payload);
  const textos = partes.map(([, x]) => aTexto(x));
  return textos.sort((a, b) => b.length - a.length)[0] || "";
}

async function traer(at: string, ids: string[]): Promise<{ id: string; asunto: string; texto: string }[]> {
  const out: { id: string; asunto: string; texto: string }[] = [];
  const cola = [...ids];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cola.length) {
      const id = cola.shift()!;
      try {
        const m = await gmail(at, `messages/${id}?format=full`);
        const asunto = (m.payload?.headers || []).find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
        out.push({ id, asunto, texto: cuerpo(m.payload) });
      } catch { /* se reintenta en la siguiente pasada */ }
    }
  }));
  return out;
}

/* ── Duplicados entre formatos (A tapa a C y B del mismo pago) ──────────── */
const minutos = (h?: string) => (h ? +h.slice(0, 2) * 60 + +h.slice(3, 5) : null);
function duplicadoDe(x: Mov, previos: Mov[]): Mov | null {
  if (x.fmt !== "C" && x.fmt !== "B") return null;
  for (const p of previos) {
    if (p.fmt === x.fmt || p.f !== x.f || p.m !== x.m || (p.tj || "") !== (x.tj || "")) continue;
    const a = minutos(x.h), b = minutos(p.h);
    if (a == null || b == null || Math.abs(a - b) <= 3) return p;
  }
  return null;
}

/* ── Diccionario automático ─────────────────────────────────────────────── */
// Cada comercio se clasifica UNA vez y queda para todos. La IA recibe tandas de hasta 80
// comercios por llamada; si falla, la clave queda con la regla y se reintenta de noche.
const SUBS: Record<string, string[]> = {
  super: ["supermercado", "conveniencia", "mayoreo", "mercado o tienda local", "panadería o carnicería"],
  comida: ["restaurante", "bar o antro", "café", "comida rápida", "taquería o antojitos", "a domicilio", "postres"],
  transporte: ["gasolina", "apps de viaje", "estacionamiento", "casetas", "transporte público", "mantenimiento de auto"],
  suscripciones: ["streaming", "música", "software o IA", "gimnasio", "otra suscripción"],
  entretenimiento: ["cine", "eventos y conciertos", "videojuegos", "actividades y paseos"],
  apuestas: ["apuestas deportivas", "casino"],
  salud: ["farmacia", "médico", "dentista", "laboratorio", "óptica"],
  servicios: ["luz, agua o gas", "teléfono e internet", "renta y hogar", "seguros", "escuela", "gobierno", "cuidado personal", "lavandería"],
  compras: ["ropa y calzado", "electrónica", "hogar y ferretería", "tienda en línea", "departamental", "regalos y flores", "mascotas", "belleza"],
  viajes: ["hospedaje", "vuelos", "agencia o tour"],
  otros: ["persona", "no identificado"],
};
const ESENCIAL_POR_DEFECTO: Record<string, boolean> = { super: true, transporte: true, salud: true, servicios: true, comida: false, suscripciones: false, entretenimiento: false, apuestas: false, compras: false, viajes: false, otros: false };

interface Clasif { cat: string; sub?: string; esencial?: boolean; nombre?: string; confianza?: number }

async function clasificarConIA(lote: { clave: string; ejemplo: string; pista: string }[]): Promise<Record<string, Clasif> | null> {
  const llave = Deno.env.get("GEMINI_API_KEY");
  if (!llave || !lote.length) return null;
  const guia = Object.entries(SUBS).map(([c, s]) => `${c}: ${s.join(" | ")}`).join("\n");
  const lista = lote.map((p, i) => `${i}. ${p.ejemplo}${p.pista !== "otros" ? ` (pista: ${p.pista})` : ""}`).join("\n");
  const prompt = `Clasificas gastos de tarjetas bancarias en México (Santander). Cada línea es un comercio tal cual aparece en el aviso del banco; puede venir truncado o con prefijos de pasarelas de pago (MERCADOPAGO*, CLIP MX*, NETPAY*, CONEKTA*, BPK*, SQ*, LKL*). La «pista» es una regla automática que puede estar mal.

Categorías y subcategorías permitidas (usa exactamente estos textos):
${guia}

Para cada comercio responde:
- cat: una categoría de la lista.
- sub: una subcategoría de esa categoría.
- esencial: true si es un gasto necesario (súper, gasolina, farmacia, servicios, renta, escuela), false si es un gusto o algo evitable (restaurantes, bares, antojos, apuestas, entretenimiento, ropa, gadgets).
- nombre: nombre limpio y corto del comercio como lo diría una persona (ej. "OXXO", "Starbucks", "Taquería El Pastor"); sin prefijos de pasarela ni números de sucursal.
- confianza: 0 a 1, qué tan seguro estás.
Si parece nombre de una persona (pago por Mercado Pago a alguien) y no hay más pistas: cat "otros", sub "persona".

Responde SOLO un arreglo JSON de objetos {"i","cat","sub","esencial","nombre","confianza"}.

${lista}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${llave}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
    const out: Record<string, Clasif> = {};
    for (const x of Array.isArray(arr) ? arr : []) {
      const p = lote[x.i];
      if (!p || !SUBS[x.cat]) continue;
      out[p.clave] = {
        cat: x.cat,
        sub: SUBS[x.cat].includes(x.sub) ? x.sub : undefined,
        esencial: typeof x.esencial === "boolean" ? x.esencial : ESENCIAL_POR_DEFECTO[x.cat],
        nombre: typeof x.nombre === "string" ? x.nombre.slice(0, 40) : undefined,
        confianza: typeof x.confianza === "number" ? Math.max(0, Math.min(1, x.confianza)) : undefined,
      };
    }
    return out;
  } catch { return null; }
}

/** Manda a la IA, en tandas, las claves que aún no ha visto. Devuelve cuántas clasificó. */
async function pasarPorIA(pendientes: { clave: string; ejemplo: string; pista: string }[], maxLlamadas: number): Promise<number> {
  let hechas = 0;
  for (let i = 0, llamadas = 0; i < pendientes.length && llamadas < maxLlamadas; i += 80, llamadas++) {
    const lote = pendientes.slice(i, i + 80);
    let r = await clasificarConIA(lote);
    if (!r) { await espera(12000); r = await clasificarConIA(lote); } // límite por minuto del plan gratis
    const filas = lote.map((p) => {
      const c = r?.[p.clave];
      return c
        ? { clave: p.clave, cat: c.cat, sub: c.sub ?? null, esencial: c.esencial ?? null, nombre: c.nombre ?? null, confianza: c.confianza ?? null, fuente: "ia", ia: true, ejemplo: p.ejemplo }
        : { clave: p.clave, cat: p.pista, fuente: "regla", ia: false, ejemplo: p.ejemplo, esencial: ESENCIAL_POR_DEFECTO[p.pista] ?? null };
    });
    // Los que la IA no devolvió suman un intento (se reintentan de noche, máximo 3 veces)
    const { data: previos } = await sb.from("diccionario").select("clave,intentos").in("clave", lote.map((p) => p.clave));
    const intentos = Object.fromEntries((previos || []).map((x) => [x.clave, x.intentos]));
    await sb.from("diccionario").upsert(filas.map((f) => (f.ia ? f : { ...f, intentos: (intentos[f.clave] || 0) + 1 })), { onConflict: "clave" });
    hechas += filas.filter((f) => f.ia).length;
    if (!r) break; // la IA no responde: no insistir en esta pasada
  }
  return hechas;
}

/** Pasada nocturna: claves que la IA no pudo ver (máx. 3 intentos, 4 llamadas por noche). */
async function repasoNocturno() {
  const { data } = await sb.from("diccionario").select("clave,ejemplo,cat").eq("ia", false).lt("intentos", 3).limit(320);
  if (!data?.length) return 0;
  return pasarPorIA(data.map((d) => ({ clave: d.clave, ejemplo: d.ejemplo || d.clave.slice(2), pista: d.cat })), 4);
}

/* ── Un usuario ─────────────────────────────────────────────────────────── */
async function todosLosVistos(uid: string): Promise<Set<string>> {
  const s = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data } = await sb.from("correos").select("msg_id").eq("user_id", uid).range(desde, desde + 999);
    for (const d of data || []) s.add(d.msg_id);
    if (!data || data.length < 1000) break;
  }
  return s;
}

async function sincronizarUsuario(uid: string, lote: number) {
  const at = await accesoGmail(uid);
  if (!at) return { error: "reconectar", pendientes: 0, nuevos: 0 };
  // Hasta terminar el historial completo se lista todo; después, sólo los días recientes.
  const { data: perfil } = await sb.from("perfiles").select("historial_completo").eq("user_id", uid).maybeSingle();
  let dias: number | null = null;
  if (perfil?.historial_completo) {
    const { data: ult } = await sb.from("movimientos").select("f").eq("user_id", uid).order("f", { ascending: false }).limit(1);
    dias = ult?.length ? Math.max(10, Math.ceil((Date.now() - Date.parse(ult[0].f)) / 864e5) + 4) : 30;
  }
  const ids = await listarIds(at, consultaGmail(dias));
  const vistos = await todosLosVistos(uid);
  const nuevos = ids.filter((i) => !vistos.has(i));
  const tanda = nuevos.slice(0, lote);
  const correos = await traer(at, tanda);

  const movs: Mov[] = [];
  const estados: { user_id: string; msg_id: string; estado: string }[] = [];
  for (const c of correos) {
    const m = parsear(c.texto, c.id, c.asunto);
    if (!m) { estados.push({ user_id: uid, msg_id: c.id, estado: "no" }); continue; }
    m.clave = claveDe(m);
    movs.push(m);
  }
  // Duplicados contra lo ya guardado de esos días y dentro de la tanda (A primero)
  const fechas = [...new Set(movs.filter((m) => m.tipo === "compra").map((m) => m.f))];
  const previos: Mov[] = [];
  for (let i = 0; i < fechas.length; i += 100) {
    const { data } = await sb.from("movimientos").select("id,f,h,m,tj,fmt").eq("user_id", uid).eq("tipo", "compra").in("f", fechas.slice(i, i + 100));
    for (const d of data || []) previos.push({ ...d, m: Number(d.m), tipo: "compra", c: "" } as Mov);
  }
  const orden = { A: 0, D: 1, C: 2, B: 3 } as Record<string, number>;
  movs.sort((a, b) => (orden[a.fmt || "A"] ?? 9) - (orden[b.fmt || "A"] ?? 9));
  const guardar: Mov[] = [];
  for (const m of movs) {
    if (m.tipo === "compra" && duplicadoDe(m, previos)) { estados.push({ user_id: uid, msg_id: m.id, estado: "dup" }); continue; }
    if (m.tipo === "compra") previos.push(m);
    guardar.push(m);
    estados.push({ user_id: uid, msg_id: m.id, estado: "ok" });
  }

  if (guardar.length) {
    const filas = guardar.map((m) => ({ user_id: uid, id: m.id, f: m.f, h: m.h || null, m: m.m, tipo: m.tipo, c: m.c, tj: m.tj || null, clave: m.clave!, cat_auto: m.cat_auto || null, fmt: m.fmt || null, extra: m.extra || null }));
    const { error } = await sb.from("movimientos").upsert(filas, { onConflict: "user_id,id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  if (estados.length) await sb.from("correos").upsert(estados, { onConflict: "user_id,msg_id", ignoreDuplicates: true });

  const pendientes = Math.max(0, nuevos.length - correos.length);
  const cambios: Record<string, unknown> = { ultima_sync: new Date().toISOString(), sync_pendientes: pendientes, sync_estado: "ok", gmail_conectado: true };
  if (dias === null && pendientes === 0) cambios.historial_completo = true;
  await sb.from("perfiles").update(cambios).eq("user_id", uid);
  return { nuevos: guardar.length, pendientes, revisados: correos.length, total_correos: ids.length };
}

/** Comercios del usuario que aún no están en el diccionario: se clasifican juntos, en tandas de 80. */
async function clasificarUsuario(uid: string, maxLlamadas: number) {
  const movs: { clave: string; c: string; tipo: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await sb.from("movimientos").select("clave,c,tipo").eq("user_id", uid).eq("tipo", "compra").range(desde, desde + 999);
    movs.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const unicas = new Map<string, string>();
  for (const m of movs) if (!unicas.has(m.clave)) unicas.set(m.clave, m.c);
  const claves = [...unicas.keys()];
  const ya = new Set<string>();
  for (let i = 0; i < claves.length; i += 200) {
    const { data } = await sb.from("diccionario").select("clave").in("clave", claves.slice(i, i + 200));
    for (const d of data || []) ya.add(d.clave);
  }
  const nuevas = claves.filter((k) => !ya.has(k)).map((k) => ({ clave: k, ejemplo: unicas.get(k)!, pista: categorizarRegla(unicas.get(k)!) }));
  const hechas = nuevas.length ? await pasarPorIA(nuevas, maxLlamadas) : 0;
  return { clasificados: hechas, restantes: Math.max(0, nuevas.length - Math.min(nuevas.length, maxLlamadas * 80)) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.headers.get("x-cron") && req.headers.get("x-cron") === Deno.env.get("CRON_SECRET")) {
      const cuerpo = await req.json().catch(() => ({}));
      if (cuerpo.accion === "repaso") return json({ repaso: await repasoNocturno() });
      const t0 = Date.now();
      const { data: us } = await sb.from("perfiles").select("user_id").eq("gmail_conectado", true).order("ultima_sync", { ascending: true, nullsFirst: true });
      const hechos: unknown[] = [];
      for (const u of us || []) {
        if (Date.now() - t0 > 100_000) break;
        try {
          const r = await sincronizarUsuario(u.user_id, 60);
          if (!r.error && r.nuevos) await clasificarUsuario(u.user_id, 1); // sólo si llegó algo nuevo
          hechos.push(r);
        } catch (e) { hechos.push({ error: String(e) }); }
      }
      // Una vez por noche (3 a. m. de México): lo que la IA no pudo ver.
      const repaso = new Date().getUTCHours() === 9 ? await repasoNocturno() : 0;
      return json({ usuarios: hechos.length, repaso });
    }
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Inicia sesión" }, 401);
    const { accion } = await req.json().catch(() => ({}));
    if (accion === "clasificar") return json(await clasificarUsuario(u.user.id, 2));
    return json(await sincronizarUsuario(u.user.id, 100));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
