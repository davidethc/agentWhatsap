import { workflow, node, trigger, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const PG = { postgres: newCredential('Supabase · n8n_bot') };
const REDIS = { redis: { id: 'FnjqRrvN9HEkaW8H', name: 'Redis account' } };
const GCAL = { googleCalendarOAuth2Api: { id: 'cHPuJsGrmnIOE2X5', name: 'Google Calendar account' } };
const KAPSO = { kapsoApi: { id: 'OaRk3Pa2Y75dao1H', name: 'Kapso account' } };

const cond = (leftValue, operator, rightValue) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [rightValue === undefined ? { leftValue, operator } : { leftValue, operator, rightValue }],
  combinator: 'and'
});
const isTrue = (e) => cond(expr(e), { type: 'boolean', operation: 'true', singleValue: true });
const rule = (key, field) => ({
  outputKey: key, renameOutput: true,
  conditions: cond(expr('{{ $json.' + field + ' }}'), { type: 'string', operation: 'equals' }, key)
});

const code = (name, jsCode) => node({ type: 'n8n-nodes-base.code', version: 2, config: { name, parameters: { jsCode } } });
const pg = (name, query, replacement, extra = {}) => node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name, ...extra, parameters: { operation: 'executeQuery', query, options: { queryReplacement: replacement } }, credentials: PG }
});

// ───────────── Entrada y contexto ─────────────
const entrada = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1,
  config: { name: 'Entrada', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [
    { name: 'accion', type: 'string' }, { name: 'business_id', type: 'string' }, { name: 'contact_id', type: 'string' },
    { name: 'fecha', type: 'string' }, { name: 'hora', type: 'string' }, { name: 'servicio', type: 'string' },
    { name: 'barbero', type: 'string' }, { name: 'nombre', type: 'string' }, { name: 'ref', type: 'string' },
    { name: 'hold_id', type: 'string' }
  ] } } }
});

const contexto = pg('Contexto negocio', 'select bot.business_context($1::uuid) as ctx;', '={{ [ $json.business_id ] }}', { executeOnce: true, retryOnFail: true, maxTries: 2 });

const validar = code('Validar entrada', `// Valida y normaliza lo que pide el agente. Nada de lo que llega del LLM se usa sin pasar por aquí.
const TZ = 'America/Guayaquil';
const inp = $('Entrada').first().json;
const ctx = $input.first().json.ctx || {};
const fail = (error, mensaje, extra = {}) => [{ json: { ruta: 'respuesta', ok: false, error, mensaje, ...extra } }];
const clean = (v, max = 80) => String(v ?? '').replace(/[\\u0000-\\u001f\\u007f]/g, ' ').trim().slice(0, max);
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const accion = norm(inp.accion);
const ACCIONES = ['disponibilidad', 'preparar_reserva', 'confirmar', 'mis_citas', 'preparar_cancelacion', 'preparar_reprogramacion'];
if (!ACCIONES.includes(accion)) return fail('ACCION_INVALIDA', 'Acción no soportada.');
if (!UUID.test(String(inp.business_id || '')) || !ctx.negocio) return fail('NEGOCIO_NO_CONFIGURADO', 'No pude leer la configuración del negocio.');
if (accion !== 'disponibilidad' && !UUID.test(String(inp.contact_id || ''))) return fail('CONTACTO_INVALIDO', 'No pude identificar al cliente.');

const base = { accion, business_id: inp.business_id, contact_id: inp.contact_id || null };

if (accion === 'confirmar') {
  const hold_id = clean(inp.hold_id, 64);
  if (!/^[A-Z0-9]{10,40}$/.test(hold_id)) return fail('CONFIRMACION_INVALIDA', 'Falta el código de confirmación. Vuelve a preparar la reserva.');
  return [{ json: { ...base, ruta: 'confirmar', hold_id, nombre: clean(inp.nombre) } }];
}

let ref = null;
if (['preparar_cancelacion', 'preparar_reprogramacion'].includes(accion)) {
  ref = clean(inp.ref, 20).toUpperCase();
  if (!/^APP-[A-Z0-9]{6}$/.test(ref)) return fail('REF_INVALIDA', 'Pide al cliente el código de su cita (APP-XXXXXX) o muéstrale sus citas.');
}

// Fecha y hora (solo YYYY-MM-DD y HH:MM, siempre en America/Guayaquil)
let fecha = null, hora = null;
if (accion !== 'mis_citas' && accion !== 'preparar_cancelacion') {
  fecha = clean(inp.fecha, 10);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(fecha) || !DateTime.fromISO(fecha, { zone: TZ }).isValid) return fail('FECHA_INVALIDA', 'La fecha debe ser YYYY-MM-DD.');
  if (accion !== 'disponibilidad') {
    const m = clean(inp.hora, 5).match(/^(\\d{1,2}):(\\d{2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return fail('HORA_INVALIDA', 'La hora debe ser HH:MM en formato 24 h.');
    hora = m[1].padStart(2, '0') + ':' + m[2];
  }
}

if (accion === 'mis_citas' || accion === 'preparar_cancelacion' || accion === 'preparar_reprogramacion') {
  return [{ json: { ...base, ruta: 'citas', ref, fecha, hora } }];
}

// Servicio
const servicios = ctx.servicios || [];
const q = norm(inp.servicio);
const svc = servicios.find(s => s.service_id === clean(inp.servicio)) || servicios.find(s => norm(s.nombre) === q)
  || servicios.find(s => q && (norm(s.nombre).includes(q) || q.includes(norm(s.nombre))));
if (!svc) return fail('SERVICIO_INVALIDO', 'Pregunta qué servicio quiere. Servicios: ' + servicios.map(s => s.nombre).join(', '));

// Barbero (MVP: si hay uno solo, ese)
const barberos = ctx.barberos || [];
const qb = norm(inp.barbero);
let barber = qb ? barberos.find(b => norm(b.nombre) === qb || norm(b.nombre).includes(qb)) : null;
if (!barber && barberos.length === 1) barber = barberos[0];
if (!barber) return fail('BARBERO_REQUERIDO', 'Pregunta con qué barbero. Barberos: ' + barberos.map(b => b.nombre).join(', '));
const cal = ((ctx.config || {}).calendars || []).find(c => c.barber_id === barber.barber_id);
if (!cal) return fail('BARBERO_SIN_CALENDARIO', 'Ese barbero no tiene agenda configurada.');

let nombre = null;
if (accion === 'preparar_reserva') {
  nombre = clean(inp.nombre);
  if (nombre.length < 2) return fail('NOMBRE_REQUERIDO', 'Pide el nombre del cliente antes de preparar la reserva.');
}

return [{ json: { ...base, ruta: 'calendario', paso: 'slots', fecha, hora, nombre, ref,
  service_id: svc.service_id, servicio: svc.nombre, barber_id: barber.barber_id, barbero: barber.nombre, calendar_id: cal.calendar_id } }];`);

const ruta = switchCase({
  version: 3.2,
  config: { name: 'Ruta', parameters: {
    rules: { values: [rule('calendario', 'ruta'), rule('citas', 'ruta'), rule('confirmar', 'ruta')] },
    options: { fallbackOutput: 'extra', renameFallbackOutput: 'respuesta' }
  } }
});

const fin = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Fin' } });

// ───────────── Calendario compartido (disponibilidad / reservar / reprogramar) ─────────────
const rango = code('Rango calendario', `// Día completo en America/Guayaquil para leer Google Calendar.
const TZ = 'America/Guayaquil';
const inp = $input.first().json;
const req = inp.paso ? inp : $('Validar confirmación').first().json;
const d = DateTime.fromISO(req.fecha, { zone: TZ }).startOf('day');
return [{ json: { ...req, time_min: d.toISO(), time_max: d.plus({ days: 1 }).toISO() } }];`);

const leerCal = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Leer Google Calendar', alwaysOutputData: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: { resource: 'event', operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: expr('{{ $json.calendar_id }}') },
      returnAll: true, timeMin: expr('{{ $json.time_min }}'), timeMax: expr('{{ $json.time_max }}'),
      options: { singleEvents: true, orderBy: 'startTime' } },
    credentials: GCAL }
});

const ocupado = code('Calcular ocupado', `// Convierte los eventos de Google Calendar en intervalos ocupados para Supabase.
const TZ = 'America/Guayaquil';
const req = $('Rango calendario').first().json;
const busy = [];
for (const it of $input.all()) {
  const ev = it.json || {};
  if (!ev.id || !ev.start) continue;
  if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
  if (req.ref && String(ev.description || '').includes('Ref: ' + req.ref)) continue; // su propia cita al reprogramar
  let start, end;
  if (ev.start.dateTime) { start = ev.start.dateTime; end = (ev.end && ev.end.dateTime) || start; }
  else {
    start = DateTime.fromISO(ev.start.date, { zone: TZ }).toISO();
    end = DateTime.fromISO((ev.end && ev.end.date) || ev.start.date, { zone: TZ }).toISO();
    if (end === start) end = DateTime.fromISO(start).plus({ days: 1 }).toISO();
  }
  busy.push({ barber_id: req.barber_id, start, end });
}
return [{ json: { ...req, busy } }];`);

const paso = switchCase({
  version: 3.2,
  config: { name: 'Siguiente paso', parameters: {
    rules: { values: [rule('slots', 'paso'), rule('reservar', 'paso'), rule('reprogramar', 'paso')] }
  } }
});

// ───────────── Disponibilidad y holds ─────────────
const pgSlots = pg('Turnos libres (Supabase)',
  'select bot.available_slots($1::uuid, $2::date, $3::uuid, $4::uuid, $5::jsonb, null) as r;',
  '={{ [ $json.business_id, $json.fecha, $json.service_id, $json.barber_id, JSON.stringify($json.busy) ] }}');

const resultado = code('Resultado disponibilidad', `// Arma la respuesta de disponibilidad. Si es una preparación válida, crea un hold.
const MSG = { FECHA_PASADA: 'Esa fecha ya pasó.', FECHA_MUY_LEJANA: 'Solo se agenda con poca anticipación; ofrece una fecha más cercana.',
  NEGOCIO_CERRADO: 'Ese día el local está cerrado.', DIA_CERRADO: 'Ese día no se atiende.', SERVICIO_INVALIDO: 'Servicio no válido.',
  BARBERO_INVALIDO: 'Ese barbero no está disponible para reservas.' };
const req = $('Calcular ocupado').first().json;
const ctx = $('Contexto negocio').first().json.ctx;
const r = $input.first().json.r || {};
if (!r.ok) return [{ json: { crear_hold: false, ok: false, error: r.error || 'ERROR', fecha: req.fecha, mensaje: MSG[r.error] || 'No pude consultar la disponibilidad.' } }];
const b = (r.barberos || [])[0] || {};
const turnos = b.turnos || [];
const info = { fecha: req.fecha, dia: r.dia, servicio: r.servicio, precio: r.precio, duracion_min: r.duracion_min, barbero: b.barbero };
if (req.accion === 'disponibilidad') {
  return [{ json: { crear_hold: false, ok: true, ...info, turnos_libres: turnos,
    mensaje: turnos.length ? 'Ofrece solo horas de turnos_libres.' : 'No hay turnos libres ese día; ofrece otro día.' } }];
}
if (!turnos.includes(req.hora)) {
  return [{ json: { crear_hold: false, ok: false, error: 'HORA_NO_DISPONIBLE', ...info, hora: req.hora, turnos_libres: turnos,
    mensaje: 'Esa hora no está libre. Ofrece horas de turnos_libres.' } }];
}
const hold_id = ('H' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)).toUpperCase();
const tipo = req.accion === 'preparar_reprogramacion' ? 'reprogramacion' : 'reserva';
const hold = { tipo, business_id: req.business_id, contact_id: req.contact_id, service_id: req.service_id, servicio: r.servicio,
  precio: r.precio, barber_id: req.barber_id, barbero: b.barbero, calendar_id: req.calendar_id, fecha: req.fecha, hora: req.hora,
  nombre: req.nombre, ref: req.ref, creado: DateTime.now().toISO() };
const ttl = Math.max(60, Number((ctx.config || {}).hold_ttl_min || 10) * 60);
return [{ json: { crear_hold: true, hold_key: 'hold:' + hold_id, hold_value: JSON.stringify(hold), hold_ttl: ttl,
  respuesta: { ok: true, requiere_confirmacion: true, hold_id, tipo, ...info, hora: req.hora, nombre: req.nombre, ref: req.ref,
    valido_minutos: Math.round(ttl / 60),
    mensaje: 'AÚN NO está ' + (tipo === 'reserva' ? 'reservada' : 'reprogramada') + '. Resume los datos y pide al cliente que confirme con un sí. Luego llama a confirmar con este hold_id.' } } }];`);

const crearHoldIf = ifElse({ version: 2.2, config: { name: '¿Crear hold?', parameters: { conditions: isTrue('{{ $json.crear_hold }}') } } });

const guardarHold = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Guardar hold (Redis)', parameters: { operation: 'set', key: expr('{{ $json.hold_key }}'), value: expr('{{ $json.hold_value }}'),
    keyType: 'string', expire: true, ttl: expr('{{ $json.hold_ttl }}') }, credentials: REDIS }
});

const respHold = code('Respuesta hold', `return [{ json: $input.first().json.respuesta }];`);

// ───────────── Citas del cliente (listar / preparar cancelación / preparar reprogramación) ─────────────
const pgMisCitas = pg('Mis citas (Supabase)', 'select bot.my_appointments($1::uuid) as r;', '={{ [ $json.contact_id ] }}');

const resolverCitas = code('Resolver citas', `// Lista citas o prepara cancelación/reprogramación SOLO sobre citas del propio cliente.
const req = $('Validar entrada').first().json;
const ctx = $('Contexto negocio').first().json.ctx;
const citas = ($input.first().json.r || {}).citas || [];
if (req.accion === 'mis_citas') {
  return [{ json: { crear_hold: false, ok: true, citas, mensaje: citas.length ? 'Citas activas del cliente.' : 'El cliente no tiene citas activas.' } }];
}
const cita = citas.find(c => c.ref === req.ref);
if (!cita) return [{ json: { crear_hold: false, ok: false, error: 'CITA_NO_ENCONTRADA', citas,
  mensaje: 'Ese código no corresponde a una cita activa del cliente. Muéstrale sus citas.' } }];

if (req.accion === 'preparar_cancelacion') {
  const hold_id = ('H' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)).toUpperCase();
  const ttl = Math.max(60, Number((ctx.config || {}).hold_ttl_min || 10) * 60);
  const hold = { tipo: 'cancelacion', business_id: req.business_id, contact_id: req.contact_id, ref: cita.ref, fecha: cita.fecha, hora: cita.hora, creado: DateTime.now().toISO() };
  return [{ json: { crear_hold: true, hold_key: 'hold:' + hold_id, hold_value: JSON.stringify(hold), hold_ttl: ttl,
    respuesta: { ok: true, requiere_confirmacion: true, hold_id, tipo: 'cancelacion', cita, valido_minutos: Math.round(ttl / 60),
      mensaje: 'AÚN NO está cancelada. Pregunta al cliente si confirma la cancelación y luego llama a confirmar con este hold_id.' } } }];
}

// preparar_reprogramacion: misma cita, nuevo día/hora → se valida contra Calendar + Supabase
const svc = (ctx.servicios || []).find(s => s.nombre === cita.servicio);
const barber = (ctx.barberos || []).find(b => b.nombre === cita.barbero);
const cal = barber && ((ctx.config || {}).calendars || []).find(c => c.barber_id === barber.barber_id);
if (!svc || !barber || !cal) return [{ json: { crear_hold: false, ok: false, error: 'CITA_NO_REPROGRAMABLE', mensaje: 'Esa cita no se puede mover por WhatsApp; ofrece contactar al local.' } }];
return [{ json: { ir_calendario: true, ...req, paso: 'slots', service_id: svc.service_id, servicio: svc.nombre,
  barber_id: barber.barber_id, barbero: barber.nombre, calendar_id: cal.calendar_id } }];`);

const irCalIf = ifElse({ version: 2.2, config: { name: '¿Consultar calendario?', parameters: { conditions: isTrue('{{ $json.ir_calendario === true }}') } } });

// ───────────── Confirmación (consume el hold) ─────────────
const leerHold = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Leer hold (Redis)', parameters: { operation: 'get', key: expr('hold:{{ $json.hold_id }}'), propertyName: 'hold', keyType: 'string' }, credentials: REDIS }
});

const validarHold = code('Validar confirmación', `// El hold debe existir, no haber expirado y pertenecer a este mismo cliente.
const req = $('Validar entrada').first().json;
const raw = $input.first().json.hold;
let h = null;
try { h = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { h = null; }
const hold_key = 'hold:' + req.hold_id;
if (!h || !h.tipo) return [{ json: { paso: 'error', hold_key, ok: false, error: 'CONFIRMACION_EXPIRADA',
  mensaje: 'La pre-reserva expiró o ya se usó. Vuelve a consultar disponibilidad y prepara de nuevo.' } }];
if (h.contact_id !== req.contact_id || h.business_id !== req.business_id) return [{ json: { paso: 'error', hold_key, ok: false,
  error: 'CONFIRMACION_INVALIDA', mensaje: 'Ese código de confirmación no es de este cliente.' } }];
const paso = h.tipo === 'reserva' ? 'reservar' : h.tipo === 'reprogramacion' ? 'reprogramar' : 'cancelar';
const nombre = (req.nombre || h.nombre || '').trim();
return [{ json: { ...h, nombre, paso, hold_id: req.hold_id, hold_key,
  lock_key: 'lock:slot:' + h.barber_id + ':' + h.fecha + ':' + h.hora } }];`);

const consumirHold = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Consumir hold (Redis)', parameters: { operation: 'delete', key: expr('{{ $json.hold_key }}') }, credentials: REDIS }
});

const tipoConf = switchCase({
  version: 3.2,
  config: { name: 'Tipo de confirmación', parameters: {
    rules: { values: [rule('reservar', 'paso'), rule('cancelar', 'paso'), rule('reprogramar', 'paso')] },
    options: { fallbackOutput: 'extra', renameFallbackOutput: 'error' }
  } }
});

// Reserva: lock de turno → Calendar → Supabase (advisory lock) → evento → sincronizado
const lockTurno = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Lock de turno (Redis)', parameters: { operation: 'incr', key: expr('{{ $json.lock_key }}'), expire: true, ttl: 60 }, credentials: REDIS }
});

const lockIf = ifElse({ version: 2.2, config: { name: '¿Turno libre en Redis?', parameters: {
  conditions: cond(expr('{{ Number(Object.values($json)[0]) }}'), { type: 'number', operation: 'equals' }, 1) } } });

const turnoEnProceso = code('Turno en proceso', `return [{ json: { ok: false, error: 'TURNO_EN_PROCESO',
  mensaje: 'No puedo confirmar ese horario todavía porque acaba de ser solicitado. Ofrece consultar otras horas.' } }];`);

const pgCrear = pg('Crear cita (Supabase)',
  'select bot.create_booking($1::uuid, $2::uuid, $3::uuid, $4::date, $5::text, $6::text, $7::jsonb) as r;',
  '={{ [ $json.contact_id, $json.service_id, $json.barber_id, $json.fecha, $json.hora, $json.nombre, JSON.stringify($json.busy) ] }}');

const creadaIf = ifElse({ version: 2.2, config: { name: '¿Cita creada en BD?', parameters: { conditions: isTrue('{{ $json.r.ok === true }}') } } });

const crearEvento = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Crear evento', onError: 'continueErrorOutput',
    parameters: { resource: 'event', operation: 'create',
      calendar: { __rl: true, mode: 'id', value: expr('{{ $json.r.calendar_id }}') },
      start: expr('{{ $json.r.inicio }}'), end: expr('{{ $json.r.fin }}'),
      additionalFields: {
        summary: expr('💈 {{ $json.r.servicio }} - {{ $json.r.cliente }}'),
        description: expr('Cliente: {{ $json.r.cliente }}\nWhatsApp: {{ $json.r.whatsapp || "N/D" }}\nServicio: {{ $json.r.servicio }} (${{ $json.r.precio }})\nBarbero: {{ $json.r.barbero }}\nRef: {{ $json.r.ref }}\nAgendado por WhatsApp'),
        location: expr("{{ $('Contexto negocio').first().json.ctx.negocio.direccion }}")
      } },
    credentials: GCAL }
});

const eventoIf = ifElse({ version: 2.2, config: { name: '¿Evento creado?', parameters: {
  conditions: cond(expr('{{ $json.id }}'), { type: 'string', operation: 'notEmpty', singleValue: true }) } } });

const marcarSync = pg('Marcar sincronizada',
  'select bot.mark_calendar_result($1::uuid, true, $2::text, null) as r;',
  "={{ [ $('Crear cita (Supabase)').first().json.r.appointment_id, $json.id ] }}", { onError: 'continueRegularOutput' });

const adminIf = ifElse({ version: 2.2, config: { name: '¿Avisar al admin?', parameters: {
  conditions: isTrue("{{ !!($('Contexto negocio').first().json.ctx.config.admin_whatsapp && $('Contexto negocio').first().json.ctx.config.admin_template_name) }}") } } });

const avisoAdmin = node({
  type: '@kapso/n8n-nodes-kapso.kapso', version: 1,
  config: { name: 'Aviso al admin (plantilla)', onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2,
    parameters: { resource: 'whatsAppMessage', operation: 'sendTemplate',
      phoneNumberId: expr("{{ $('Contexto negocio').first().json.ctx.config.allowed_phone_number_id }}"),
      recipientMode: 'phoneNumber',
      to: expr("{{ $('Contexto negocio').first().json.ctx.config.admin_whatsapp }}"),
      templateName: expr("{{ $('Contexto negocio').first().json.ctx.config.admin_template_name }}"),
      languageCode: expr("{{ $('Contexto negocio').first().json.ctx.config.admin_template_language || 'es' }}"),
      componentsJson: expr("{{ JSON.stringify([{ type: 'body', parameters: [ $('Crear cita (Supabase)').first().json.r.cliente, $('Crear cita (Supabase)').first().json.r.servicio, $('Crear cita (Supabase)').first().json.r.fecha, $('Crear cita (Supabase)').first().json.r.hora, $('Crear cita (Supabase)').first().json.r.ref ].map(t => ({ type: 'text', text: String(t) })) }]) }}")
    },
    credentials: KAPSO }
});

const respReserva = code('Respuesta reserva confirmada', `// Solo llega aquí si Supabase creó la cita Y Google Calendar devolvió el id del evento.
const r = $('Crear cita (Supabase)').first().json.r;
return [{ json: { ok: true, reservada: true, ref: r.ref, fecha: r.fecha, dia: r.dia, hora: r.hora, hora_fin: r.hora_fin,
  servicio: r.servicio, precio: r.precio, barbero: r.barbero, cliente: r.cliente,
  mensaje: 'Reserva confirmada en agenda. Comunica el código ' + r.ref + ' al cliente.' } }];`);

const anular = pg('Anular cita (compensación)', 'select bot.abort_booking($1::uuid, $2::text) as r;',
  "={{ [ $('Crear cita (Supabase)').first().json.r.appointment_id, 'calendar_error: ' + String($json.error || 'sin id de evento').slice(0, 150) ] }}",
  { retryOnFail: true, maxTries: 3 });

const liberarLock = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Liberar lock de turno', onError: 'continueRegularOutput',
    parameters: { operation: 'delete', key: expr("{{ $('Validar confirmación').first().json.lock_key }}") }, credentials: REDIS }
});

const respReservaFallida = code('Respuesta reserva fallida', `// Nunca se confirma una reserva si BD o Calendar no la confirmaron.
const MSG = { HORA_NO_DISPONIBLE: 'Ese horario ya no está disponible. Ofrece otras horas de turnos_libres.',
  RESERVA_DUPLICADA: 'El cliente ya tiene una cita a esa hora.', NOMBRE_REQUERIDO: 'Falta el nombre del cliente.',
  FECHA_PASADA: 'Esa fecha ya pasó.', DIA_CERRADO: 'Ese día no se atiende.', NEGOCIO_CERRADO: 'Ese día el local está cerrado.' };
const r = $('Crear cita (Supabase)').first().json.r || {};
if (r.ok !== true) {
  return [{ json: { ok: false, reservada: false, error: r.error || 'ERROR', ref: r.ref, turnos_libres: r.turnos_libres,
    mensaje: MSG[r.error] || 'No pude completar la reserva. No confirmes nada al cliente.' } }];
}
return [{ json: { ok: false, reservada: false, error: 'CALENDARIO_NO_CONFIRMO',
  mensaje: 'No pude completar la reserva y no quiero darte una confirmación incorrecta. Pide al cliente intentar de nuevo en unos minutos.' } }];`);

// Cancelación
const pgCancelar = pg('Cancelar cita (Supabase)', "select bot.cancel_booking($1::uuid, $2::text, 'cliente_whatsapp') as r;",
  '={{ [ $json.contact_id, $json.ref ] }}');

const cancEventoIf = ifElse({ version: 2.2, config: { name: '¿Cancelada con evento?', parameters: {
  conditions: isTrue('{{ $json.r.ok === true && !!$json.r.calendar_event_id }}') } } });

const borrarEvento = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Borrar evento', onError: 'continueErrorOutput', retryOnFail: true, maxTries: 2,
    parameters: { resource: 'event', operation: 'delete',
      calendar: { __rl: true, mode: 'id', value: expr('{{ $json.r.calendar_id }}') },
      eventId: expr('{{ $json.r.calendar_event_id }}'), options: {} },
    credentials: GCAL }
});

const marcarCancel = pg('Marcar cancelación en Calendar', 'select bot.mark_calendar_result($1::uuid, $2::boolean, $3::text, $4::text) as r;',
  "={{ [ $('Cancelar cita (Supabase)').first().json.r.appointment_id, !$json.error, $('Cancelar cita (Supabase)').first().json.r.calendar_event_id, $json.error ? String($json.error).slice(0, 150) : null ] }}",
  { onError: 'continueRegularOutput' });

const respCancel = code('Respuesta cancelación', `const r = $('Cancelar cita (Supabase)').first().json.r || {};
if (r.ok !== true) return [{ json: { ok: false, cancelada: false, error: r.error || 'ERROR',
  mensaje: r.error === 'CITA_NO_ACTIVA' ? 'Esa cita ya no está activa.' : 'No pude cancelar la cita. No confirmes la cancelación.' } }];
return [{ json: { ok: true, cancelada: true, ref: r.ref, fecha: r.fecha, hora: r.hora, servicio: r.servicio, mensaje: 'Cita cancelada.' } }];`);

// Reprogramación
const pgReprog = pg('Reprogramar cita (Supabase)', 'select bot.reschedule_booking($1::uuid, $2::text, $3::date, $4::text, $5::jsonb) as r;',
  '={{ [ $json.contact_id, $json.ref, $json.fecha, $json.hora, JSON.stringify($json.busy) ] }}');

const reprogIf = ifElse({ version: 2.2, config: { name: '¿Reprogramada con evento?', parameters: {
  conditions: isTrue('{{ $json.r.ok === true && !!$json.r.calendar_event_id }}') } } });

const moverEvento = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Mover evento', onError: 'continueErrorOutput', retryOnFail: true, maxTries: 2,
    parameters: { resource: 'event', operation: 'update',
      calendar: { __rl: true, mode: 'id', value: expr('{{ $json.r.calendar_id }}') },
      eventId: expr('{{ $json.r.calendar_event_id }}'),
      updateFields: { start: expr('{{ $json.r.inicio }}'), end: expr('{{ $json.r.fin }}') } },
    credentials: GCAL }
});

const marcarReprog = pg('Marcar reprogramación', 'select bot.mark_calendar_result($1::uuid, true, $2::text, null) as r;',
  "={{ [ $('Reprogramar cita (Supabase)').first().json.r.appointment_id, $('Reprogramar cita (Supabase)').first().json.r.calendar_event_id ] }}",
  { onError: 'continueRegularOutput' });

const revertir = pg('Revertir reprogramación', 'select bot.revert_reschedule($1::uuid, $2::date, $3::text, $4::text) as r;',
  "={{ [ $('Reprogramar cita (Supabase)').first().json.r.appointment_id, $('Reprogramar cita (Supabase)').first().json.r.anterior.fecha, $('Reprogramar cita (Supabase)').first().json.r.anterior.hora, 'calendar_error' ] }}",
  { retryOnFail: true, maxTries: 3 });

const respReprog = code('Respuesta reprogramación', `const r = $('Reprogramar cita (Supabase)').first().json.r || {};
let revertida = false;
try { revertida = $('Revertir reprogramación').isExecuted; } catch (e) { revertida = false; }
if (r.ok !== true) return [{ json: { ok: false, reprogramada: false, error: r.error || 'ERROR', turnos_libres: r.turnos_libres,
  mensaje: r.error === 'HORA_NO_DISPONIBLE' ? 'Ese horario ya no está libre. Ofrece otras horas.' : 'No pude mover la cita. No confirmes el cambio.' } }];
if (revertida) return [{ json: { ok: false, reprogramada: false, error: 'CALENDARIO_NO_CONFIRMO',
  mensaje: 'No pude mover la cita en la agenda; su cita sigue en el horario anterior (' + r.anterior.fecha + ' ' + r.anterior.hora + ').' } }];
return [{ json: { ok: true, reprogramada: true, ref: r.ref, fecha: r.fecha, hora: r.hora, servicio: r.servicio, barbero: r.barbero,
  anterior: { fecha: r.anterior.fecha, hora: r.anterior.hora }, mensaje: 'Cita reprogramada.' } }];`);

// ───────────── Composición ─────────────
export default workflow('barberia-agenda-v2', 'Barbería · Agenda v2 (Supabase + Calendar)')
  .add(entrada)
  .to(contexto)
  .to(validar)
  .to(ruta
    .onCase(0, rango)
    .onCase(1, pgMisCitas.to(resolverCitas).to(irCalIf.onTrue(rango).onFalse(crearHoldIf)))
    .onCase(2, leerHold.to(validarHold).to(consumirHold).to(tipoConf
      .onCase(0, lockTurno.to(lockIf.onTrue(rango).onFalse(turnoEnProceso.to(fin))))
      .onCase(1, pgCancelar.to(cancEventoIf
        .onTrue(borrarEvento.onError(marcarCancel).to(marcarCancel).to(respCancel).to(fin))
        .onFalse(respCancel)))
      .onCase(2, rango)
      .onCase(3, fin)))
    .onCase(3, fin))
  .add(rango)
  .to(leerCal)
  .to(ocupado)
  .to(paso
    .onCase(0, pgSlots.to(resultado).to(crearHoldIf
      .onTrue(guardarHold.to(respHold).to(fin))
      .onFalse(fin)))
    .onCase(1, pgCrear.to(creadaIf
      .onTrue(crearEvento.onError(anular).to(eventoIf
        .onTrue(marcarSync.to(adminIf
          .onTrue(avisoAdmin.to(respReserva).to(fin))
          .onFalse(respReserva)))
        .onFalse(anular.to(liberarLock).to(respReservaFallida).to(fin))))
      .onFalse(liberarLock)))
    .onCase(2, pgReprog.to(reprogIf
      .onTrue(moverEvento.onError(revertir.to(respReprog)).to(marcarReprog).to(respReprog).to(fin))
      .onFalse(respReprog))));
