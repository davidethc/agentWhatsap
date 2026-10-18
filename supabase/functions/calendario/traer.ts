// Google Calendar → Panel (pull incremental). TK-16 · docs/crm/plan.md §6.
// events.list con syncToken: la primera vez trae 30 días atrás y 90 adelante; después solo lo que
// cambió. Cada evento se normaliza y lo aplica la función SQL aplicar_evento_calendario (que decide si
// la cita se crea, se mueve, se cancela, se liga o queda sin vincular). Sin dependencias de Deno.

import { ClienteCalendario, ErrorGoogle, type EventoGoogle } from "./google.ts";

/** Evento listo para la base (lo que recibe aplicar_evento_calendario). */
export interface EventoCalendario {
  gcal_event_id: string;
  etag: string | null;
  estado: "activo" | "cancelado";
  inicio: string | null;
  fin: string | null;
  resumen: string | null;
  descripcion: string | null;
  crm_cita_id: string | null;
}

export interface RepoPull {
  leerSyncToken(calendarioId: string): Promise<string | null>;
  /** Con null se borra el token (Google respondió 410). */
  guardarSyncToken(calendarioId: string, token: string | null): Promise<void>;
  aplicarEvento(evento: EventoCalendario): Promise<{ accion: string }>;
  registrarError(detalle: Record<string, unknown>): Promise<void>;
}

export interface ResumenPull {
  eventos: number;
  /** Cuántas veces salió cada acción de aplicar_evento_calendario. */
  acciones: Record<string, number>;
  /** Eventos que no se mandaron a la base: de día entero, «Disponible» o sin id. */
  ignorados: number;
  fallos: number;
  /** true si Google dijo 410 y se volvió a sincronizar desde cero. */
  resincronizado: boolean;
  tokenGuardado: boolean;
}

/**
 * Normaliza un evento de Google. null = ignorarlo: de día entero (solo trae `date`) o marcado como
 * «Disponible» (transparent). Un evento borrado llega mínimo (id y status) y siempre pasa.
 */
export function normalizarEvento(e: EventoGoogle): EventoCalendario | null {
  if (!e.id) return null;
  const base = {
    gcal_event_id: e.id,
    etag: e.etag ?? null,
    resumen: e.summary ?? null,
    descripcion: e.description ?? null,
    crm_cita_id: e.extendedProperties?.private?.crm_cita_id ?? null,
  };
  if (e.status === "cancelled") return { ...base, estado: "cancelado", inicio: null, fin: null };
  if (e.transparency === "transparent") return null;
  if (!e.start?.dateTime || !e.end?.dateTime) return null; // de día entero
  return { ...base, estado: "activo", inicio: e.start.dateTime, fin: e.end.dateTime };
}

const DIA_MS = 86_400_000;

export async function traer(
  cal: ClienteCalendario,
  repo: RepoPull,
  calendarioId: string,
  opciones: { ahoraMs?: () => number; diasAtras?: number; diasAdelante?: number } = {},
): Promise<ResumenPull> {
  const ahora = opciones.ahoraMs ?? (() => Date.now());
  const resumen: ResumenPull = {
    eventos: 0, acciones: {}, ignorados: 0, fallos: 0, resincronizado: false, tokenGuardado: false,
  };

  let token = await repo.leerSyncToken(calendarioId);
  // Como mucho una resincronización completa por llamada: si Google vuelve a dar 410 es un error real.
  for (let intento = 0; intento < 2; intento++) {
    try {
      await pasada(cal, repo, calendarioId, token, resumen, ahora(), opciones.diasAtras ?? 30, opciones.diasAdelante ?? 90);
      return resumen;
    } catch (e) {
      if (e instanceof ErrorGoogle && e.estado === 410 && token) {
        // El syncToken caducó: se borra y se baja todo otra vez (aplicar es idempotente).
        await repo.guardarSyncToken(calendarioId, null);
        token = null;
        resumen.resincronizado = true;
        resumen.eventos = 0;
        resumen.ignorados = 0;
        resumen.acciones = {};
        resumen.fallos = 0;
        continue;
      }
      throw e;
    }
  }
  return resumen;
}

async function pasada(
  cal: ClienteCalendario,
  repo: RepoPull,
  calendarioId: string,
  syncToken: string | null,
  resumen: ResumenPull,
  ahoraMs: number,
  diasAtras: number,
  diasAdelante: number,
): Promise<void> {
  let pageToken: string | undefined;
  let siguienteToken: string | undefined;
  do {
    const pagina = await cal.listar({
      syncToken: syncToken ?? undefined,
      timeMin: new Date(ahoraMs - diasAtras * DIA_MS).toISOString(),
      timeMax: new Date(ahoraMs + diasAdelante * DIA_MS).toISOString(),
      pageToken,
    });
    for (const crudo of pagina.items ?? []) {
      resumen.eventos++;
      const ev = normalizarEvento(crudo);
      if (!ev) {
        resumen.ignorados++;
        continue;
      }
      try {
        const { accion } = await repo.aplicarEvento(ev);
        resumen.acciones[accion] = (resumen.acciones[accion] ?? 0) + 1;
      } catch (e) {
        resumen.fallos++;
        const mensaje = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        try {
          // Solo el id del evento y el motivo: sin título ni descripción (pueden traer nombres).
          await repo.registrarError({ tipo: "pull", gcal_event_id: ev.gcal_event_id, error: mensaje });
        } catch (e2) {
          console.error("calendario: no se pudo anotar el fallo del evento", ev.gcal_event_id, e2);
        }
      }
    }
    pageToken = pagina.nextPageToken;
    siguienteToken = pagina.nextSyncToken ?? siguienteToken;
  } while (pageToken);

  // Si algún evento falló NO se avanza el token: la próxima vuelta lo vuelve a intentar.
  if (resumen.fallos === 0 && siguienteToken) {
    await repo.guardarSyncToken(calendarioId, siguienteToken);
    resumen.tokenGuardado = true;
  }
}
