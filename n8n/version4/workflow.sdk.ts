import { workflow, node, trigger, sticky, ifElse, languageModel, memory, tool, fromAi, expr } from '@n8n/workflow-sdk';

const REDIS = { redis: { id: 'FnjqRrvN9HEkaW8H', name: 'Redis account' } };
const KAPSO = { kapsoApi: { id: 'OaRk3Pa2Y75dao1H', name: 'Kapso account' } };
const GCAL = { googleCalendarOAuth2Api: { id: 'cHPuJsGrmnIOE2X5', name: 'Google Calendar account' } };
const CAL = { __rl: true, mode: 'list', value: 'davidecondet@gmail.com', cachedResultName: 'davidecondet@gmail.com' };
const SELF = { __rl: true, mode: 'id', value: '={{ $workflow.id }}' };
const IFOPTS = { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 };
const TOOL_SCHEMA = [
  { id: 'accion', displayName: 'accion', required: false, display: true, type: 'string' },
  { id: 'fecha', displayName: 'fecha', required: false, display: true, type: 'string' },
  { id: 'hora', displayName: 'hora', required: false, display: true, type: 'string' },
  { id: 'servicio', displayName: 'servicio', required: false, display: true, type: 'string' },
  { id: 'nombre', displayName: 'nombre', required: false, display: true, type: 'string' },
  { id: 'telefono', displayName: 'telefono', required: false, display: true, type: 'string' }
];

const webhookKapso = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Webhook Kapso', parameters: { httpMethod: 'POST', path: '815c58df-43f7-4f91-bde5-6935b562214c', options: {} }, position: [0, 0] },
  output: [{ body: { data: [{ message: { id: 'wamid.1', from: '593900000000', type: 'text', text: { body: 'hola' }, kapso: { direction: 'inbound' } }, conversation: { phone_number: '593900000000', contact_name: 'Ana' }, phone_number_id: '1347989838397545' }] } }]
});

const normalizar = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Normalizar mensaje', parameters: { jsCode: "// Kapso agrupa mensajes (búfer): body.data = [ { message, conversation, phone_number_id }, ... ]\n// Valida origen, ignora salientes y junta el lote en una sola entrada para el agente.\nconst PERMITIDO = '1347989838397545'; // phone_number_id del negocio\nconst body = $json.body ?? $json;\nconst items = Array.isArray(body.data) ? body.data : [body];\nconst textos = [], ids = [];\nlet from = '', pnid = '', nombre = '';\n\nfor (const it of items) {\n  const msg = it.message ?? {};\n  if (msg.kapso?.direction && msg.kapso.direction !== 'inbound') continue;\n  const p = String(it.phone_number_id || it.conversation?.phone_number_id || '');\n  if (p && p !== PERMITIDO) continue;\n  pnid = p || pnid;\n  from = msg.from || it.conversation?.phone_number || from;\n  nombre = it.conversation?.contact_name || nombre;\n  if (msg.id) ids.push(String(msg.id));\n  const t = String(msg.text?.body || msg.kapso?.content || '').replace(/[\\u0000-\\u0008\\u000b-\\u001f\\u007f]/g, '').trim().slice(0, 1000);\n  if (t) textos.push(t);\n  else if (msg.type) textos.push('[El cliente envió un mensaje de tipo \"' + msg.type + '\" que no puedo leer]');\n}\n\nconst to = String(from).replace(/\\D/g, '');\nif (!to || textos.length === 0) return [];\n\nreturn [{ json: {\n  text: textos.join('\\n').slice(0, 3000),\n  to, nombre: String(nombre).slice(0, 80),\n  phoneNumberId: pnid || PERMITIDO,\n  message_id: ids[ids.length - 1] || ('sin-id-' + $execution.id),\n  message_ids: ids\n} }];" }, position: [224, 0] },
  output: [{ text: 'hola', to: '593900000000', nombre: 'Ana', phoneNumberId: '1347989838397545', message_id: 'wamid.1', message_ids: ['wamid.1'] }]
});

const dedup = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Dedup mensaje', parameters: { operation: 'incr', key: expr("{{ 'v4:dedup:' + $json.message_id }}"), expire: true, ttl: 86400 }, credentials: REDIS, position: [448, 0] },
  output: [{ 'v4:dedup:wamid.1': 1 }]
});

const esNuevo = ifElse({
  version: 2.3,
  config: { name: '¿Mensaje nuevo?', parameters: { conditions: { options: IFOPTS, conditions: [{ leftValue: expr('{{ Number(Object.values($json)[0]) }}'), operator: { type: 'number', operation: 'equals' }, rightValue: 1 }], combinator: 'and' }, options: {} }, position: [672, 0] }
});

const lock = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Lock conversación', parameters: { operation: 'incr', key: expr("{{ 'v4:lock:' + $('Normalizar mensaje').first().json.to }}"), expire: true, ttl: 120 }, credentials: REDIS, position: [880, 0] },
  output: [{ 'v4:lock:593900000000': 1 }]
});

const libre = ifElse({
  version: 2.3,
  config: { name: '¿Conversación libre?', parameters: { conditions: { options: IFOPTS, conditions: [{ leftValue: expr('{{ Number(Object.values($json)[0]) }}'), operator: { type: 'number', operation: 'equals' }, rightValue: 1 }], combinator: 'and' }, options: {} }, position: [1104, 0] }
});

const encolar = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Encolar pendiente', parameters: { operation: 'push', list: expr("{{ 'v4:pending:' + $('Normalizar mensaje').first().json.to }}"), messageData: expr("{{ $('Normalizar mensaje').first().json.text }}"), tail: true }, credentials: REDIS, position: [1328, 208] },
  output: [{}]
});

const marcarLeido = node({
  type: '@kapso/n8n-nodes-kapso.kapso', version: 1,
  config: { name: 'Marcar leído (escribiendo…)', onError: 'continueRegularOutput', parameters: { resource: 'whatsAppMessage', operation: 'markAsRead', phoneNumberId: expr("{{ $('Normalizar mensaje').first().json.phoneNumberId }}"), messageId: expr("{{ $('Normalizar mensaje').first().json.message_id }}"), typingIndicator: true }, credentials: KAPSO, position: [1328, -96] },
  output: [{ success: true }]
});

const preparar = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Preparar turno', parameters: { jsCode: "// Texto para el agente: el lote original o los mensajes que llegaron mientras respondía.\nconst p = $input.first().json.pendientes;\nconst texto = Array.isArray(p) && p.length ? p.join('\\n') : $('Normalizar mensaje').first().json.text;\nreturn [{ json: { texto } }];" }, position: [1552, -96] },
  output: [{ texto: 'hola' }]
});

const openRouter = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', version: 1,
  config: { name: 'OpenRouter', parameters: { model: 'openrouter/free', options: { maxTokens: 800, temperature: 0.3, timeout: 45000, maxRetries: 1 } }, credentials: { openRouterApi: { id: 'lvm7ktHmLa07CR16', name: 'OpenRouter account' } }, position: [1600, 240] }
});

const gemini = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.2,
  config: { name: 'Gemini respaldo', parameters: { options: { maxOutputTokens: 1024, temperature: 0.3 } }, credentials: { googlePalmApi: { id: 'JswUKrV5wi0zoGRR', name: 'Google Gemini(PaLM) Api account' } }, position: [1744, 240] }
});

const memoria = memory({
  type: '@n8n/n8n-nodes-langchain.memoryRedisChat', version: 1.6,
  config: { name: 'Memoria Redis', parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ 'v4:chat:' + $('Normalizar mensaje').first().json.to }}"), sessionTTL: 86400, contextWindowLength: 12 }, credentials: REDIS, position: [1888, 240] }
});

const verTurnos = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2,
  config: { name: 'ver_turnos_libres', parameters: {
    description: 'Devuelve los turnos LIBRES de 1 hora (07:00-19:00) de un día, separados en "manana" y "tarde", leyendo Google Calendar. Úsala SIEMPRE antes de mencionar horas. Si ok=false lee "mensaje".',
    source: 'database', workflowId: SELF,
    workflowInputs: { mappingMode: 'defineBelow', matchingColumns: [], attemptToConvertTypes: false, convertFieldsToString: false, schema: TOOL_SCHEMA,
      value: { accion: 'turnos', fecha: fromAi('fecha', 'Día en formato YYYY-MM-DD (usa el CALENDARIO del prompt)'), hora: '', servicio: '', nombre: '', telefono: expr("{{ $('Normalizar mensaje').first().json.to }}") } }
  }, position: [2032, 240] }
});

const reservar = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2,
  config: { name: 'reservar_cita', parameters: {
    description: 'Crea la cita en Google Calendar. Úsala SOLO después de que el cliente confirmó con un sí. Vuelve a verificar que la hora siga libre. Devuelve reservada=true si se creó; si ok=false NO se creó.',
    source: 'database', workflowId: SELF,
    workflowInputs: { mappingMode: 'defineBelow', matchingColumns: [], attemptToConvertTypes: false, convertFieldsToString: false, schema: TOOL_SCHEMA,
      value: { accion: 'reservar', fecha: fromAi('fecha', 'Día en formato YYYY-MM-DD'), hora: fromAi('hora', 'Hora de inicio HH:00 en 24h, una de los turnos libres (ej. 15:00)'), servicio: fromAi('servicio', 'Nombre exacto del servicio de la lista'), nombre: fromAi('nombre', 'Nombre de quien asistirá a la cita'), telefono: expr("{{ $('Normalizar mensaje').first().json.to }}") } }
  }, position: [2176, 240] }
});

const buscarCitas = tool({
  type: 'n8n-nodes-base.googleCalendarTool', version: 1.3,
  config: { name: 'buscar_mis_citas', parameters: { descriptionType: 'manual', toolDescription: 'Lista las próximas citas de ESTE cliente (de hoy a 60 días). Devuelve id (event_id), summary y start. Úsala antes de mover o cancelar.', resource: 'event', operation: 'getAll', calendar: CAL, limit: 10, timeMin: expr('{{ $now.toISO() }}'), timeMax: expr('{{ $now.plus({ days: 60 }).toISO() }}'), options: { fields: 'items(id,summary,start,end)', orderBy: 'startTime', query: expr("{{ $('Normalizar mensaje').first().json.to }}") } }, credentials: GCAL, position: [2320, 240] }
});

const moverCita = tool({
  type: 'n8n-nodes-base.googleCalendarTool', version: 1.3,
  config: { name: 'mover_cita', parameters: { descriptionType: 'manual', toolDescription: 'Mueve una cita del cliente a otro día/hora (1 hora). Usa el event_id de buscar_mis_citas y una hora que salió libre en ver_turnos_libres. Solo después de que el cliente confirme.', resource: 'event', operation: 'update', calendar: CAL, eventId: fromAi('event_id', 'id del evento devuelto por buscar_mis_citas'),
    updateFields: {
      start: expr("{{ DateTime.fromISO($fromAI('nueva_fecha', 'Nuevo día YYYY-MM-DD', 'string') + 'T' + $fromAI('nueva_hora', 'Nueva hora HH:00 24h', 'string'), { zone: 'America/Guayaquil' }).toISO() }}"),
      end: expr("{{ DateTime.fromISO($fromAI('nueva_fecha', 'Nuevo día YYYY-MM-DD', 'string') + 'T' + $fromAI('nueva_hora', 'Nueva hora HH:00 24h', 'string'), { zone: 'America/Guayaquil' }).plus({ hours: 1 }).toISO() }}")
    } }, credentials: GCAL, position: [2464, 240] }
});

const cancelarCita = tool({
  type: 'n8n-nodes-base.googleCalendarTool', version: 1.3,
  config: { name: 'cancelar_cita', parameters: { descriptionType: 'manual', toolDescription: 'Cancela (elimina) una cita del cliente. Usa el event_id de buscar_mis_citas. Solo después de que el cliente confirme.', resource: 'event', operation: 'delete', calendar: CAL, eventId: fromAi('event_id', 'id del evento devuelto por buscar_mis_citas'), options: {} }, credentials: GCAL, position: [2608, 240] }
});

const agente = node({
  type: '@n8n/n8n-nodes-langchain.agent', version: 3.1,
  config: { name: 'Agente version4', onError: 'continueErrorOutput', parameters: { promptType: 'define', text: expr('{{ $json.texto }}'), needsFallback: true, options: { systemMessage: expr("Eres Sofi, la asistente por WhatsApp de Exclusive Barber Shop (Milagro, Ecuador). Atiendes con calidez, como una persona real, y ayudas a reservar, consultar, mover y cancelar citas.\n\nFECHA Y HORA ACTUAL: {{ $now.setZone('America/Guayaquil').setLocale('es').toFormat(\"cccc d 'de' LLLL 'de' yyyy, HH:mm\") }} (America/Guayaquil)\nCALENDARIO (día = fecha para herramientas): {{ [0,1,2,3,4,5,6,7].map(i => $now.setZone('America/Guayaquil').plus({ days: i })).map(d => d.setLocale('es').toFormat('cccc d LLL') + ' = ' + d.toFormat('yyyy-MM-dd')).join(' | ') }}\nCLIENTE: nombre en WhatsApp \"{{ $('Normalizar mensaje').first().json.nombre || 'desconocido' }}\". Ya tenemos su teléfono: NO lo pidas.\n\nNEGOCIO\n- Servicios: Corte clásico $5 | Corte degradado $6 | Cejas $2. Cada cita dura 1 hora.\n- Atención: turnos de 1 hora de 07:00 a 19:00. Mañana: 07:00 a 12:00. Tarde: 12:00 a 19:00.\n- Dirección: Milagro, Ecuador.\n\nFLUJO DE CONVERSACIÓN\n1. Saludo o charla (\"hola\", \"qué tal\", \"buenas\"): responde natural y amable, preséntate como Sofi y pregunta en qué le ayudas. No uses herramientas para esto.\n2. Si pide servicios, precios o una cita: muestra los servicios con precio y pregunta para qué día (si no lo dijo).\n3. Con el día: llama ver_turnos_libres y muestra los turnos así:\n   🌅 Mañana: 07:00 - 08:00, 08:00 - 09:00 ...\n   🌇 Tarde: 13:00 - 14:00 ...\n   Copia SOLO los turnos que devolvió la herramienta. Si una lista viene vacía di que en ese horario ya no hay. Si no hay nada, ofrece otro día.\n4. Cuando elija turno: pide el nombre de quien asistirá (si no lo tienes) y el servicio. Luego muestra un resumen (servicio, día, hora, precio) y pregunta \"¿Confirmo tu cita?\".\n5. Solo si responde que sí (sí, dale, confirmo, ok, perfecto): llama reservar_cita. Solo di que quedó agendada si respondió reservada=true. Si ok=false, explica sin tecnicismos y ofrece otros turnos.\n6. Ver/mover/cancelar: llama buscar_mis_citas. Para mover: ver_turnos_libres del nuevo día, confirma con el cliente y luego mover_cita. Para cancelar: confirma y luego cancelar_cita.\n\nREGLAS\n- Nunca inventes horas, precios ni servicios. Nunca digas que una hora está libre sin haber llamado ver_turnos_libres en este turno.\n- \"A las 4\" = 16:00. Fechas para herramientas YYYY-MM-DD (usa el CALENDARIO), horas HH:00 en 24h.\n- Si una herramienta falla, di que no pudiste revisar la agenda ahora y que te escriba en unos minutos.\n- Nunca muestres IDs, JSON, nombres de herramientas ni errores técnicos. No hables de citas de otros clientes.\n- Audio, imagen o mensaje vacío: pide amablemente que lo escriba.\n\nESTILO: tutea, mensajes cortos de WhatsApp (2 a 6 líneas), termina con una pregunta que guíe el siguiente paso. Máximo un emoji por mensaje (además de 🌅/🌇 en la lista de turnos). Sin asteriscos dobles."), maxIterations: 8, enableStreaming: false } },
    subnodes: { model: [openRouter, gemini], memory: memoria, tools: [verTurnos, reservar, buscarCitas, moverCita, cancelarCita] }, position: [1776, -96] },
  output: [{ output: '¡Hola! Soy Sofi 😊 ¿En qué te ayudo?' }]
});

const responder = node({
  type: '@kapso/n8n-nodes-kapso.kapso', version: 1,
  config: { name: 'Responder por WhatsApp', onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 2000, parameters: { resource: 'whatsAppMessage', operation: 'sendText', phoneNumberId: expr("{{ $('Normalizar mensaje').first().json.phoneNumberId }}"), recipientMode: 'phoneNumber', to: expr("{{ $('Normalizar mensaje').first().json.to }}"), message: expr('{{ $json.output }}') }, credentials: KAPSO, position: [2112, -208] },
  output: [{ success: true }]
});

const avisarError = node({
  type: '@kapso/n8n-nodes-kapso.kapso', version: 1,
  config: { name: 'Avisar error al cliente', onError: 'continueRegularOutput', parameters: { resource: 'whatsAppMessage', operation: 'sendText', phoneNumberId: expr("{{ $('Normalizar mensaje').first().json.phoneNumberId }}"), recipientMode: 'phoneNumber', to: expr("{{ $('Normalizar mensaje').first().json.to }}"), message: '¡Hola! En este momento tengo muchos mensajes y no pude responderte bien. Escríbeme de nuevo en unos minutos, por favor 🙏' }, credentials: KAPSO, position: [2112, 32] },
  output: [{ success: true }]
});

const leerPendientes = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Leer pendientes', onError: 'continueRegularOutput', parameters: { operation: 'get', propertyName: 'pendientes', key: expr("{{ 'v4:pending:' + $('Normalizar mensaje').first().json.to }}"), keyType: 'list', options: {} }, credentials: REDIS, position: [2320, -208] },
  output: [{ pendientes: [] }]
});

const borrarPendientes = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Borrar pendientes', onError: 'continueRegularOutput', parameters: { operation: 'delete', key: expr("{{ 'v4:pending:' + $('Normalizar mensaje').first().json.to }}") }, credentials: REDIS, position: [2544, -208] },
  output: [{ pendientes: [] }]
});

const hayPendientes = ifElse({
  version: 2.3,
  config: { name: '¿Hay pendientes?', parameters: { conditions: { options: IFOPTS, conditions: [{ leftValue: expr("{{ Array.isArray($('Leer pendientes').first().json.pendientes) && $('Leer pendientes').first().json.pendientes.length > 0 }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, position: [2768, -208] }
});

const liberarLock = node({
  type: 'n8n-nodes-base.redis', version: 1,
  config: { name: 'Liberar lock', onError: 'continueRegularOutput', parameters: { operation: 'delete', key: expr("{{ 'v4:lock:' + $('Normalizar mensaje').first().json.to }}") }, credentials: REDIS, position: [2992, -96] },
  output: [{}]
});

const agendaEntrada = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.2,
  config: { name: 'Agenda (entrada interna)', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'accion', type: 'string' }, { name: 'fecha', type: 'string' }, { name: 'hora', type: 'string' }, { name: 'servicio', type: 'string' }, { name: 'nombre', type: 'string' }, { name: 'telefono', type: 'string' }] } }, position: [0, 640] },
  output: [{ accion: 'turnos', fecha: '2026-10-03', hora: '', servicio: '', nombre: '', telefono: '593900000000' }]
});

const validar = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Validar pedido', parameters: { jsCode: "// CONFIGURACIÓN DEL NEGOCIO (editar aquí)\nconst TZ = 'America/Guayaquil';\nconst APERTURA = 7;            // primer turno 07:00\nconst CIERRE = 19;             // último turno termina 19:00\nconst DIAS_CERRADOS = [];      // ej. ['lunes'] para no atender lunes\nconst MAX_DIAS = 60;\nconst SERVICIOS = [\n  { nombre: 'Corte clásico', precio: 5 },\n  { nombre: 'Corte degradado', precio: 6 },\n  { nombre: 'Cejas', precio: 2 }\n];\n\nconst inp = $('Agenda (entrada interna)').first().json;\nconst fail = (error, mensaje) => [{ json: { valido: false, ok: false, error, mensaje } }];\nconst accion = String(inp.accion || 'turnos').trim().toLowerCase();\nif (!['turnos', 'reservar'].includes(accion)) return fail('ACCION_INVALIDA', 'accion debe ser turnos o reservar');\n\nconst fecha = String(inp.fecha || '').trim();\nif (!/^\\d{4}-\\d{2}-\\d{2}$/.test(fecha)) return fail('FECHA_INVALIDA', 'La fecha debe tener formato YYYY-MM-DD');\nconst dia = DateTime.fromISO(fecha, { zone: TZ });\nif (!dia.isValid) return fail('FECHA_INVALIDA', 'Esa fecha no existe');\nconst hoy = DateTime.now().setZone(TZ).startOf('day');\nif (dia < hoy) return fail('FECHA_PASADA', 'Esa fecha ya pasó');\nif (dia > hoy.plus({ days: MAX_DIAS })) return fail('FECHA_MUY_LEJANA', 'Solo agendamos hasta ' + MAX_DIAS + ' días adelante');\nconst nombreDia = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'][dia.weekday - 1];\nif (DIAS_CERRADOS.includes(nombreDia)) return fail('DIA_CERRADO', 'El ' + nombreDia + ' no atendemos');\n\nlet servicio = null, hora = '', nombre = '';\nif (accion === 'reservar') {\n  const q = String(inp.servicio || '').trim().toLowerCase();\n  servicio = SERVICIOS.find(s => s.nombre.toLowerCase() === q) || SERVICIOS.find(s => q && (s.nombre.toLowerCase().includes(q) || q.includes(s.nombre.toLowerCase())));\n  if (!servicio) return fail('SERVICIO_INVALIDO', 'Servicios: ' + SERVICIOS.map(s => s.nombre).join(', '));\n  hora = String(inp.hora || '').trim().slice(0, 5);\n  if (/^\\d:\\d{2}$/.test(hora)) hora = '0' + hora;\n  if (!/^([01]\\d|2[0-3]):00$/.test(hora)) return fail('HORA_INVALIDA', 'La hora debe ser en punto, formato HH:00 (24h)');\n  nombre = String(inp.nombre || '').trim().slice(0, 80);\n  if (nombre.length < 2) return fail('FALTA_NOMBRE', 'Falta el nombre de quien asistirá');\n}\n\nreturn [{ json: {\n  valido: true, accion, fecha, dia: nombreDia, apertura: APERTURA, cierre: CIERRE,\n  desde: dia.set({ hour: APERTURA }).toISO(), hasta: dia.set({ hour: CIERRE }).toISO(),\n  hora, nombre, servicio: servicio?.nombre || '', precio: servicio?.precio ?? null,\n  telefono: String(inp.telefono || '').replace(/\\D/g, '')\n} }];" }, position: [224, 640] },
  output: [{ valido: true, accion: 'turnos', fecha: '2026-10-03', dia: 'sábado', apertura: 7, cierre: 19, desde: '2026-10-03T07:00:00.000-05:00', hasta: '2026-10-03T19:00:00.000-05:00', hora: '', nombre: '', servicio: '', precio: null, telefono: '593900000000' }]
});

const pedidoValido = ifElse({
  version: 2.3,
  config: { name: '¿Pedido válido?', parameters: { conditions: { options: IFOPTS, conditions: [{ leftValue: expr('{{ $json.valido }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, position: [448, 640] }
});

const leerCalendar = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Leer Google Calendar', retryOnFail: true, maxTries: 2, alwaysOutputData: true, parameters: { resource: 'event', operation: 'getAll', calendar: CAL, returnAll: true, timeMin: expr('{{ $json.desde }}'), timeMax: expr('{{ $json.hasta }}'), options: { orderBy: 'startTime', singleEvents: true } }, credentials: GCAL, position: [672, 560] },
  output: [{ id: 'ev1', summary: 'Ocupado', start: { dateTime: '2026-10-03T09:00:00-05:00' }, end: { dateTime: '2026-10-03T10:00:00-05:00' } }]
});

const calcular = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Calcular turnos (mañana / tarde)', parameters: { jsCode: "// Turnos de 1 hora (07-08, 08-09 ... 18-19) que no chocan con eventos de Google Calendar.\nconst TZ = 'America/Guayaquil';\nconst req = $('Validar pedido').first().json;\nconst dia = DateTime.fromISO(req.fecha, { zone: TZ });\nconst minimo = DateTime.now().setZone(TZ).plus({ minutes: 15 });\n\nconst ocupados = [];\nfor (const it of $input.all()) {\n  const ev = it.json || {};\n  if (!ev.start || ev.status === 'cancelled' || ev.transparency === 'transparent') continue;\n  const ini = ev.start.dateTime ? DateTime.fromISO(ev.start.dateTime) : DateTime.fromISO(ev.start.date, { zone: TZ });\n  const fin = ev.end?.dateTime ? DateTime.fromISO(ev.end.dateTime) : DateTime.fromISO(ev.end?.date || ev.start.date, { zone: TZ }).plus(ev.end?.date ? {} : { days: 1 });\n  if (ini.isValid && fin.isValid) ocupados.push([ini, fin]);\n}\n\nconst manana = [], tarde = [], libres = [];\nfor (let h = req.apertura; h < req.cierre; h++) {\n  const t = dia.set({ hour: h, minute: 0, second: 0, millisecond: 0 });\n  const f = t.plus({ hours: 1 });\n  if (t < minimo) continue;\n  if (ocupados.some(([a, b]) => t < b && f > a)) continue;\n  libres.push(t.toFormat('HH:mm'));\n  (h < 12 ? manana : tarde).push(t.toFormat('HH:mm') + ' - ' + f.toFormat('HH:mm'));\n}\n\nconst base = { fecha: req.fecha, dia: req.dia, manana, tarde };\nif (req.accion === 'turnos') {\n  return [{ json: { ok: true, crear: false, ...base, total: libres.length,\n    mensaje: libres.length ? 'Turnos libres de 1 hora' : 'No hay turnos libres ese día' } }];\n}\nif (!libres.includes(req.hora)) {\n  return [{ json: { ok: false, crear: false, error: 'HORA_NO_DISPONIBLE', ...base,\n    mensaje: 'Esa hora ya no está libre. Ofrece otra de manana/tarde.' } }];\n}\nconst inicio = dia.set({ hour: Number(req.hora.slice(0, 2)), minute: 0 });\nreturn [{ json: { ok: true, crear: true, fecha: req.fecha, dia: req.dia, hora: req.hora,\n  inicio: inicio.toISO(), fin: inicio.plus({ hours: 1 }).toISO(),\n  titulo: '💈 ' + req.servicio + ' - ' + req.nombre,\n  descripcion: 'Cliente: ' + req.nombre + '\\nTel: ' + req.telefono + '\\nServicio: ' + req.servicio + ' ($' + req.precio + ')\\nAgendado por WhatsApp (version4)',\n  servicio: req.servicio, precio: req.precio, nombre: req.nombre } }];" }, position: [896, 560] },
  output: [{ ok: true, crear: false, fecha: '2026-10-03', dia: 'sábado', manana: ['07:00 - 08:00'], tarde: ['13:00 - 14:00'], total: 2, mensaje: 'Turnos libres de 1 hora' }]
});

const crearCita = ifElse({
  version: 2.3,
  config: { name: '¿Crear cita?', parameters: { conditions: { options: IFOPTS, conditions: [{ leftValue: expr('{{ $json.crear }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, position: [1120, 560] }
});

const crearEvento = node({
  type: 'n8n-nodes-base.googleCalendar', version: 1.3,
  config: { name: 'Crear evento', parameters: { resource: 'event', operation: 'create', calendar: CAL, start: expr('{{ $json.inicio }}'), end: expr('{{ $json.fin }}'), additionalFields: { summary: expr('{{ $json.titulo }}'), description: expr('{{ $json.descripcion }}'), location: 'Exclusive Barber Shop, Milagro' } }, credentials: GCAL, position: [1344, 480] },
  output: [{ id: 'nuevo-evento' }]
});

const citaReservada = node({
  type: 'n8n-nodes-base.set', version: 3.4,
  config: { name: 'Cita reservada', parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
    { id: 'ok', name: 'ok', value: expr('{{ !!$json.id }}'), type: 'boolean' },
    { id: 'reservada', name: 'reservada', value: expr('{{ !!$json.id }}'), type: 'boolean' },
    { id: 'event_id', name: 'event_id', value: expr('{{ $json.id }}'), type: 'string' },
    { id: 'fecha', name: 'fecha', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.fecha }}"), type: 'string' },
    { id: 'dia', name: 'dia', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.dia }}"), type: 'string' },
    { id: 'hora', name: 'hora', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.hora }}"), type: 'string' },
    { id: 'servicio', name: 'servicio', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.servicio }}"), type: 'string' },
    { id: 'precio', name: 'precio', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.precio }}"), type: 'number' },
    { id: 'nombre', name: 'nombre', value: expr("{{ $('Calcular turnos (mañana / tarde)').first().json.nombre }}"), type: 'string' }
  ] } }, position: [1568, 480] },
  output: [{ ok: true, reservada: true, event_id: 'nuevo-evento' }]
});

const respTurnos = node({
  type: 'n8n-nodes-base.noOp', version: 1,
  config: { name: 'Respuesta turnos', position: [1344, 656] },
  output: [{ ok: true }]
});

const respInvalido = node({
  type: 'n8n-nodes-base.noOp', version: 1,
  config: { name: 'Respuesta pedido inválido', position: [672, 752] },
  output: [{ ok: false }]
});

const nota = sticky('## version4 · Bot WhatsApp en UN solo flujo\n**Arriba (Webhook Kapso):** normaliza el lote → dedup Redis → lock por conversación → agente Sofi (OpenRouter + Gemini respaldo, memoria Redis) → responde por Kapso → procesa pendientes → libera lock.\n\n**Abajo (Agenda interna):** el propio flujo se llama a sí mismo como herramienta. `turnos` = turnos libres de 1h 07:00-19:00 (mañana / tarde) desde Google Calendar. `reservar` = re-chequea y crea el evento (sin doble reserva).\n\nHorario, días cerrados y servicios: nodo **Validar pedido**.', [], { color: 5, position: [-32, 320], width: 620, height: 260 });

export default workflow('version4', 'version4')
  .add(webhookKapso)
  .to(normalizar)
  .to(dedup)
  .to(esNuevo.onTrue(lock.to(libre
    .onTrue(marcarLeido.to(preparar).to(agente))
    .onFalse(encolar))))
  .add(agente)
  .to(responder.to(leerPendientes.to(borrarPendientes.to(hayPendientes
    .onTrue(preparar)
    .onFalse(liberarLock)))))
  .add(agente.onError(avisarError.to(liberarLock)))
  .add(agendaEntrada)
  .to(validar)
  .to(pedidoValido
    .onTrue(leerCalendar.to(calcular).to(crearCita.onTrue(crearEvento.to(citaReservada)).onFalse(respTurnos)))
    .onFalse(respInvalido))
  .add(nota);
