import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEli, transporteLocal } from './eli-privacidad.mjs';

// Doble del contrato HTTP: no prueba el backend, no abre puertos ni lee .env.
function escenario() {
  const state = { epoch: 1, aiEnabled: true, deleted: false, sent: new Map(), attempts: [] };
  const request = async (path, opts = {}) => {
    if (state.deleted) return { status: 404, body: { error: { code: 'not_found' } } };
    if (path.startsWith('/api/bot/context')) return { status: 200, body: { conversation: { epoch: state.epoch, aiEnabled: state.aiEnabled } } };
    if (path === '/api/bot/handoff') { if(state.aiEnabled) state.epoch++; state.aiEnabled = false; return { status: 200, body: { ok: true } }; }
    const b = opts.body; state.attempts.push(b);
    if (!state.aiEnabled) return { status: 409, body: { error: { code: 'ai_paused' } } };
    if (b.epoch !== state.epoch) return { status: 409, body: { error: { code: 'stale_epoch' } } };
    if (!state.sent.has(b.idempotencyKey)) state.sent.set(b.idempotencyKey, `mock-${state.sent.size}`);
    return { status: 200, body: { messageId: state.sent.get(b.idempotencyKey) } };
  };
  return { state, eli: crearEli({ request }) };
}
test('contexto → respuesta ficticia → envío con epoch', async () => {
  const { eli, state } = escenario(); const turno = await eli.preparar('ficticia', 'evento-1');
  assert.equal(turno.epoch, 1); assert.equal((await eli.enviar(turno)).status, 200); assert.equal(state.sent.size, 1);
});
test('duplicado y reintento conservan clave y una salida', async () => {
  const { eli, state } = escenario(); const turno = await eli.preparar('ficticia', 'evento-1');
  const first = await eli.enviar(turno); const retry = await eli.enviar(turno);
  const duplicate = await eli.enviar(await eli.preparar('ficticia', 'evento-1'));
  assert.deepEqual(first, retry); assert.deepEqual(first, duplicate); assert.equal(state.sent.size, 1);
});
test('respuesta preparada antes de pausa no se envía', async () => {
  const { eli, state } = escenario(); const turno = await eli.preparar('ficticia', 'evento-1');
  await eli.pausar('ficticia'); assert.equal((await eli.enviar(turno)).status, 409); assert.equal(state.sent.size, 0);
  assert.equal((await eli.preparar('ficticia', 'evento-2')).blocked.body.error.code, 'ai_paused');
});
test('pausar y devolver invalida respuesta antigua; nueva funciona', async () => {
  const { eli, state } = escenario(); const vieja = await eli.preparar('ficticia', 'evento-1');
  await eli.pausar('ficticia'); state.aiEnabled = true; state.epoch++;
  assert.equal((await eli.enviar(vieja)).body.error.code, 'stale_epoch');
  assert.equal((await eli.enviar(await eli.preparar('ficticia', 'evento-2'))).status, 200);
});
test('borrado o expiración impide salida pendiente', async () => {
  const { eli, state } = escenario(); const turno = await eli.preparar('ficticia', 'evento-1'); state.deleted = true;
  assert.equal((await eli.enviar(turno)).status, 404); assert.equal(state.sent.size, 0);
});
test('fail closed si el contexto no tiene epoch', async () => {
  const eli = crearEli({ request: async () => ({status: 200, body: {conversation: {aiEnabled: true}}}) });
  await assert.rejects(eli.preparar('ficticia', 'evento'), /sin epoch/);
});
test('transporte impide destinos externos y credenciales en URL', () => {
  for (const base of ['https://example.com', 'http://example.com', 'http://user:pass@localhost:3000']) assert.throws(() => transporteLocal({base, apiKey:'ficticia'}));
});
