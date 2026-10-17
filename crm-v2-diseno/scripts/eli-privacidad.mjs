/** Adaptador de contrato Eli → Panel. No importa .env ni llama a WhatsApp/IA. */
export function crearEli({ request, responder = async () => 'Respuesta ficticia de Eli' }) {
  return {
    async preparar(conversationId, eventId) {
      const context = await request(`/api/bot/context?conversationId=${encodeURIComponent(conversationId)}`);
      if (context.status !== 200) return { blocked: context };
      const c = context.body.conversation;
      if (!c.aiEnabled) return { blocked: { status: 409, body: { error: { code: 'ai_paused' } } } };
      if (!Number.isSafeInteger(c.epoch)) throw new Error('Contrato sin epoch: no se permite enviar');
      // La clave identifica una salida de un evento, también tras un reintento.
      return { conversationId, epoch: c.epoch, idempotencyKey: `eli:${eventId}:0`, text: await responder(context.body) };
    },
    async enviar(turno) {
      if (turno.blocked) return turno.blocked;
      return request('/api/bot/messages', { method: 'POST', body: turno });
    },
    async pausar(conversationId) {
      return request('/api/bot/handoff', { method: 'POST', body: { conversationId, reason: 'human_requested' } });
    },
  };
}

/** Transporte sólo loopback. Usar únicamente con una instancia y BD ficticias. */
export function transporteLocal({ base, apiKey, cookie }) {
  const url = new URL(base);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password) {
    throw new Error('El arnés requiere HTTP loopback sin credenciales en URL');
  }
  return async (path, { method = 'GET', body } = {}) => {
    const response = await fetch(new URL(path, url), {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, ...(cookie ? { cookie, origin: url.origin } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
}

/** Verificación reutilizable contra API real o doble; sólo conversaciones ficticias.
 * `reanudar` debe usar la sesión local PATCH /api/conversations/:id.
 * No elimina registros ni registra cuerpos/contextos en consola.
 */
export async function verificarContratoPrivacidad({ request, conversationId, reanudar, eventId }) {
  const assert = (condition, step) => { if (!condition) throw new Error(`Falló: ${step}`); };
  const eli = crearEli({ request });
  const turno = await eli.preparar(conversationId, eventId);
  assert(!turno.blocked, 'contexto disponible');
  const first = await eli.enviar(turno);
  assert(first.status === 200, 'primer envío simulado');
  const retry = await eli.enviar(turno);
  assert(retry.status === 200 && retry.body.messageId === first.body.messageId, 'reintento idempotente');
  const vieja = await eli.preparar(conversationId, `${eventId}-vieja`);
  assert((await eli.pausar(conversationId)).status === 200, 'pausa');
  assert((await eli.enviar(vieja)).status === 409, 'bloqueo durante pausa');
  await reanudar();
  const stale = await eli.enviar(vieja);
  assert(stale.status === 409 && stale.body.error?.code === 'stale_epoch', 'bloqueo después de devolver');
  const nueva = await eli.preparar(conversationId, `${eventId}-nueva`);
  assert(nueva.epoch !== vieja.epoch, 'epoch renovado');
  assert((await eli.enviar(nueva)).status === 200, 'nuevo turno');
  return { checks: 8, passed: true };
}
