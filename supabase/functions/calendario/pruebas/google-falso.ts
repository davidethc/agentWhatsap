// Google Calendar simulado para las pruebas (TK-15 a TK-17). Nada sale a internet.
// Implementa lo que usa la función: token por cuenta de servicio (verifica la firma RS256 del JWT),
// events.list con paginación y syncToken (410 si caducó), insert (409 si el id existe), get, patch con
// If-Match (412 si el etag no coincide) y delete (el evento queda «cancelled», como en Google).

import { createServer, type IncomingMessage, type Server } from "node:http";
import { createVerify, generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { EventoGoogle } from "../google.ts";

interface Guardado extends EventoGoogle {
  id: string;
  status: string;
  etag: string;
  /** Versión global en la que cambió por última vez (base del syncToken). */
  v: number;
}

export interface Peticion {
  metodo: string;
  ruta: string;
  ifMatch?: string;
  query: Record<string, string>;
  cuerpo?: unknown;
}

const CAL = "prueba@group.calendar.google.com";

export class GoogleFalso {
  eventos = new Map<string, Guardado>();
  peticiones: Peticion[] = [];
  /** Tamaño de página de events.list (para probar la paginación). */
  tamanoPagina = 250;
  /** Próximas respuestas de error a /events* (p. ej. [{estado: 503}] o [{estado: 500}, {estado: 500}]). */
  fallos: Array<{ estado: number }> = [];
  tokensEmitidos = 0;
  #version = 0;
  #tokenMinimo = 0;
  #n = 0;
  #servidor: Server | null = null;
  #publica;
  #privadaPem: string;
  base = "";

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    this.#publica = publicKey;
    this.#privadaPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  }

  get calendarioId(): string {
    return CAL;
  }

  /** Lo que iría en GOOGLE_SA_JSON, apuntando el token a este servidor. */
  cuentaServicio() {
    return {
      type: "service_account",
      client_email: "eli-calendario@prueba.iam.gserviceaccount.com",
      private_key: this.#privadaPem,
      token_uri: `${this.base}/token`,
    };
  }

  /** `hostPublico` es como se llega al servidor desde quien lo usa (host.docker.internal desde Docker). */
  async iniciar(puerto = 0, host = "127.0.0.1", hostPublico = "127.0.0.1"): Promise<void> {
    this.#servidor = createServer((req, res) => void this.#atender(req, res));
    await new Promise<void>((ok) => this.#servidor!.listen(puerto, host, ok));
    this.base = `http://${hostPublico}:${(this.#servidor!.address() as AddressInfo).port}`;
  }

  async detener(): Promise<void> {
    await new Promise<void>((ok) => this.#servidor?.close(() => ok()));
    this.#servidor?.closeAllConnections();
  }

  get apiBase(): string {
    return `${this.base}/calendar/v3`;
  }

  // ───────────── Acciones de «la doctora» en Google Calendar (cambian el estado a mano) ─────────────

  /** Crea un evento como si lo hiciera una persona en Calendar. */
  crear(e: EventoGoogle): string {
    const id = e.id ?? `manual${++this.#n}`;
    this.#guardar({ ...e, id, status: "confirmed" });
    return id;
  }

  editar(id: string, cambios: EventoGoogle): void {
    const actual = this.eventos.get(id);
    if (!actual) throw new Error(`no existe ${id}`);
    this.#guardar({ ...actual, ...cambios });
  }

  eliminar(id: string): void {
    const actual = this.eventos.get(id);
    if (!actual) throw new Error(`no existe ${id}`);
    this.#guardar({ ...actual, status: "cancelled" });
  }

  /** Hace que todos los syncToken emitidos hasta ahora den 410 Gone. */
  caducarSyncTokens(): void {
    this.#tokenMinimo = this.#version + 1;
    this.#version++;
  }

  // ───────────── Interno ─────────────

  #guardar(e: EventoGoogle & { id: string; status?: string }): Guardado {
    this.#version++;
    const g: Guardado = { ...e, id: e.id, status: e.status ?? "confirmed", etag: `"${this.#version}"`, v: this.#version };
    this.eventos.set(g.id, g);
    return g;
  }

  #publico(g: Guardado): EventoGoogle {
    const { v: _v, ...resto } = g;
    return resto;
  }

  async #cuerpo(req: IncomingMessage): Promise<unknown> {
    let s = "";
    for await (const trozo of req) s += trozo;
    return s ? JSON.parse(s) : undefined;
  }

  async #atender(req: IncomingMessage, res: import("node:http").ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", this.base || "http://localhost");
    const responder = (estado: number, cuerpo?: unknown) => {
      res.statusCode = estado;
      if (cuerpo !== undefined) res.setHeader("Content-Type", "application/json");
      res.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
    };
    const error = (estado: number, message: string) => responder(estado, { error: { code: estado, message } });

    try {
      if (url.pathname === "/token") return this.#token(req, responder, error);
      if (url.pathname.startsWith("/__control/")) return await this.#control(req, url.pathname, responder, error);

      const m = url.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
      if (!m) return error(404, "ruta desconocida");
      if (!(req.headers.authorization ?? "").startsWith("Bearer tok-")) return error(401, "Invalid Credentials");
      if (decodeURIComponent(m[1]) !== CAL) return error(404, "Not Found");

      const cuerpo = await this.#cuerpo(req);
      const query = Object.fromEntries(url.searchParams);
      const ifMatch = req.headers["if-match"] as string | undefined;
      this.peticiones.push({ metodo: req.method ?? "", ruta: url.pathname, ifMatch, query, cuerpo });

      const fallo = this.fallos.shift();
      if (fallo) return error(fallo.estado, "fallo simulado");

      const id = m[2] ? decodeURIComponent(m[2]) : undefined;
      if (!id) {
        if (req.method === "GET") return this.#listar(query, responder, error);
        if (req.method === "POST") {
          const nuevo = cuerpo as EventoGoogle;
          const idNuevo = nuevo.id ?? `auto${++this.#n}`;
          if (this.eventos.has(idNuevo)) return error(409, "The requested identifier already exists.");
          return responder(200, this.#publico(this.#guardar({ ...nuevo, id: idNuevo })));
        }
        return error(405, "método no permitido");
      }

      const actual = this.eventos.get(id);
      if (req.method === "GET") return actual ? responder(200, this.#publico(actual)) : error(404, "Not Found");
      if (req.method === "PATCH") {
        if (!actual) return error(404, "Not Found");
        if (ifMatch && ifMatch !== actual.etag) return error(412, "Precondition Failed");
        const c = cuerpo as EventoGoogle;
        const privado = { ...actual.extendedProperties?.private, ...c.extendedProperties?.private };
        const fusion = { ...actual, ...c, extendedProperties: { private: privado } } as Guardado;
        return responder(200, this.#publico(this.#guardar(fusion)));
      }
      if (req.method === "DELETE") {
        if (!actual) return error(404, "Not Found");
        if (actual.status === "cancelled") return error(410, "Resource has been deleted");
        this.#guardar({ ...actual, status: "cancelled" });
        return responder(204);
      }
      return error(405, "método no permitido");
    } catch (e) {
      return error(500, String(e));
    }
  }

  /**
   * Control remoto para las pruebas de integración (otro proceso hace de «la doctora»):
   * GET eventos · GET peticiones · POST crear · editar · eliminar · caducar · fallos.
   */
  async #control(
    req: IncomingMessage,
    ruta: string,
    responder: (e: number, c?: unknown) => void,
    error: (e: number, m: string) => void,
  ) {
    const cuerpo = (await this.#cuerpo(req)) as Record<string, unknown> | undefined;
    switch (ruta.replace("/__control/", "")) {
      case "eventos":
        return responder(200, [...this.eventos.values()].map((e) => this.#publico(e)));
      case "peticiones":
        return responder(200, this.peticiones);
      case "crear":
        return responder(200, { id: this.crear(cuerpo as EventoGoogle) });
      case "editar":
        this.editar(String(cuerpo?.id), (cuerpo?.cambios ?? {}) as EventoGoogle);
        return responder(200, { ok: true });
      case "eliminar":
        this.eliminar(String(cuerpo?.id));
        return responder(200, { ok: true });
      case "caducar":
        this.caducarSyncTokens();
        return responder(200, { ok: true });
      case "fallos":
        this.fallos.push(...((cuerpo?.estados as number[]) ?? []).map((estado) => ({ estado })));
        return responder(200, { ok: true });
      default:
        return error(404, "control desconocido");
    }
  }

  #token(req: IncomingMessage, responder: (e: number, c?: unknown) => void, error: (e: number, m: string) => void) {
    return (async () => {
      let s = "";
      for await (const trozo of req) s += trozo;
      const jwt = new URLSearchParams(s).get("assertion") ?? "";
      const [cab, cue, firma] = jwt.split(".");
      const ok = Boolean(cab && cue && firma) &&
        createVerify("RSA-SHA256").update(`${cab}.${cue}`).verify(this.#publica, Buffer.from(firma, "base64url"));
      if (!ok) return responder(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." });
      const claims = JSON.parse(Buffer.from(cue, "base64url").toString());
      if (!String(claims.scope).includes("calendar")) return error(400, "scope");
      this.tokensEmitidos++;
      return responder(200, { access_token: `tok-${this.tokensEmitidos}`, expires_in: 3600, token_type: "Bearer" });
    })();
  }

  #listar(
    q: Record<string, string>,
    responder: (e: number, c?: unknown) => void,
    error: (e: number, m: string) => void,
  ) {
    let todos = [...this.eventos.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (q.syncToken) {
      const n = Number(q.syncToken.match(/^st-(\d+)$/)?.[1]);
      if (!Number.isInteger(n) || n < this.#tokenMinimo) {
        return error(410, "Sync token is no longer valid, a full sync is required.");
      }
      todos = todos.filter((e) => e.v > n);
    } else {
      todos = todos.filter((e) => {
        if (e.status === "cancelled") return true;
        const ini = e.start?.dateTime ?? e.start?.date;
        return (!q.timeMin || !ini || ini >= q.timeMin.slice(0, 10)) && (!q.timeMax || !ini || ini <= q.timeMax);
      });
    }
    const desde = q.pageToken ? Number(q.pageToken.replace("p-", "")) : 0;
    const pagina = todos.slice(desde, desde + this.tamanoPagina);
    const hayMas = desde + this.tamanoPagina < todos.length;
    return responder(200, {
      items: pagina.map((e) => this.#publico(e)),
      ...(hayMas ? { nextPageToken: `p-${desde + this.tamanoPagina}` } : { nextSyncToken: `st-${this.#version}` }),
    });
  }
}
