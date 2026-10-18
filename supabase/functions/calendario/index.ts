// Edge Function «calendario»: sincroniza las citas del Eli Panel con Google Calendar.
// Plan §6 · ADR 0009. La llaman el trigger de citas (pg_net) y el cron de 2 minutos, con la clave de
// servicio en Authorization. verify_jwt = false en config.toml porque las claves nuevas de Supabase no
// son JWT: aquí se compara la clave a mano.
//
// POST {"accion": "push"}   → envía a Calendar las citas pendientes (TK-15)
//      {"accion": "pull"}   → trae los cambios de Calendar con syncToken (TK-16)
//      {"accion": "sync"}   → pull y luego push (el cron de 2 minutos; es el valor por defecto)
// Respuestas: 200 {ok, configurado, ...} · 401 sin clave · 405 método · 500 error interno.
//
// Si faltan los secretos GOOGLE_SA_JSON o GCAL_CALENDAR_ID termina SIN error (200, configurado:false),
// deja constancia en errores_integracion y las citas siguen «pendiente» hasta que se configuren.

import { ClienteCalendario, leerConfig } from "./google.ts";
import { empujar } from "./empujar.ts";
import { traer } from "./traer.ts";
import { RepoSupabase } from "./repo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

/** Compara en tiempo constante. */
function igual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST" });

  const recibida = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!SERVICE_KEY || !recibida || !igual(recibida, SERVICE_KEY)) {
    return json(401, { ok: false, error: "No autorizado" });
  }

  const cuerpo = await req.json().catch(() => ({}));
  const accion = typeof cuerpo?.accion === "string" ? cuerpo.accion : "sync";
  if (!["push", "pull", "sync"].includes(accion)) {
    return json(400, { ok: false, error: "accion debe ser push, pull o sync" });
  }

  const repo = new RepoSupabase(SUPABASE_URL, SERVICE_KEY);

  const lectura = leerConfig((n) => Deno.env.get(n));
  if (!lectura.ok) {
    // Sin secretos no es un error: el usuario los pone al final. Se deja constancia (una vez por hora).
    try {
      await repo.registrarError({ tipo: "sin_configurar", faltan: lectura.faltan, motivo: lectura.motivo }, 60);
    } catch (e) {
      console.error("calendario: no se pudo anotar que falta la configuración", e);
    }
    return json(200, { ok: true, configurado: false, faltan: lectura.faltan });
  }

  try {
    const cal = new ClienteCalendario(lectura.config);
    // «sync» = primero se traen los cambios de Calendar y luego se envían los del panel.
    const pull = accion === "push" ? undefined : await traer(cal, repo, lectura.config.calendarioId);
    const push = accion === "pull" ? undefined : await empujar(cal, repo);
    return json(200, { ok: true, configurado: true, pull, push });
  } catch (e) {
    console.error("calendario: fallo inesperado", e);
    try {
      await repo.registrarError({ tipo: "calendario", error: String(e).slice(0, 300) }, 5);
    } catch { /* nada más que hacer */ }
    return json(500, { ok: false, error: "Error al sincronizar" });
  }
});
