// Borra la cuenta del usuario que lo pide: perfil, movimientos, correos y permiso de Gmail (en cascada).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { CORS, descifrarTexto, json } from "../_comun/finanzas.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Inicia sesión" }, 401);
  // Revoca el permiso de Gmail en Google (si falla, se borra igual)
  try {
    const { data } = await sb.from("tokens").select("refresh_cifrado").eq("user_id", u.user.id).maybeSingle();
    if (data) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(await descifrarTexto(data.refresh_cifrado)), { method: "POST" });
  } catch { /* nada */ }
  const { error } = await sb.auth.admin.deleteUser(u.user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
