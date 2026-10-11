// Panel → Google Calendar (push). TK-15 · docs/crm/plan.md §6.
// Toma las citas con sync <> 'ok' y crea, mueve o borra su evento. Si algo falla, la cita queda en
// sync = 'error' con el detalle y el cron la reintenta. Sin dependencias de Deno: se prueba en Node.

import { ClienteCalendario, ErrorGoogle, type EventoGoogle } from "./google.ts";

export const ZONA = "America/Guayaquil";

/** Cita pendiente de enviar, con los datos del paciente que van al evento (nombre, teléfono, servicio). */
export interface CitaPendiente {
  id: number;
  paciente_id: number | null;
  gcal_event_id: string | null;
  gcal_etag: string | null;
  inicia_en: string;
  termina_en: string;
  servicio: string | null;
  estado: "agendada" | "asistio" | "no_asistio" | "cancelada";
  nombre: string | null;
  telefono: string | null;
}

export interface RepoPush {
  citasPendientes(limite: number): Promise<CitaPendiente[]>;
  /** sync = 'ok' (con los ids de Google) o sync = 'error' (con el detalle). */
  marcarPush(
    citaId: number,
    r: { gcal_event_id?: string | null; gcal_etag?: string | null; error?: string | null },
  ): Promise<void>;
  /** errores_integracion (origen calendario). Sin teléfono ni nombre. */
  registrarError(detalle: Record<string, unknown>): Promise<void>;
}

/** Qué hacer cuando Calendar cambió el evento a la vez que el panel (412) o ya no existe (404/410). */
export type AlConflicto = (cita: CitaPendiente, evento: EventoGoogle | null) => Promise<void>;

export interface ResumenPush {
  procesadas: number;
  ok: number;
  error: number;
  conflicto: number;
}

/**
 * Id propio y determinista (Google acepta a-v y 0-9, mínimo 5): si el evento se creó pero la base no
 * alcanzó a guardarlo, el reintento recibe 409 en vez de duplicar la cita.
 */
export const idEvento = (citaId: number): string => `crm${String(citaId).padStart(8, "0")}`;

/** Evento para Google. La descripción lleva nombre, teléfono y servicio: nada clínico. */
export function cuerpoEvento(c: CitaPendiente): EventoGoogle {
  const nombre = c.nombre?.trim() || "Paciente";
  const servicio = c.servicio?.trim() || null;
  const privado: Record<string, string> = { crm_cita_id: String(c.id) };
  if (c.paciente_id != null) privado.crm_paciente_id = String(c.paciente_id);
  return {
    summary: `🦷 ${servicio ?? "Cita"} - ${nombre}`,
    description: [
      `Paciente: ${nombre}`,
      c.telefono ? `Tel: ${c.telefono}` : null,
      `Servicio: ${servicio ?? "por definir"}`,
      "Agendado desde el Eli Panel",
    ].filter(Boolean).join("\n"),
    start: { dateTime: c.inicia_en, timeZone: ZONA },
    end: { dateTime: c.termina_en, timeZone: ZONA },
    extendedProperties: { private: privado },
  };
}

const yaNoExiste = (e: unknown) => e instanceof ErrorGoogle && (e.estado === 404 || e.estado === 410);

type Resultado =
  | { tipo: "ok"; gcal_event_id: string | null; gcal_etag: string | null }
  | { tipo: "conflicto"; evento: EventoGoogle | null };

async function empujarUna(cal: ClienteCalendario, c: CitaPendiente): Promise<Resultado> {
  // Cancelar en el panel → se borra el evento (si ya no existe, mejor).
  if (c.estado === "cancelada") {
    if (c.gcal_event_id) {
      try {
        await cal.borrar(c.gcal_event_id);
      } catch (e) {
        if (!yaNoExiste(e)) throw e;
      }
    }
    return { tipo: "ok", gcal_event_id: c.gcal_event_id, gcal_etag: null };
  }

  // Cita nueva → se crea el evento con id propio.
  if (!c.gcal_event_id) {
    const id = idEvento(c.id);
    try {
      const ev = await cal.insertar({ id, status: "confirmed", ...cuerpoEvento(c) });
      return { tipo: "ok", gcal_event_id: ev.id ?? id, gcal_etag: ev.etag ?? null };
    } catch (e) {
      if (!(e instanceof ErrorGoogle) || e.estado !== 409) throw e;
      // Ya existía (reintento tras un fallo al guardar, o un evento borrado que se reabre): se adopta.
      const ev = await cal.actualizar(id, { status: "confirmed", ...cuerpoEvento(c) });
      return { tipo: "ok", gcal_event_id: ev.id ?? id, gcal_etag: ev.etag ?? null };
    }
  }

  // Cita con evento → se mueve. If-Match con el etag que guardamos: si Calendar cambió, 412.
  try {
    const ev = await cal.actualizar(c.gcal_event_id, cuerpoEvento(c), c.gcal_etag);
    return { tipo: "ok", gcal_event_id: ev.id ?? c.gcal_event_id, gcal_etag: ev.etag ?? null };
  } catch (e) {
    if (e instanceof ErrorGoogle && e.estado === 412) {
      let actual: EventoGoogle | null = null;
      try {
        actual = await cal.obtener(c.gcal_event_id);
      } catch (e2) {
        if (!yaNoExiste(e2)) throw e2;
      }
      return { tipo: "conflicto", evento: actual };
    }
    if (yaNoExiste(e)) return { tipo: "conflicto", evento: null };
    throw e;
  }
}

/** Por defecto un conflicto solo se anota (TK-17 enchufa aquí «gana Calendar»). */
const anotarConflicto: AlConflicto = async () => {};

export async function empujar(
  cal: ClienteCalendario,
  repo: RepoPush,
  opciones: { limite?: number; alConflicto?: AlConflicto } = {},
): Promise<ResumenPush> {
  const alConflicto = opciones.alConflicto ?? anotarConflicto;
  const citas = await repo.citasPendientes(opciones.limite ?? 25);
  const resumen: ResumenPush = { procesadas: citas.length, ok: 0, error: 0, conflicto: 0 };

  for (const c of citas) {
    try {
      const r = await empujarUna(cal, c);
      if (r.tipo === "ok") {
        await repo.marcarPush(c.id, { gcal_event_id: r.gcal_event_id, gcal_etag: r.gcal_etag });
        resumen.ok++;
      } else {
        resumen.conflicto++;
        await alConflicto(c, r.evento);
        if (alConflicto === anotarConflicto) {
          await repo.marcarPush(c.id, {
            error: "Calendar cambió este evento a la vez: pendiente de resolver",
          });
        }
      }
    } catch (e) {
      resumen.error++;
      const estado = e instanceof ErrorGoogle ? e.estado : undefined;
      const mensaje = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      try {
        await repo.marcarPush(c.id, { error: mensaje });
        await repo.registrarError({ tipo: "push", cita_id: c.id, estado_http: estado, error: mensaje });
      } catch (e2) {
        console.error("calendario: no se pudo guardar el error de la cita", c.id, e2);
      }
    }
  }
  return resumen;
}
