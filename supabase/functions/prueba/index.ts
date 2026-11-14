// Prueba de paridad del lector (sólo con la llave de servicio): recibe textos y devuelve lo que entiende.
import { categorizarRegla, claveDe, json, parsear } from "../_comun/finanzas.ts";

Deno.serve(async (req) => {
  const { casos, comercios } = await req.json();
  const movs = (casos || []).map(([t, id, a]: string[]) => { const m = parsear(t, id, a); return m ? { ...m, clave: claveDe(m) } : null; });
  const cats = (comercios || []).map((c: string) => categorizarRegla(c));
  return json({ movs, cats });
});
