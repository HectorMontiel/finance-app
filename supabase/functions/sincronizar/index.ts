// Lee los correos nuevos de Santander de cada usuario, los guarda y clasifica.
// - Con la sesión del usuario: procesa una tanda suya y dice cuántos faltan (la app repite hasta 0).
// - Con la cabecera x-cron: recorre a todos los usuarios con Gmail conectado (lo nuevo de cada uno).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { CORS, type Mov, aTexto, categorizarRegla, claveDe, consultaGmail, descifrarTexto, json, parsear } from "../_comun/finanzas.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CATS = ["super", "comida", "transporte", "suscripciones", "entretenimiento", "apuestas", "salud", "servicios", "compras", "viajes", "otros"];
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
async function clasificarConIA(pendientes: { clave: string; ejemplo: string }[]): Promise<Record<string, string>> {
  const llave = Deno.env.get("GEMINI_API_KEY");
  if (!llave || !pendientes.length) return {};
  const lista = pendientes.map((p, i) => `${i}. ${p.ejemplo}`).join("\n");
  const prompt = `Eres un clasificador de gastos de tarjetas bancarias en México. Para cada comercio (texto tal cual llega en el estado de cuenta, puede venir truncado o con prefijos de pasarelas como MERCADOPAGO*, CLIP MX*, NETPAY*), elige UNA categoría:
super = supermercado, tienda de conveniencia, abarrotes, carnicería, panadería, mercado
comida = restaurante, bar, antro, café, taquería, comida rápida, comida a domicilio
transporte = gasolina, Uber/DiDi, taxi, estacionamiento, casetas, autobús, lavado de auto
suscripciones = streaming, apps, software, servicios digitales, gimnasio
entretenimiento = cine, conciertos, boletos, videojuegos, eventos, parques
apuestas = casas de apuestas y casinos
salud = farmacia, médico, dentista, laboratorio, óptica
servicios = luz, agua, teléfono, internet, seguros, escuela, renta, trámites de gobierno, lavandería, estética
compras = ropa, tiendas departamentales, electrónica, Amazon, Mercado Libre, ferretería, regalos, flores
viajes = hoteles, Airbnb, aerolíneas, agencias de viaje
otros = sólo si de verdad no hay forma de saberlo
Si es un nombre de persona (pago a alguien por Mercado Pago) y no hay pista, usa "otros".
Responde SOLO JSON: un arreglo con objetos {"i": número, "cat": categoría}.

${lista}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${llave}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });
    if (!r.ok) return {};
    const j = await r.json();
    const arr = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
    const out: Record<string, string> = {};
    for (const x of arr) if (pendientes[x.i] && CATS.includes(x.cat)) out[pendientes[x.i].clave] = x.cat;
    return out;
  } catch { return {}; }
}

/** Pone en el diccionario las claves que aún no tiene: reglas primero, la IA para el resto. */
async function completarDiccionario(movs: { clave: string; c: string; tipo: string }[]) {
  const compras = movs.filter((m) => m.tipo === "compra" && m.clave.startsWith("C:"));
  const unicas = new Map<string, string>();
  for (const m of compras) if (!unicas.has(m.clave)) unicas.set(m.clave, m.c);
  if (!unicas.size) return;
  const claves = [...unicas.keys()];
  const ya = new Set<string>();
  for (let i = 0; i < claves.length; i += 200) {
    const { data } = await sb.from("diccionario").select("clave").in("clave", claves.slice(i, i + 200));
    for (const d of data || []) ya.add(d.clave);
  }
  const nuevas = claves.filter((k) => !ya.has(k));
  const filas: any[] = [];
  const paraIA: { clave: string; ejemplo: string }[] = [];
  for (const k of nuevas) {
    const cat = categorizarRegla(unicas.get(k)!);
    if (cat !== "otros") filas.push({ clave: k, cat, fuente: "regla", ejemplo: unicas.get(k) });
    else paraIA.push({ clave: k, ejemplo: unicas.get(k)! });
  }
  for (let i = 0; i < paraIA.length && i < 240; i += 60) {
    const tanda = paraIA.slice(i, i + 60);
    const r = await clasificarConIA(tanda);
    for (const p of tanda) if (r[p.clave]) filas.push({ clave: p.clave, cat: r[p.clave], fuente: "ia", ejemplo: p.ejemplo });
  }
  if (filas.length) await sb.from("diccionario").upsert(filas, { onConflict: "clave", ignoreDuplicates: true });
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

  await completarDiccionario(guardar as any);
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

/* Claves viejas que quedaron sin categoría (la IA falló o no había llave): reintento. */
async function repasarSinCategoria(uid: string) {
  const { data } = await sb.from("movimientos").select("clave,c,tipo").eq("user_id", uid).eq("tipo", "compra").eq("cat_auto", "otros").limit(1000);
  if (data?.length) await completarDiccionario(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.headers.get("x-cron") && req.headers.get("x-cron") === Deno.env.get("CRON_SECRET")) {
      const t0 = Date.now();
      const { data: us } = await sb.from("perfiles").select("user_id").eq("gmail_conectado", true).order("ultima_sync", { ascending: true, nullsFirst: true });
      const hechos: unknown[] = [];
      for (const u of us || []) {
        if (Date.now() - t0 > 100_000) break;
        try { hechos.push(await sincronizarUsuario(u.user_id, 60)); } catch (e) { hechos.push({ error: String(e) }); }
      }
      return json({ usuarios: hechos.length });
    }
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Inicia sesión" }, 401);
    const r = await sincronizarUsuario(u.user.id, 100);
    if (!r.error && !r.pendientes) await repasarSinCategoria(u.user.id);
    return json(r);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
