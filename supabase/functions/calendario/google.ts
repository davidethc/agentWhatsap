// Cliente mínimo de Google Calendar con cuenta de servicio (docs/crm/plan.md §6, ADR 0009).
// Solo usa APIs web estándar (fetch, WebCrypto): corre en Deno (Edge Function) y en Node (pruebas),
// y recibe `fetch` por parámetro para poder probarlo contra un Google falso.

export interface CuentaServicio {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface ConfigGoogle {
  cuenta: CuentaServicio;
  calendarioId: string;
  /** Normalmente https://www.googleapis.com/calendar/v3. Se cambia solo en pruebas. */
  apiBase: string;
}

export type LecturaConfig =
  | { ok: true; config: ConfigGoogle }
  | { ok: false; faltan: string[]; motivo: string };

const API_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Lee GOOGLE_SA_JSON y GCAL_CALENDAR_ID. Si faltan o están mal, NO lanza: devuelve el motivo para
 * que la función termine sin error y deje constancia (el usuario pone los secretos al final).
 * GCAL_API_BASE y GCAL_TOKEN_URI solo existen para probar contra un Google simulado.
 */
export function leerConfig(env: (nombre: string) => string | undefined): LecturaConfig {
  const faltan: string[] = [];
  const crudo = env("GOOGLE_SA_JSON")?.trim();
  const calendarioId = env("GCAL_CALENDAR_ID")?.trim();
  if (!crudo) faltan.push("GOOGLE_SA_JSON");
  if (!calendarioId) faltan.push("GCAL_CALENDAR_ID");
  if (faltan.length > 0) {
    return { ok: false, faltan, motivo: "sin_configurar" };
  }

  let cuenta: Partial<CuentaServicio>;
  try {
    cuenta = JSON.parse(crudo as string);
  } catch {
    return { ok: false, faltan: ["GOOGLE_SA_JSON"], motivo: "GOOGLE_SA_JSON no es un JSON válido" };
  }
  if (typeof cuenta.client_email !== "string" || typeof cuenta.private_key !== "string") {
    return {
      ok: false,
      faltan: ["GOOGLE_SA_JSON"],
      motivo: "GOOGLE_SA_JSON no trae client_email y private_key",
    };
  }
  return {
    ok: true,
    config: {
      cuenta: {
        client_email: cuenta.client_email,
        private_key: cuenta.private_key,
        token_uri: env("GCAL_TOKEN_URI") || cuenta.token_uri || TOKEN_URI,
      },
      calendarioId: calendarioId as string,
      apiBase: (env("GCAL_API_BASE") || API_BASE).replace(/\/$/, ""),
    },
  };
}

/** Error de Google con el código HTTP, para decidir (410 → resincronizar, 412 → conflicto…). */
export class ErrorGoogle extends Error {
  estado: number;
  detalle: string;
  constructor(estado: number, detalle: string) {
    super(`Google respondió ${estado}: ${detalle}`);
    this.estado = estado;
    this.detalle = detalle;
  }
}

// ───────────────────────── Token ─────────────────────────

const b64url = (datos: Uint8Array | string): string => {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function firmarJwt(cuenta: CuentaServicio, ahoraS: number): Promise<string> {
  const pem = cuenta.private_key
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({
    iss: cuenta.client_email,
    scope: SCOPE,
    aud: cuenta.token_uri,
    iat: ahoraS,
    exp: ahoraS + 3600,
  }));
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    clave,
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  return `${cabecera}.${cuerpo}.${b64url(new Uint8Array(firma))}`;
}

// ───────────────────────── Cliente ─────────────────────────

/** Evento de Google tal como lo usamos (solo los campos que leemos o escribimos). */
export interface EventoGoogle {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface PaginaEventos {
  items: EventoGoogle[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export class ClienteCalendario {
  #token: { valor: string; venceMs: number } | null = null;
  config: ConfigGoogle;
  fetchFn: typeof fetch;
  ahoraMs: () => number;

  constructor(config: ConfigGoogle, fetchFn: typeof fetch = fetch, ahoraMs: () => number = () => Date.now()) {
    this.config = config;
    this.fetchFn = fetchFn;
    this.ahoraMs = ahoraMs;
  }

  async #accessToken(): Promise<string> {
    if (this.#token && this.#token.venceMs - 60_000 > this.ahoraMs()) return this.#token.valor;
    const jwt = await firmarJwt(this.config.cuenta, Math.floor(this.ahoraMs() / 1000));
    const r = await this.fetchFn(this.config.cuenta.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok || typeof datos.access_token !== "string") {
      throw new ErrorGoogle(r.status, `no se pudo obtener el token (${datos.error ?? "sin detalle"})`);
    }
    this.#token = { valor: datos.access_token, venceMs: this.ahoraMs() + (datos.expires_in ?? 3600) * 1000 };
    return datos.access_token;
  }

  async #llamar(
    metodo: string,
    ruta: string,
    opciones: { query?: Record<string, string | undefined>; cuerpo?: unknown; ifMatch?: string } = {},
  ): Promise<unknown> {
    const url = new URL(`${this.config.apiBase}/calendars/${encodeURIComponent(this.config.calendarioId)}${ruta}`);
    for (const [k, v] of Object.entries(opciones.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
    const cabeceras: Record<string, string> = { Authorization: `Bearer ${await this.#accessToken()}` };
    if (opciones.cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
    if (opciones.ifMatch) cabeceras["If-Match"] = opciones.ifMatch;
    const r = await this.fetchFn(url, {
      method: metodo,
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
    if (r.status === 204) return null;
    const texto = await r.text();
    if (!r.ok) {
      let detalle = texto.slice(0, 300);
      try {
        detalle = JSON.parse(texto)?.error?.message ?? detalle;
      } catch { /* queda el texto */ }
      throw new ErrorGoogle(r.status, detalle);
    }
    return texto ? JSON.parse(texto) : null;
  }

  /** events.list. Con syncToken NO se mandan timeMin/timeMax (Google lo prohíbe). */
  listar(p: { syncToken?: string; timeMin?: string; timeMax?: string; pageToken?: string }): Promise<PaginaEventos> {
    return this.#llamar("GET", "/events", {
      query: {
        showDeleted: "true",
        singleEvents: "true",
        maxResults: "250",
        syncToken: p.syncToken,
        timeMin: p.syncToken ? undefined : p.timeMin,
        timeMax: p.syncToken ? undefined : p.timeMax,
        pageToken: p.pageToken,
      },
    }) as Promise<PaginaEventos>;
  }

  obtener(id: string): Promise<EventoGoogle> {
    return this.#llamar("GET", `/events/${encodeURIComponent(id)}`) as Promise<EventoGoogle>;
  }

  insertar(evento: EventoGoogle): Promise<EventoGoogle> {
    return this.#llamar("POST", "/events", { cuerpo: evento }) as Promise<EventoGoogle>;
  }

  /** PATCH: solo toca los campos enviados (no pisa invitados ni recordatorios de la doctora). */
  actualizar(id: string, cambios: EventoGoogle, etag?: string | null): Promise<EventoGoogle> {
    return this.#llamar("PATCH", `/events/${encodeURIComponent(id)}`, {
      cuerpo: cambios,
      ifMatch: etag || undefined,
    }) as Promise<EventoGoogle>;
  }

  async borrar(id: string): Promise<void> {
    await this.#llamar("DELETE", `/events/${encodeURIComponent(id)}`);
  }
}
