// Pruebas del push (TK-15): crear, mover, cancelar, errores y reintentos contra Google falso.
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClienteCalendario } from "../google.ts";
import { cuerpoEvento, empujar, idEvento } from "../empujar.ts";
import { GoogleFalso } from "./google-falso.ts";
import { RepoMemoria } from "./repo-memoria.ts";

describe("push de citas a Calendar", () => {
  const google = new GoogleFalso();
  let repo: RepoMemoria;
  let cal: ClienteCalendario;

  before(() => google.iniciar());
  after(() => google.detener());
  beforeEach(() => {
    google.eventos.clear();
    google.peticiones.length = 0;
    google.fallos.length = 0;
    repo = new RepoMemoria();
    cal = new ClienteCalendario({ cuenta: google.cuentaServicio(), calendarioId: google.calendarioId, apiBase: google.apiBase });
  });

  it("cita pendiente → evento creado con crm_cita_id y descripción sin datos clínicos", async () => {
    repo.nueva({ id: 42, servicio: "Limpieza", nombre: "Paciente Prueba", telefono: "593900000001" });
    const r = await empujar(cal, repo);
    assert.deepEqual(r, { procesadas: 1, ok: 1, error: 0, conflicto: 0 });

    const ev = google.eventos.get(idEvento(42))!;
    assert.equal(ev.extendedProperties?.private?.crm_cita_id, "42");
    assert.equal(ev.extendedProperties?.private?.crm_paciente_id, "7");
    assert.equal(ev.start?.dateTime, "2026-10-20T15:00:00Z");
    assert.equal(ev.start?.timeZone, "America/Guayaquil");
    assert.match(ev.summary!, /Limpieza - Paciente Prueba/);
    // Solo nombre, teléfono y servicio.
    assert.equal(
      ev.description,
      "Paciente: Paciente Prueba\nTel: 593900000001\nServicio: Limpieza\nAgendado desde el Eli Panel",
    );

    const c = repo.cita(42);
    assert.equal(c.sync, "ok");
    assert.equal(c.gcal_event_id, idEvento(42));
    assert.equal(c.gcal_etag, ev.etag);
  });

  it("el id del evento es válido para Google (a-v y 0-9, mínimo 5)", () => {
    assert.match(idEvento(1), /^[a-v0-9]{5,}$/);
    assert.match(idEvento(123456), /^[a-v0-9]{5,}$/);
  });

  it("sin nombre ni teléfono ni servicio el evento sigue siendo válido", () => {
    const ev = cuerpoEvento({
      id: 5, paciente_id: null, gcal_event_id: null, gcal_etag: null, inicia_en: "2026-10-20T15:00:00Z",
      termina_en: "2026-10-20T16:00:00Z", servicio: null, estado: "agendada", nombre: null, telefono: null,
    });
    assert.equal(ev.summary, "🦷 Cita - Paciente");
    assert.equal(ev.description, "Paciente: Paciente\nServicio: por definir\nAgendado desde el Eli Panel");
    assert.deepEqual(ev.extendedProperties?.private, { crm_cita_id: "5" });
  });

  it("editar la cita mueve el evento (PATCH con If-Match del etag guardado)", async () => {
    repo.nueva({ id: 1 });
    await empujar(cal, repo);
    const etag = repo.cita(1).gcal_etag!;

    const c = repo.cita(1);
    c.sync = "pendiente";
    c.inicia_en = "2026-10-21T16:00:00Z";
    c.termina_en = "2026-10-21T17:00:00Z";
    google.peticiones.length = 0;
    const r = await empujar(cal, repo);

    assert.equal(r.ok, 1);
    const patch = google.peticiones.find((p) => p.metodo === "PATCH")!;
    assert.equal(patch.ifMatch, etag);
    assert.equal(google.eventos.get(idEvento(1))!.start?.dateTime, "2026-10-21T16:00:00Z");
    assert.notEqual(repo.cita(1).gcal_etag, etag);
    assert.equal(repo.cita(1).sync, "ok");
  });

  it("cancelar la cita borra el evento", async () => {
    repo.nueva({ id: 2 });
    await empujar(cal, repo);
    const c = repo.cita(2);
    c.sync = "pendiente";
    c.estado = "cancelada";
    const r = await empujar(cal, repo);
    assert.equal(r.ok, 1);
    assert.equal(google.eventos.get(idEvento(2))!.status, "cancelled");
    assert.equal(repo.cita(2).sync, "ok");
    assert.equal(repo.cita(2).gcal_etag, null);
  });

  it("cancelar una cita cuyo evento ya no existe (410) igual queda ok", async () => {
    repo.nueva({ id: 3 });
    await empujar(cal, repo);
    google.eliminar(idEvento(3)); // la doctora ya lo había borrado
    const c = repo.cita(3);
    c.sync = "pendiente";
    c.estado = "cancelada";
    const r = await empujar(cal, repo);
    assert.deepEqual([r.ok, r.error], [1, 0]);
  });

  it("cancelar una cita que nunca llegó a Calendar no llama a Google", async () => {
    repo.nueva({ id: 4, estado: "cancelada" });
    google.peticiones.length = 0;
    const r = await empujar(cal, repo);
    assert.equal(r.ok, 1);
    assert.equal(google.peticiones.length, 0);
  });

  it("si Google falla queda sync = error con el detalle; el siguiente intento lo reintenta", async () => {
    repo.nueva({ id: 5 });
    google.fallos.push({ estado: 503 });
    const r1 = await empujar(cal, repo);
    assert.deepEqual([r1.ok, r1.error], [0, 1]);
    assert.equal(repo.cita(5).sync, "error");
    assert.match(repo.cita(5).sync_error!, /503/);
    assert.equal(repo.errores.length, 1);
    assert.equal(repo.errores[0].tipo, "push");
    assert.equal(repo.errores[0].cita_id, 5);
    assert.equal(repo.errores[0].estado_http, 503);
    // sin teléfono ni nombre en el error
    assert.doesNotMatch(JSON.stringify(repo.errores), /5939|Paciente Prueba/);

    const r2 = await empujar(cal, repo); // «cron» siguiente
    assert.deepEqual([r2.ok, r2.error], [1, 0]);
    assert.equal(repo.cita(5).sync, "ok");
    assert.equal(google.eventos.size, 1);
  });

  it("reintento tras crear el evento y fallar al guardar en la base: no duplica (409 → adopta)", async () => {
    repo.nueva({ id: 6 });
    repo.fallarMarcarPush = 2; // la base no responde: ni el ok ni el error se guardan
    await empujar(cal, repo);
    assert.equal(google.eventos.size, 1);
    assert.equal(repo.cita(6).sync, "pendiente");

    const r = await empujar(cal, repo);
    assert.equal(r.ok, 1);
    assert.equal(google.eventos.size, 1, "no se creó un segundo evento");
    assert.equal(repo.cita(6).gcal_event_id, idEvento(6));
    assert.equal(repo.cita(6).gcal_etag, google.eventos.get(idEvento(6))!.etag);
  });

  it("conflicto: Calendar cambió el evento (412) → no se pisa y se avisa al gestor de conflictos", async () => {
    repo.nueva({ id: 7 });
    await empujar(cal, repo);
    google.editar(idEvento(7), { start: { dateTime: "2026-10-22T14:00:00Z" }, end: { dateTime: "2026-10-22T15:00:00Z" } });
    const c = repo.cita(7);
    c.sync = "pendiente";
    c.inicia_en = "2026-10-21T16:00:00Z";
    c.termina_en = "2026-10-21T17:00:00Z";

    const vistos: Array<{ id: number; hora: string | undefined }> = [];
    const r = await empujar(cal, repo, {
      alConflicto: async (cita, ev) => {
        vistos.push({ id: cita.id, hora: ev?.start?.dateTime });
      },
    });
    assert.equal(r.conflicto, 1);
    assert.deepEqual(vistos, [{ id: 7, hora: "2026-10-22T14:00:00Z" }]);
    // El evento de Calendar quedó como lo dejó la doctora.
    assert.equal(google.eventos.get(idEvento(7))!.start?.dateTime, "2026-10-22T14:00:00Z");
  });

  it("conflicto sin gestor: la cita queda en error, sin pisar Calendar", async () => {
    repo.nueva({ id: 8 });
    await empujar(cal, repo);
    google.editar(idEvento(8), { summary: "cambiado por la doctora" });
    const c = repo.cita(8);
    c.sync = "pendiente";
    await empujar(cal, repo);
    assert.equal(repo.cita(8).sync, "error");
    assert.equal(google.eventos.get(idEvento(8))!.summary, "cambiado por la doctora");
  });

  it("el evento fue borrado en Calendar y la cita se movió en el panel (404/410) → conflicto con evento nulo", async () => {
    repo.nueva({ id: 9 });
    await empujar(cal, repo);
    google.eventos.delete(idEvento(9)); // desaparece del todo
    const c = repo.cita(9);
    c.sync = "pendiente";
    let evento: unknown = "sin llamar";
    const r = await empujar(cal, repo, { alConflicto: async (_c, ev) => { evento = ev; } });
    assert.equal(r.conflicto, 1);
    assert.equal(evento, null);
  });

  it("procesa cada cita por separado: una que falla no frena a las demás", async () => {
    repo.nueva({ id: 10 });
    repo.nueva({ id: 11 });
    google.fallos.push({ estado: 500 });
    const r = await empujar(cal, repo);
    assert.deepEqual([r.ok, r.error], [1, 1]);
    assert.equal(repo.cita(10).sync, "error");
    assert.equal(repo.cita(11).sync, "ok");
  });
});
