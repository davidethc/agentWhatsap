// Pruebas del cliente de Google: configuración, token firmado y paginación. Corren con
//   node --test supabase/functions/calendario/pruebas/
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { ClienteCalendario, ErrorGoogle, leerConfig } from "../google.ts";
import { GoogleFalso } from "./google-falso.ts";

describe("leerConfig", () => {
  it("sin secretos no lanza: devuelve qué falta", () => {
    const r = leerConfig(() => undefined);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(r.faltan, ["GOOGLE_SA_JSON", "GCAL_CALENDAR_ID"]);
      assert.equal(r.motivo, "sin_configurar");
    }
  });

  it("solo falta el calendario", () => {
    const r = leerConfig((n) => (n === "GOOGLE_SA_JSON" ? "{}" : undefined));
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.faltan, ["GCAL_CALENDAR_ID"]);
  });

  it("JSON inválido o sin client_email/private_key", () => {
    const env = (sa: string) => (n: string) => ({ GOOGLE_SA_JSON: sa, GCAL_CALENDAR_ID: "x@y" } as Record<string, string>)[n];
    const malo = leerConfig(env("{no es json"));
    assert.equal(malo.ok, false);
    const incompleto = leerConfig(env('{"client_email":"a@b"}'));
    assert.equal(incompleto.ok, false);
  });

  it("configuración válida; GCAL_API_BASE y GCAL_TOKEN_URI solo para pruebas", () => {
    const sa = JSON.stringify({ client_email: "a@b", private_key: "k" });
    const r = leerConfig((n) => ({ GOOGLE_SA_JSON: sa, GCAL_CALENDAR_ID: "cal@y", GCAL_API_BASE: "http://x/v3/" } as Record<string, string>)[n]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.config.apiBase, "http://x/v3");
      assert.equal(r.config.calendarioId, "cal@y");
      assert.equal(r.config.cuenta.token_uri, "https://oauth2.googleapis.com/token");
    }
  });
});

describe("ClienteCalendario contra Google falso", () => {
  const google = new GoogleFalso();
  before(() => google.iniciar());
  after(() => google.detener());

  const cliente = () =>
    new ClienteCalendario({ cuenta: google.cuentaServicio(), calendarioId: google.calendarioId, apiBase: google.apiBase });

  it("firma el JWT y obtiene el token; lo reutiliza mientras no venza", async () => {
    const antes = google.tokensEmitidos;
    const c = cliente();
    await c.listar({});
    await c.listar({});
    assert.equal(google.tokensEmitidos, antes + 1);
  });

  it("renueva el token cuando está por vencer", async () => {
    let ahora = Date.now();
    const antes = google.tokensEmitidos;
    const c = new ClienteCalendario(
      { cuenta: google.cuentaServicio(), calendarioId: google.calendarioId, apiBase: google.apiBase },
      fetch,
      () => ahora,
    );
    await c.listar({});
    ahora += 3_570_000; // a menos de un minuto de que venza (se renueva con 60 s de margen)
    await c.listar({});
    assert.equal(google.tokensEmitidos, antes + 2);
  });

  it("una clave que no es la de la cuenta es rechazada por Google (400)", async () => {
    const otra = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const c = new ClienteCalendario({
      cuenta: { ...google.cuentaServicio(), private_key: otra },
      calendarioId: google.calendarioId,
      apiBase: google.apiBase,
    });
    await assert.rejects(c.listar({}), (e: unknown) => e instanceof ErrorGoogle && e.estado === 400);
  });

  it("con syncToken no manda timeMin/timeMax", async () => {
    const c = cliente();
    google.peticiones.length = 0;
    await c.listar({ syncToken: "st-0", timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-12-31T00:00:00Z" });
    const q = google.peticiones.at(-1)!.query;
    assert.equal(q.syncToken, "st-0");
    assert.equal(q.timeMin, undefined);
    assert.equal(q.timeMax, undefined);
  });

  it("un 410 llega como ErrorGoogle con el código", async () => {
    google.caducarSyncTokens();
    await assert.rejects(cliente().listar({ syncToken: "st-0" }), (e: unknown) => e instanceof ErrorGoogle && e.estado === 410);
  });
});
