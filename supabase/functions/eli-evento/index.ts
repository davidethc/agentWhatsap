// Edge Function «eli-evento»: entrada del contrato Eli → CRM (docs/crm/plan.md §5).
// n8n hace POST con el encabezado x-eli-secreto. Valida el JSON y llama a
// public.registrar_evento_eli con la clave de servicio (que nunca sale de Supabase).
//
// Respuestas: 200 {ok, duplicado} · 400 JSON o datos inválidos · 401 sin secreto o incorrecto ·
// 405 método · 500 error interno (queda en errores_integracion).
// verify_jwt = false en config.toml: n8n no tiene sesión de Supabase; el secreto es la llave.

import { secretoValido, validarEvento } from "./validar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRETO = Deno.env.get("ELI_EVENTO_SECRETO") ?? "";

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

async function rest(ruta: string, cuerpo: unknown): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(cuerpo),
  });
}

// Deja constancia del fallo (HU-13) sin datos del paciente: ni teléfono ni texto.
async function registrarError(detalle: Record<string, unknown>) {
  try {
    await rest("errores_integracion", { origen: "eli", detalle });
  } catch (e) {
    console.error("eli-evento: no se pudo guardar el error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST" });

  if (!SECRETO) {
    console.error("eli-evento: falta ELI_EVENTO_SECRETO");
    return json(500, { ok: false, error: "Función sin configurar" });
  }
  if (!secretoValido(req.headers.get("x-eli-secreto"), SECRETO)) {
    return json(401, { ok: false, error: "No autorizado" });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return json(400, { ok: false, error: "JSON inválido" });
  }

  const v = validarEvento(cuerpo);
  if (!v.ok) return json(400, { ok: false, error: v.error });

  // Referencias útiles para depurar, sin datos personales.
  const ref = {
    tipo: v.evento.tipo,
    message_id: v.evento.message_id,
    execution_id: v.evento.execution_id,
    gcal_event_id: v.evento.gcal_event_id,
  };

  try {
    const r = await rest("rpc/registrar_evento_eli", { p_evento: v.evento });
    const datos = await r.json().catch(() => null);
    if (r.ok) return json(200, { ok: true, duplicado: Boolean(datos?.duplicado) });

    // 22023 = datos que la base rechaza (teléfono no válido, falta un campo…).
    if (datos?.code === "22023") return json(400, { ok: false, error: datos.message });

    await registrarError({ ...ref, estado_http: r.status, codigo: datos?.code, error: datos?.message });
    return json(500, { ok: false, error: "Error al guardar el evento" });
  } catch (e) {
    await registrarError({ ...ref, error: String(e) });
    return json(500, { ok: false, error: "Error al guardar el evento" });
  }
});
