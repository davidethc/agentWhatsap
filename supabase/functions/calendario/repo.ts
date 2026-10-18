// Acceso a la base desde la función «calendario»: llama a las funciones SQL con la clave de servicio.
// Solo web estándar (fetch): se prueba en Node con un PostgREST falso o con el Supabase local.

import type { CitaPendiente, RepoPush } from "./empujar.ts";
import type { EventoCalendario, RepoPull } from "./traer.ts";

export class RepoSupabase implements RepoPush, RepoPull {
  url: string;
  clave: string;
  fetchFn: typeof fetch;

  constructor(url: string, claveServicio: string, fetchFn: typeof fetch = fetch) {
    this.url = url.replace(/\/$/, "");
    this.clave = claveServicio;
    this.fetchFn = fetchFn;
  }

  /** POST /rest/v1/rpc/<nombre>. Lanza si la base responde un error. */
  async rpc<T = unknown>(nombre: string, args: Record<string, unknown> = {}): Promise<T> {
    const r = await this.fetchFn(`${this.url}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: {
        apikey: this.clave,
        Authorization: `Bearer ${this.clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const texto = await r.text();
    if (!r.ok) {
      let msg = texto.slice(0, 300);
      try {
        msg = JSON.parse(texto)?.message ?? msg;
      } catch { /* queda el texto */ }
      throw new Error(`${nombre}: ${r.status} ${msg}`);
    }
    return (texto ? JSON.parse(texto) : null) as T;
  }

  async citasPendientes(limite: number): Promise<CitaPendiente[]> {
    return await this.rpc<CitaPendiente[]>("calendario_citas_pendientes", { p_limite: limite });
  }

  async marcarPush(
    citaId: number,
    r: { gcal_event_id?: string | null; gcal_etag?: string | null; error?: string | null },
  ): Promise<void> {
    await this.rpc("calendario_marcar_push", {
      p_cita_id: citaId,
      p_gcal_event_id: r.gcal_event_id ?? null,
      p_gcal_etag: r.gcal_etag ?? null,
      p_error: r.error ?? null,
    });
  }

  async registrarError(detalle: Record<string, unknown>, dedupeMin = 0): Promise<void> {
    await this.rpc("calendario_registrar_error", { p_detalle: detalle, p_dedupe_min: dedupeMin });
  }

  // ── Pull (TK-16) ──
  async leerSyncToken(calendarioId: string): Promise<string | null> {
    return await this.rpc<string | null>("calendario_leer_token", { p_calendario_id: calendarioId });
  }

  async guardarSyncToken(calendarioId: string, token: string | null): Promise<void> {
    await this.rpc("calendario_guardar_token", { p_calendario_id: calendarioId, p_token: token });
  }

  async aplicarEvento(evento: EventoCalendario): Promise<{ accion: string }> {
    return await this.rpc<{ accion: string }>("aplicar_evento_calendario", { p_evento: evento });
  }
}
