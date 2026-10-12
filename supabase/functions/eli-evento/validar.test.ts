// Pruebas del contrato Eli → CRM (validar.ts). Sin dependencias, con datos inventados:
//   node --test supabase/functions/eli-evento/validar.test.ts      (Node 22.18+)
//   deno test supabase/functions/eli-evento/validar.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { secretoValido, validarEvento } from "./validar.ts";

const TEL = "0990000091";

test("mensaje_entrante válido; deja solo los campos del contrato", () => {
  const r = validarEvento({ tipo: "mensaje_entrante", telefono: TEL, message_id: "wamid.A", extra: "x" });
  assert.deepEqual(r, { ok: true, evento: { tipo: "mensaje_entrante", telefono: TEL, message_id: "wamid.A" } });
});

test("mensaje_saliente acepta execution_id numérico", () => {
  const r = validarEvento({ tipo: "mensaje_saliente", telefono: TEL, execution_id: 123 });
  assert.equal(r.ok && r.evento.execution_id, "123");
});

test("cita_reservada exige gcal_event_id e inicio", () => {
  assert.deepEqual(validarEvento({ tipo: "cita_reservada", telefono: TEL, inicio: "2026-10-13T10:00:00-05:00" }),
    { ok: false, error: "Falta el campo gcal_event_id" });
});

test("cita_movida válida, con y sin fin", () => {
  const base = { tipo: "cita_movida", telefono: TEL, gcal_event_id: "gcal-1", inicio: "2026-10-14T15:00:00-05:00" };
  assert.deepEqual(validarEvento(base), { ok: true, evento: base });
  const conFin = { ...base, fin: "2026-10-14T15:30:00-05:00" };
  assert.deepEqual(validarEvento(conFin), { ok: true, evento: conFin });
});

test("cita_movida: falta inicio, fecha no válida, campos ajenos fuera", () => {
  assert.deepEqual(validarEvento({ tipo: "cita_movida", telefono: TEL, gcal_event_id: "gcal-1" }),
    { ok: false, error: "Falta el campo inicio" });
  assert.deepEqual(validarEvento({ tipo: "cita_movida", telefono: TEL, gcal_event_id: "gcal-1", inicio: "mañana" }),
    { ok: false, error: "inicio debe ser una fecha ISO 8601" });
  const r = validarEvento({ tipo: "cita_movida", telefono: TEL, gcal_event_id: "g", inicio: "2026-10-14T15:00:00-05:00", servicio: "x" });
  assert.ok(r.ok && !("servicio" in r.evento));
});

test("cita_cancelada válida; exige gcal_event_id", () => {
  const ev = { tipo: "cita_cancelada", telefono: TEL, gcal_event_id: "gcal-1" };
  assert.deepEqual(validarEvento(ev), { ok: true, evento: ev });
  assert.deepEqual(validarEvento({ tipo: "cita_cancelada", telefono: TEL }),
    { ok: false, error: "Falta el campo gcal_event_id" });
});

test("tipo desconocido lista los 5 tipos", () => {
  const r = validarEvento({ tipo: "cita_borrada", telefono: TEL });
  assert.deepEqual(r, {
    ok: false,
    error: "tipo debe ser mensaje_entrante, mensaje_saliente, cita_reservada, cita_movida o cita_cancelada",
  });
  assert.equal(validarEvento({ tipo: "toString", telefono: TEL }).ok, false);
});

test("texto se rechaza en cualquier evento (TK-41)", () => {
  for (const tipo of ["mensaje_entrante", "cita_movida", "cita_cancelada"]) {
    assert.deepEqual(validarEvento({ tipo, telefono: TEL, gcal_event_id: "g", texto: "hola" }),
      { ok: false, error: "texto ya no se acepta: el CRM no guarda el contenido de los mensajes" });
  }
});

test("cuerpo que no es objeto", () => {
  assert.equal(validarEvento([]).ok, false);
  assert.equal(validarEvento(null).ok, false);
});

test("campo que no es cadena", () => {
  assert.deepEqual(validarEvento({ tipo: "cita_cancelada", telefono: 99, gcal_event_id: "g" }),
    { ok: false, error: "telefono debe ser una cadena" });
});

test("secretoValido", () => {
  assert.equal(secretoValido("abc", "abc"), true);
  assert.equal(secretoValido("abd", "abc"), false);
  assert.equal(secretoValido("ab", "abc"), false);
  assert.equal(secretoValido(null, "abc"), false);
});
