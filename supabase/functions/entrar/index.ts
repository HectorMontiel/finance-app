// Entrar con Google: cambia el código de Google por tokens, crea o encuentra al usuario,
// guarda cifrado el permiso de Gmail y devuelve un token de un solo uso para abrir la sesión.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { CORS, cifrarTexto, json } from "../_comun/finanzas.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CLIENTE = Deno.env.get("GOOGLE_CLIENT_ID")!;
const PERMITIDOS = ["https://hectormontiel.github.io/finance-app/", "http://localhost:8650/"];

function payloadJWT(t: string) {
  const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p + "=".repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0))));
}

async function buscarUsuario(email: string): Promise<string | null> {
  const { data } = await sb.from("perfiles").select("user_id").eq("email", email).maybeSingle();
  if (data) return data.user_id;
  for (let page = 1; page < 50; page++) {
    const { data: l } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = l?.users?.find((x) => (x.email || "").toLowerCase() === email);
    if (u) return u.id;
    if (!l || l.users.length < 200) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { code, redirect_uri, pareo, accion } = await req.json();
    const pareoValido = typeof pareo === "string" && /^[a-f0-9]{32}$/.test(pareo);

    // La app instalada pregunta si ya está su pase (Google se abrió en otra ventana del iPhone)
    if (accion === "recoger") {
      if (!pareoValido) return json({ error: "Solicitud no válida" }, 400);
      await sb.from("pareos").delete().lt("creado", new Date(Date.now() - 10 * 60_000).toISOString());
      const { data } = await sb.from("pareos").select("token_hash").eq("id", pareo).maybeSingle();
      if (!data) return json({ pendiente: true });
      await sb.from("pareos").delete().eq("id", pareo);
      return json({ token_hash: data.token_hash });
    }
    if (!code || !PERMITIDOS.includes(redirect_uri)) return json({ error: "Solicitud no válida" }, 400);
    const secreto = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!secreto) return json({ error: "Falta configurar GOOGLE_CLIENT_SECRET en Supabase" }, 500);

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ code, client_id: CLIENTE, client_secret: secreto, redirect_uri, grant_type: "authorization_code" }),
    });
    const tk = await r.json();
    if (!r.ok || !tk.id_token) return json({ error: tk.error_description || tk.error || "Google no aceptó el inicio de sesión" }, 400);

    const p = payloadJWT(tk.id_token);
    if (p.aud !== CLIENTE || !p.email || p.email_verified === false) return json({ error: "Cuenta de Google no válida" }, 400);
    const email = String(p.email).toLowerCase();

    let uid = await buscarUsuario(email);
    if (!uid) {
      const c = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre: p.name || "" } });
      if (c.error) return json({ error: c.error.message }, 500);
      uid = c.data.user!.id;
    }
    await sb.from("perfiles").upsert({ user_id: uid, email, nombre: p.given_name || p.name || "" }, { onConflict: "user_id", ignoreDuplicates: false });

    const conGmail = String(tk.scope || "").includes("gmail.readonly");
    if (tk.refresh_token && conGmail) {
      await sb.from("tokens").upsert({ user_id: uid, refresh_cifrado: await cifrarTexto(tk.refresh_token), actualizado: new Date().toISOString() });
      await sb.from("perfiles").update({ gmail_conectado: true, sync_estado: "listo" }).eq("user_id", uid);
    }
    const { data: tok } = await sb.from("tokens").select("user_id").eq("user_id", uid).maybeSingle();

    const link = await sb.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) return json({ error: link.error.message }, 500);
    // Si el regreso de Google cayó en otra ventana, se guarda el pase para que la app lo recoja.
    if (pareoValido) {
      await sb.from("pareos").upsert({ id: pareo, token_hash: link.data.properties.hashed_token, creado: new Date().toISOString() });
      return json({ pareo: true, gmail: !!tok });
    }
    return json({ token_hash: link.data.properties.hashed_token, gmail: !!tok });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
