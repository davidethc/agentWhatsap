/** API/UI reales; exclusivamente fixture aislado. Nunca cargar .env del repo.
 * node --env-file=/tmp/eli-panel-qa/.env scripts/e2e-privacidad.mjs
 * Reiniciar app y repetir con --resume-purge. No imprime cuerpos ni secretos.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { chromium } from 'playwright';

const env = process.env;
const base = new URL(env.APP_BASE_URL ?? '');
const dbUrl = new URL(env.DATABASE_URL ?? '');
const loopback = u => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
assert(loopback(base) && base.protocol === 'http:' && base.port === '3100', 'Panel debe ser loopback:3100');
assert(loopback(dbUrl) && dbUrl.port === '55432' && /qa/i.test(dbUrl.pathname), 'BD debe ser QA loopback:55432');
assert.equal(env.DATABASE_SCHEMA, 'vocero', 'Schema QA explícito');
assert.equal(env.WA_MOCK_ENABLED, 'true', 'Sender mock obligatorio');
const graph = new URL(env.META_GRAPH_BASE_URL ?? '');
assert(loopback(graph) && graph.port === '3100', 'Graph debe ser mock loopback:3100');
const mediaRoot = path.resolve(env.MEDIA_DIR ?? '');
assert(mediaRoot.startsWith('/tmp/eli-panel-qa/'), 'MEDIA_DIR debe estar en /tmp/eli-panel-qa/');
assert(env.QA_PASSWORD?.length >= 8 && env.BOT_API_KEY?.length >= 16, 'Credenciales QA requeridas');
const sql = postgres(env.DATABASE_URL, { max: 2, connection: { search_path: 'vocero,public', timezone: 'UTC' } });
const checkpoint = '/tmp/eli-panel-qa/privacidad-checkpoint.json';
let checks = 0;
function check(name, condition) { assert(condition, name); checks++; console.log(`PASS ${name}`); }
async function request(p, { cookie = '', bot = false, method = 'GET', body } = {}) {
  const r = await fetch(new URL(p, base), { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { origin: base.origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(bot ? { 'x-api-key': env.BOT_API_KEY } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json().catch(() => null);
  return { status: r.status, data, cookie: r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
}
async function status(name, p, expected, opts) { const r = await request(p, opts); check(`${name} (${expected})`, r.status === expected); return r; }
async function eventually(fn, ms = 15000) { const end = Date.now() + ms; while (!(await fn())) { assert(Date.now() < end, 'timeout esperando estado durable'); await new Promise(r => setTimeout(r, 150)); } }
async function fixture(org, suffix) {
  const contact = `qa_ct_${suffix}`, conversation = `qa_cv_${suffix}`, asset = `qa_as_${suffix}`;
  await sql`insert into contact(id,organization_id,wa_identity,name,ficha) values(${contact},${org},${`bsuid:${suffix}`},'Paciente ficticio QA',${sql.json({ fixture: 'conservar' })})`;
  await sql`insert into conversation(id,organization_id,contact_id,last_message_at,last_inbound_at) values(${conversation},${org},${contact},now(),now())`;
  await mkdir(path.join(mediaRoot, org), { recursive: true });
  await writeFile(path.join(mediaRoot, org, asset), 'archivo ficticio');
  await sql`insert into media_asset(id,organization_id,kind,mime_type,storage_path,fetch_status) values(${asset},${org},'document','text/plain',${`${org}/${asset}`},'available')`;
  await sql`insert into message(id,organization_id,conversation_id,direction,text,media_asset_id) values(${`qa_msg_${suffix}`},${org},${conversation},'in','Texto ficticio privado',${asset})`;
  await sql`insert into ad_attribution(id,organization_id,contact_id,conversation_id,body,headline,raw,image_asset_id) values(${`qa_ad_${suffix}`},${org},${contact},${conversation},'Anuncio ficticio privado','Título ficticio',${sql.json({ body: 'Anuncio ficticio privado' })},${asset})`;
  return { org, contact, conversation, asset };
}
async function counts(f) {
  const [r] = await sql`select (select count(*)::int from message where conversation_id=${f.conversation}) as messages,(select count(*)::int from media_asset where id=${f.asset}) as assets,(select ficha from contact where id=${f.contact}) as ficha`;
  return r;
}
async function purged(f) {
  const c = await counts(f);
  const missing = await access(path.join(mediaRoot, f.org, f.asset)).then(() => false, () => true);
  return c.messages === 0 && c.assets === 0 && missing && c.ficha?.fixture === 'conservar';
}
async function account(label, run) {
  const email = `qa-${label}-${run}@example.test`;
  const r = await status(`registro ${label}`, '/api/auth/sign-up/email', 200, { method: 'POST', body: { email, password: env.QA_PASSWORD, name: `QA ${label}` } });
  const [u] = await sql`select id from "user" where email=${email}`;
  assert(u && r.cookie, 'registro debe crear usuario y sesión');
  return { id: u.id, cookie: r.cookie };
}
async function stream(cookie) {
  const abort = new AbortController();
  const r = await fetch(new URL('/api/events', base), { headers: { cookie }, signal: abort.signal });
  return { r, reader: r.body.getReader(), abort };
}
async function main() {
  const [identity] = await sql`select current_database() as db, current_schema() as schema`;
  check('conexión schema aislado', identity.schema === 'vocero' && /qa/i.test(identity.db));
  if (process.argv.includes('--resume-purge')) {
    const f = JSON.parse(await readFile(checkpoint, 'utf8'));
    assert(f.org.startsWith('qa_') || f.conversation.startsWith('qa_cv_'));
    await eventually(() => purged(f), 20000);
    check('reinicio recupera purga durable sin perder ficha', await purged(f));
    return;
  }
  assert.equal(env.ALLOW_SIGNUP, 'true', 'Habilitar registro solo en entorno QA');
  const run = randomUUID().slice(0, 8);
  const doctor = await account('doctora', run), admin = await account('admin', run), other = await account('otra', run);
  const [m] = await sql`select id as organization_id from organization order by created_at limit 1`;
  assert(m, 'requiere organización inicial');
  const org = m.organization_id, otherOrg = `qa_org_${run}`;
  await sql`insert into organization(id,name,slug) values(${otherOrg},'Organización ficticia QA',${otherOrg})`;
  for (const [user, organization, role] of [[doctor, org, 'owner'], [admin, org, 'admin'], [other, otherOrg, 'owner']]) {
    await sql`delete from member where user_id=${user.id}`;
    await sql`insert into member(id,organization_id,user_id,role) values(${randomUUID()},${organization},${user.id},${role})`;
    await sql`update session set active_organization_id=${organization} where user_id=${user.id}`;
  }
  for (const [user, organization] of [[doctor, org], [other, otherOrg]]) await sql`insert into operational_grant(id,organization_id,user_id) values(${randomUUID()},${organization},${user.id})`;
  const f = await fixture(org, run);
  const messages = `/api/conversations/${f.conversation}/messages`, media = `/api/media/${f.asset}`;
  await status('anónimo', messages, 401);
  await status('admin sin grant', messages, 403, admin);
  await status('admin sin grant adjunto', media, 403, admin);
  await status('admin SSE', '/api/events', 403, admin);
  await status('otra organización mensajes', messages, 404, other);
  await status('otra organización adjunto', media, 404, other);
  await status('doctora historial', messages, 200, doctor);
  await status('doctora adjunto', media, 200, doctor);
  const s = await stream(doctor.cookie);
  check('SSE autorizado abre', s.r.status === 200);
  await s.reader.read();
  await sql`delete from operational_grant where user_id=${doctor.id} and organization_id=${org}`;
  await status('revocación API inmediata', messages, 403, doctor);
  await status('revocación adjunto inmediata', media, 403, doctor);
  const ended = await Promise.race([(async () => { for (;;) { if ((await s.reader.read()).done) return true; } })(), new Promise(r => setTimeout(() => r(false), 28000))]);
  s.abort.abort(); check('SSE revocado cierra antes de 28s', ended);
  await sql`insert into operational_grant(id,organization_id,user_id) values(${randomUUID()},${org},${doctor.id})`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies(doctor.cookie.split('; ').map(pair => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: base.origin }; }));
    const page = await context.newPage();
    await page.route('**/*', route => loopback(new URL(route.request().url())) ? route.continue() : route.abort());
    await page.goto(new URL('/inbox', base).href);
    await page.getByText('Paciente ficticio QA', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Tomar conversación', exact: true }).click();
    await page.getByRole('button', { name: 'Devolver a Eli', exact: true }).waitFor();
    check('UI toma confirmada por servidor', (await sql`select ai_enabled from conversation where id=${f.conversation}`)[0].ai_enabled === false);
    await page.getByRole('button', { name: 'Devolver a Eli', exact: true }).click();
    await page.getByRole('button', { name: 'Tomar conversación', exact: true }).waitFor();
    check('UI devuelve confirmada por servidor', (await sql`select ai_enabled from conversation where id=${f.conversation}`)[0].ai_enabled === true);
  } finally { await browser.close(); }
  await status('conexión sender mock', '/api/settings/whatsapp', 200, { ...doctor, method: 'PUT', body: { wabaId: `QA_WABA_${run}`, phoneNumberId: `QA_PN_${run}`, token: `qa-ficticio-${run}` } });
  const ctx = await status('contexto bot', `/api/bot/context?conversationId=${f.conversation}`, 200, { bot: true });
  const epoch = ctx.data.conversation.epoch;
  const body = { conversationId: f.conversation, text: 'Respuesta ficticia QA', epoch, idempotencyKey: `qa:${run}` };
  const beforeOutbox = await status('sender mock activo', '/api/dev/wa-mock/outbox', 200);
  const first = await status('envío proveedor mock', '/api/bot/messages', 200, { bot: true, method: 'POST', body });
  const retry = await status('reintento mismo evento', '/api/bot/messages', 200, { bot: true, method: 'POST', body });
  const afterOutbox = await status('acuse proveedor mock', '/api/dev/wa-mock/outbox', 200);
  check('proveedor acepta exactamente una salida', afterOutbox.data.outbox.length === beforeOutbox.data.outbox.length + 1);
  check('mismo messageId y una fila', first.data.messageId === retry.data.messageId && (await sql`select count(*)::int as n from message where id=${first.data.messageId}`)[0].n === 1);
  await status('tomar API', `/api/conversations/${f.conversation}`, 200, { ...doctor, method: 'PATCH', body: { aiEnabled: false } });
  await status('pausa bloquea salida', '/api/bot/messages', 409, { bot: true, method: 'POST', body: { ...body, idempotencyKey: `qa:${run}:old` } });
  await status('devolver API', `/api/conversations/${f.conversation}`, 200, { ...doctor, method: 'PATCH', body: { aiEnabled: true } });
  const stale = await status('respuesta vieja tras devolver', '/api/bot/messages', 409, { bot: true, method: 'POST', body: { ...body, idempotencyKey: `qa:${run}:old` } });
  check('rechazo por epoch viejo', stale.data.error.code === 'stale_epoch');
  // El reloj HTTP no puede probar 1ms exacto; colocamos borde usando reloj BD.
  await sql`update conversation set last_message_at=now()-interval '90 days' where id=${f.conversation}`;
  await status('90 días exactos oculta historial', messages, 404, doctor);
  await status('90 días oculta adjunto', media, 404, doctor);
  const ad = await status('contacto conserva ficha pero oculta anuncio vencido', `/api/contacts/${f.contact}`, 200, doctor);
  check('anuncio vencido no revela contenido', !ad.data.anuncio?.body);
  await sql`update conversation set last_message_at=now() where id=${f.conversation}`;
  await status('borrado anticipado', `/api/conversations/${f.conversation}`, 202, { ...doctor, method: 'DELETE' });
  await status('borrado oculta inmediato', messages, 404, doctor);
  await status('borrado oculta adjunto', media, 404, doctor);
  await eventually(() => purged(f));
  check('purga elimina texto/archivo y conserva ficha', await purged(f));
  await status('DELETE repetido idempotente', `/api/conversations/${f.conversation}`, 202, { ...doctor, method: 'DELETE' });
  const pending = await fixture(org, `${run}_restart`);
  await sql`update conversation set content_deleted_at=now(),content_purge_pending=true,ai_enabled=false,control_epoch=control_epoch+1 where id=${pending.conversation}`;
  await writeFile(checkpoint, JSON.stringify(pending));
  check('checkpoint de purga durable preparado para reinicio', (await counts(pending)).messages === 1);
  console.log('PENDIENTE reiniciar app y ejecutar --resume-purge');
}
try { await main(); console.log(`RESULTADO ${checks} checks PASS`); }
catch (error) { console.error(`FAIL ${error instanceof assert.AssertionError ? error.message : error?.code ?? error?.name ?? 'error'}; no se imprimen cuerpos ni DSN`); process.exitCode = 1; }
finally { await sql.end(); }
