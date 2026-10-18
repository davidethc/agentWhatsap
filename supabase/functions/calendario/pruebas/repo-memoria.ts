// Repositorio en memoria para probar la lógica de sincronización sin base de datos.
import type { CitaPendiente, RepoPush } from "../empujar.ts";

export interface CitaMemoria extends CitaPendiente {
  sync: "ok" | "pendiente" | "error";
  sync_error: string | null;
}

export class RepoMemoria implements RepoPush {
  citas: CitaMemoria[] = [];
  errores: Array<Record<string, unknown>> = [];
  /** Hace fallar la próxima llamada a marcarPush (para probar reintentos tras un fallo al guardar). */
  fallarMarcarPush = 0;

  nueva(c: Partial<CitaMemoria> & { id: number }): CitaMemoria {
    const cita: CitaMemoria = {
      paciente_id: 7,
      gcal_event_id: null,
      gcal_etag: null,
      inicia_en: "2026-10-20T15:00:00Z",
      termina_en: "2026-10-20T16:00:00Z",
      servicio: "Limpieza",
      estado: "agendada",
      nombre: "Paciente Prueba",
      telefono: "593900000001",
      sync: "pendiente",
      sync_error: null,
      ...c,
    };
    this.citas.push(cita);
    return cita;
  }

  cita(id: number): CitaMemoria {
    const c = this.citas.find((x) => x.id === id);
    if (!c) throw new Error(`no existe la cita ${id}`);
    return c;
  }

  citasPendientes(limite: number): Promise<CitaPendiente[]> {
    return Promise.resolve(this.citas.filter((c) => c.sync !== "ok").slice(0, limite));
  }

  marcarPush(
    citaId: number,
    r: { gcal_event_id?: string | null; gcal_etag?: string | null; error?: string | null },
  ): Promise<void> {
    if (this.fallarMarcarPush > 0) {
      this.fallarMarcarPush--;
      return Promise.reject(new Error("la base no respondió"));
    }
    const c = this.cita(citaId);
    if (r.error) {
      c.sync = "error";
      c.sync_error = r.error;
    } else {
      c.sync = "ok";
      c.sync_error = null;
      c.gcal_event_id = r.gcal_event_id ?? c.gcal_event_id;
      c.gcal_etag = c.estado === "cancelada" ? null : (r.gcal_etag ?? c.gcal_etag);
    }
    return Promise.resolve();
  }

  registrarError(detalle: Record<string, unknown>): Promise<void> {
    this.errores.push(detalle);
    return Promise.resolve();
  }
}
