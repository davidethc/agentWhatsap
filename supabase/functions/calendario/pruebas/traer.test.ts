// Pruebas del pull (TK-16) contra Google falso: syncToken, paginación, 410 Gone, ignorados y fallos.
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClienteCalendario } from "../google.ts";
import { normalizarEvento, traer, type EventoCalendario, type RepoPull } from "../traer.ts";
import { GoogleFalso } from "./google-falso.ts";

class RepoPullFalso implements RepoPull {
  tokens = new Map<string, string | null>();
  aplicados: EventoCalendario[] = [];
  errores: Array<Record<string, unknown>> = [];
  /** ids de evento cuya aplicación falla (la base rechaza el evento). */
  fallan = new Set<string>();

  leerSyncToken(id: string) {
    return Promise.resolve(this.tokens.get(id) ?? null);
  }
  guardarSyncToken(id: string, token: string | null) {
    this.tokens.set(id, token);
    return Promise.resolve();
  }
  aplicarEvento(ev: EventoCalendario) {
    if (this.fallan.has(ev.gcal_event_id)) return Promise.reject(new Error("la base rechazó el evento"));
    this.aplicados.push(ev);
    return Promise.resolve({ accion: ev.estado === "cancelado" ? "cancelada" : "creada_sin_vincular" });
  }
  registrarError(detalle: Record<string, unknown>) {
    this.errores.push(detalle);
    return Promise.resolve();
  }
}

const hora = (h: number, dia = "2026-10-20") => ({
  start: { dateTime: `${dia}T${String(h).padStart(2, "0")}:00:00-05:00` },
  end: { dateTime: `${dia}T${String(h + 1).padStart(2, "0")}:00:00-05:00` },
});

describe("normalizarEvento", () => {
  it("evento normal con hora", () => {
    const n = normalizarEvento({
      id: "a", etag: '"1"', summary: "Control", description: "Tel: 593900000001", ...hora(10),
      extendedProperties: { private: { crm_cita_id: "9" } },
    })!;
    assert.equal(n.estado, "activo");
    assert.equal(n.inicio, "2026-10-20T10:00:00-05:00");
    assert.equal(n.crm_cita_id, "9");
    assert.equal(n.resumen, "Control");
  });
  it("de día entero (solo date) → se ignora", () => {
    assert.equal(normalizarEvento({ id: "a", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } }), null);
  });
  it("«Disponible» (transparent) → se ignora", () => {
    assert.equal(normalizarEvento({ id: "a", transparency: "transparent", ...hora(10) }), null);
  });
  it("borrado (llega mínimo) → cancelado", () => {
    const n = normalizarEvento({ id: "a", status: "cancelled" })!;
    assert.equal(n.estado, "cancelado");
    assert.equal(n.inicio, null);
  });
  it("sin id → se ignora", () => {
    assert.equal(normalizarEvento({ summary: "x", ...hora(10) }), null);
  });
});

describe("pull incremental", () => {
  const google = new GoogleFalso();
  let repo: RepoPullFalso;
  let cal: ClienteCalendario;
  const ahora = Date.parse("2026-10-18T12:00:00Z");

  before(() => google.iniciar());
  after(() => google.detener());
  beforeEach(() => {
    google.eventos.clear();
    google.peticiones.length = 0;
    google.fallos.length = 0;
    google.tamanoPagina = 250;
    repo = new RepoPullFalso();
    cal = new ClienteCalendario({ cuenta: google.cuentaServicio(), calendarioId: google.calendarioId, apiBase: google.apiBase });
  });
  const correr = () => traer(cal, repo, google.calendarioId, { ahoraMs: () => ahora });

  it("la primera vez trae la ventana de 30 días atrás a 90 adelante y guarda el syncToken", async () => {
    google.crear({ id: "e1", summary: "Prueba 1", ...hora(10) });
    const r = await correr();

    const q = google.peticiones.find((p) => p.metodo === "GET")!.query;
    assert.equal(q.syncToken, undefined);
    assert.equal(q.timeMin, new Date(ahora - 30 * 86_400_000).toISOString());
    assert.equal(q.timeMax, new Date(ahora + 90 * 86_400_000).toISOString());
    assert.equal(q.showDeleted, "true");
    assert.equal(r.tokenGuardado, true);
    assert.match(repo.tokens.get(google.calendarioId)!, /^st-\d+$/);
    assert.deepEqual(repo.aplicados.map((e) => e.gcal_event_id), ["e1"]);
  });

  it("las siguientes veces usa el syncToken guardado y solo recibe lo que cambió", async () => {
    google.crear({ id: "e1", ...hora(10) });
    google.crear({ id: "e2", ...hora(11) });
    await correr();
    const token1 = repo.tokens.get(google.calendarioId);
    repo.aplicados.length = 0;
    google.peticiones.length = 0;

    google.editar("e2", hora(15)); // la doctora mueve un evento
    const r = await correr();

    const q = google.peticiones.find((p) => p.metodo === "GET")!.query;
    assert.equal(q.syncToken, token1);
    assert.equal(q.timeMin, undefined);
    assert.deepEqual(repo.aplicados.map((e) => e.gcal_event_id), ["e2"]);
    assert.equal(repo.aplicados[0].inicio, "2026-10-20T15:00:00-05:00");
    assert.equal(r.eventos, 1);
    assert.notEqual(repo.tokens.get(google.calendarioId), token1);
  });

  it("sin cambios no aplica nada", async () => {
    google.crear({ id: "e1", ...hora(10) });
    await correr();
    repo.aplicados.length = 0;
    const r = await correr();
    assert.equal(r.eventos, 0);
    assert.equal(repo.aplicados.length, 0);
  });

  it("evento borrado → llega como cancelado", async () => {
    google.crear({ id: "e1", ...hora(10) });
    await correr();
    repo.aplicados.length = 0;
    google.eliminar("e1");
    const r = await correr();
    assert.deepEqual(repo.aplicados.map((e) => [e.gcal_event_id, e.estado]), [["e1", "cancelado"]]);
    assert.equal(r.acciones.cancelada, 1);
  });

  it("recorre todas las páginas y guarda el token solo al final", async () => {
    google.tamanoPagina = 2;
    for (let i = 1; i <= 5; i++) google.crear({ id: `p${i}`, ...hora(8 + i) });
    const r = await correr();
    assert.equal(r.eventos, 5);
    assert.equal(repo.aplicados.length, 5);
    assert.equal(google.peticiones.filter((p) => p.metodo === "GET").length, 3);
    assert.equal(r.tokenGuardado, true);
  });

  it("ignora los eventos de día entero y los «Disponible»", async () => {
    google.crear({ id: "dia", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } });
    google.crear({ id: "libre", transparency: "transparent", ...hora(10) });
    google.crear({ id: "real", ...hora(12) });
    const r = await correr();
    assert.deepEqual(repo.aplicados.map((e) => e.gcal_event_id), ["real"]);
    assert.equal(r.ignorados, 2);
  });

  it("410 Gone: borra el token, vuelve a sincronizar desde cero y guarda el nuevo", async () => {
    google.crear({ id: "e1", ...hora(10) });
    await correr();
    const viejo = repo.tokens.get(google.calendarioId);
    google.caducarSyncTokens();
    google.crear({ id: "e2", ...hora(11) });
    repo.aplicados.length = 0;
    google.peticiones.length = 0;

    const r = await correr();

    assert.equal(r.resincronizado, true);
    assert.equal(r.tokenGuardado, true);
    const gets = google.peticiones.filter((p) => p.metodo === "GET");
    assert.equal(gets[0].query.syncToken, viejo, "primero intentó con el token viejo");
    assert.equal(gets[1].query.syncToken, undefined, "luego pidió todo otra vez");
    assert.deepEqual(repo.aplicados.map((e) => e.gcal_event_id).sort(), ["e1", "e2"]);
    assert.notEqual(repo.tokens.get(google.calendarioId), viejo);
    assert.match(repo.tokens.get(google.calendarioId)!, /^st-\d+$/);
  });

  it("si un evento falla en la base: lo anota sin datos del paciente, sigue con los demás y NO avanza el token", async () => {
    google.crear({ id: "e1", ...hora(10) });
    await correr();
    const token1 = repo.tokens.get(google.calendarioId);

    google.crear({ id: "malo", summary: "Ana Inventada", description: "Tel: 593900000001", ...hora(11) });
    google.crear({ id: "bueno", ...hora(12) });
    repo.fallan.add("malo");
    repo.aplicados.length = 0;
    const r = await correr();

    assert.equal(r.fallos, 1);
    assert.equal(r.tokenGuardado, false);
    assert.equal(repo.tokens.get(google.calendarioId), token1, "el token no avanzó");
    assert.deepEqual(repo.aplicados.map((e) => e.gcal_event_id), ["bueno"]);
    assert.equal(repo.errores.length, 1);
    assert.equal(repo.errores[0].tipo, "pull");
    assert.equal(repo.errores[0].gcal_event_id, "malo");
    assert.doesNotMatch(JSON.stringify(repo.errores), /Ana Inventada|593900000001/);

    // Arreglado el problema, la siguiente vuelta lo recupera y ahora sí avanza.
    repo.fallan.clear();
    repo.aplicados.length = 0;
    const r2 = await correr();
    assert.equal(r2.fallos, 0);
    assert.equal(r2.tokenGuardado, true);
    assert.ok(repo.aplicados.some((e) => e.gcal_event_id === "malo"));
  });

  it("si Google falla (503) la función lanza y el token queda como estaba", async () => {
    google.crear({ id: "e1", ...hora(10) });
    await correr();
    const token1 = repo.tokens.get(google.calendarioId);
    google.fallos.push({ estado: 503 });
    await assert.rejects(correr(), /503/);
    assert.equal(repo.tokens.get(google.calendarioId), token1);
  });

  it("un 410 que se repite con el token ya borrado es un error real (no hay bucle)", async () => {
    google.fallos.push({ estado: 410 }, { estado: 410 });
    await assert.rejects(correr(), /410/);
  });
});
