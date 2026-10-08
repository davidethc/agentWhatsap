import json
BID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WF2 = '4KQuSkJkUD9fyHcm'
REDIS = {"redis": {"id": "FnjqRrvN9HEkaW8H", "name": "Redis account"}}
PG = {"postgres": {"id": "BpL1KLgIU7DVuOVc", "name": "Postgres account"}}
GEM = {"googlePalmApi": {"id": "JswUKrV5wi0zoGRR", "name": "Google Gemini(PaLM) Api account"}}
N = "$('Normalizar mensaje').first().json"
CID = "$('Registrar entrada').first().json.r.contact_id"

def cond(left, op, right=None):
    c = {"leftValue": left, "operator": op}
    if right is not None: c["rightValue"] = right
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [c], "combinator": "and"}, "options": {}}
TRUE = {"type": "boolean", "operation": "true", "singleValue": True}

normalizar = r"""// Kapso agrupa mensajes (búfer): body.data = [ { message, conversation, phone_number_id }, ... ]
// Valida origen, ignora salientes y junta el lote en una sola entrada para el agente.
const PERMITIDO = '1347989838397545'; // phone_number_id del negocio (bot_settings.allowed_phone_number_id)
const body = $json.body ?? $json;
const items = Array.isArray(body.data) ? body.data : [body];
const textos = [], ids = [];
let from = '', bsuid = '', pnid = '', nombre = '', tipo = 'text', referral = null;

for (const it of items) {
  const msg = it.message ?? {};
  if (msg.kapso?.direction && msg.kapso.direction !== 'inbound') continue; // ignorar salientes
  const p = String(it.phone_number_id || it.conversation?.phone_number_id || '');
  if (p && p !== PERMITIDO) continue; // otro número: no es nuestro
  pnid = p || pnid;
  from = msg.from || it.conversation?.phone_number || from;
  bsuid = msg.from_user_id || it.conversation?.business_scoped_user_id || bsuid;
  nombre = it.conversation?.contact_name || nombre;
  if (msg.id) ids.push(String(msg.id));
  if (msg.referral) referral = msg.referral;
  let t = String(msg.text?.body || msg.kapso?.content || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 1000);
  if (t) textos.push(t);
  else if (msg.type) { tipo = msg.type; textos.push('[El cliente envió un mensaje de tipo "' + msg.type + '" que no puedo leer]'); }
}

const to = String(from).replace(/\D/g, '');
if ((!to && !bsuid) || textos.length === 0) return [];

return [{ json: {
  text: textos.join('\n').slice(0, 3000),
  to, bsuid, nombre: String(nombre).slice(0, 80), tipo,
  phoneNumberId: pnid || PERMITIDO,
  message_id: ids[0] || ('sin-id-' + $execution.id),
  message_ids: ids,
  referral: referral ? JSON.stringify(referral) : ''
} }];"""

preparar = """// Texto que verá el agente: el lote original o los mensajes que llegaron mientras respondía.
const p = $input.first().json.pendientes;
const texto = Array.isArray(p) && p.length ? p.join('\\n') : $('Normalizar mensaje').first().json.text;
return [{ json: { texto } }];"""

CTX = "$('Contexto negocio').first().json.ctx"
system = ("=Eres Sofi, la asistente virtual por WhatsApp de {{ " + CTX + ".negocio.nombre }}. Ayudas a reservar, consultar, cancelar y reprogramar citas, con calidez y en pocos mensajes.\n\n"
"REGLAS DE VERDAD (OBLIGATORIAS, POR ENCIMA DE TODO)\n"
"1. Tú NO sabes qué horas están libres. La agenda real (base de datos + Google Calendar) solo la conoce la herramienta \"ver_disponibilidad\". Antes de mencionar cualquier hora o decir que una hora está libre, llámala en ESTE turno y menciona solo horas de \"turnos_libres\", copiadas tal cual.\n"
"2. Reservar tiene DOS pasos:\n"
"   a) Cuando tengas servicio, día, hora y el nombre de quien asistirá, llama \"preparar_reserva\". Si responde requiere_confirmacion=true, muestra el resumen (servicio, día, hora, precio) y pregunta si confirma. Todavía NO está reservada.\n"
"   b) Solo cuando el cliente responda que sí (sí, dale, confirmo, ok, perfecto...), llama \"confirmar\".\n"
"3. Solo puedes decir que la cita quedó reservada si \"confirmar\" respondió reservada=true. Entonces da día, hora, servicio, dirección y el código de la cita (ref). Si ok=false, NO digas que quedó reservada: explica sin tecnicismos según \"mensaje\" y ofrece otras horas.\n"
"4. Cancelar: si no sabes el código, usa \"mis_citas\". Luego \"preparar_cancelacion\" con el código, pide confirmación y, si dice que sí, \"confirmar\". Solo di que se canceló si cancelada=true.\n"
"5. Reprogramar: \"mis_citas\" para el código, \"ver_disponibilidad\" para el nuevo día, \"preparar_reprogramacion\" con código, nueva fecha y nueva hora; pide confirmación y luego \"confirmar\". Solo di que se movió si reprogramada=true.\n"
"6. Si una herramienta da error o no responde, no inventes nada: di que no pudiste revisar la agenda en este momento y pide que te escriba en unos minutos.\n"
"7. Nunca muestres IDs internos, JSON, nombres de herramientas ni errores técnicos.\n\n"
"FECHA Y HORA ACTUAL: {{ $now.setZone('America/Guayaquil').setLocale('es').toFormat(\"cccc d 'de' LLLL 'de' yyyy, HH:mm\") }} (America/Guayaquil)\n"
"CALENDARIO (día = fecha para herramientas): {{ [0,1,2,3,4,5,6,7].map(i => $now.setZone('America/Guayaquil').plus({ days: i })).map(d => d.setLocale('es').toFormat('cccc d LLL') + ' = ' + d.toFormat('yyyy-MM-dd')).join(' | ') }}\n\n"
"CLIENTE\n"
"- Nombre en WhatsApp: {{ " + N + ".nombre || 'desconocido' }}\n"
"- Cliente nuevo: {{ $('Registrar entrada').first().json.r.is_new ? 'sí' : 'no' }}\n"
"- Citas próximas: {{ JSON.stringify($('Registrar entrada').first().json.r.citas_proximas || []) }}\n"
"- Tiene una pre-reserva/cambio esperando su \"sí\": {{ $('Leer pre-reserva').first().json.hold_last ? 'sí' : 'no' }}\n"
"- El teléfono ya lo tenemos: NO lo pidas.\n\n"
"NEGOCIO (servicios, precios, duración, horario de atención, cierres y dirección; NO indica qué horas están libres)\n"
"{{ JSON.stringify({ negocio: " + CTX + ".negocio, servicios: (" + CTX + ".servicios || []).map(s => ({ nombre: s.nombre, precio: s.precio, duracion_min: s.duracion_min, descripcion: s.descripcion })), horario: " + CTX + ".horario, cierres: " + CTX + ".cierres }) }}\n\n"
"CÓMO LLEVAR LA CONVERSACIÓN\n"
"- Primer mensaje (sin historial): saluda con calidez, preséntate como Sofi y pregunta en qué le ayudas (2-3 líneas). Si ya pide algo concreto, saluda en una línea y avanza.\n"
"- Si pregunta por servicios u horarios: lista corta de servicios con precio y llama \"ver_disponibilidad\" para el día que pidió (o mañana; si está cerrado, el siguiente día abierto). Ofrece 2 o 3 horas repartidas y pregunta cuál prefiere.\n"
"- Hora concreta (\"mañana a las 4\"): consulta ese día; si está en turnos_libres, ofrécela; si no, ofrece las más cercanas.\n"
"- Pide el nombre de quien asistirá si no lo tienes o si el nombre de WhatsApp parece un negocio o apodo.\n"
"- \"A las 4\" sin contexto = 16:00. Fechas para herramientas: YYYY-MM-DD (usa el CALENDARIO de arriba); horas: HH:MM 24h.\n"
"- Audio, imagen o mensaje vacío: pide amablemente que lo escriba.\n"
"- Nunca inventes servicios, precios ni promociones. Por privacidad no hables de otras citas o clientes.\n\n"
"ESTILO\n"
"- Amable, cercana y alegre. Tutea. Mensajes cortos de WhatsApp (2 a 5 líneas) que terminen con una pregunta que guíe el siguiente paso.\n"
"- Emojis: máximo UNO, al final, aprox. 1 de cada 3 mensajes. Usa: 😊 ✨ 💈 📅 🙌\n"
"- Responde solo con el mensaje para el cliente, sin asteriscos dobles.")

FIELDS = ['accion','business_id','contact_id','fecha','hora','servicio','barbero','nombre','ref','hold_id']
def tool(name, desc, accion, llm):
    value = {f: "" for f in FIELDS}
    value.update({"accion": accion, "business_id": BID, "contact_id": "={{ " + CID + " }}"})
    value.update(llm)
    return {"name": name, "type": "@n8n/n8n-nodes-langchain.toolWorkflow", "typeVersion": 2.2,
            "parameters": {"description": desc,
                "workflowId": {"__rl": True, "mode": "list", "value": WF2, "cachedResultName": "Barbería · Agenda v2 (Supabase + Calendar)"},
                "workflowInputs": {"mappingMode": "defineBelow", "value": value, "matchingColumns": [],
                    "schema": [{"id": f, "displayName": f, "type": "string", "display": True, "required": False} for f in FIELDS],
                    "attemptToConvertTypes": False, "convertFieldsToString": False}}}
FECHA = "={{ $fromAI('fecha', 'Día en formato YYYY-MM-DD (usa el CALENDARIO del prompt)', 'string') }}"
HORA = "={{ $fromAI('hora', 'Hora de inicio HH:MM en 24h, una de turnos_libres', 'string') }}"
SERV = "={{ $fromAI('servicio', 'Nombre del servicio de la lista del negocio', 'string') }}"
REF = "={{ $fromAI('ref', 'Código de la cita, formato APP-XXXXXX', 'string') }}"
tools = [
 tool("ver_disponibilidad", "Devuelve las horas LIBRES reales (agenda + Google Calendar) de un día para un servicio. Úsala SIEMPRE antes de mencionar horas. Si ok=false, lee 'mensaje'.", "disponibilidad", {"fecha": FECHA, "servicio": SERV}),
 tool("preparar_reserva", "Paso 1 de reservar: valida la hora y crea una pre-reserva por 10 minutos. NO reserva todavía. Úsala cuando tengas servicio, día, hora y nombre. Luego pide al cliente que confirme.", "preparar_reserva", {"fecha": FECHA, "hora": HORA, "servicio": SERV, "nombre": "={{ $fromAI('nombre', 'Nombre de quien asistirá a la cita', 'string') }}"}),
 tool("confirmar", "Paso final: confirma la pre-reserva, cancelación o reprogramación pendiente del cliente. Úsala SOLO después de que el cliente dijo que sí. Devuelve reservada / cancelada / reprogramada = true si se hizo; si ok=false NO se hizo.", "confirmar", {"hold_id": "={{ $('Leer pre-reserva').first().json.hold_last || '' }}"}),
 tool("mis_citas", "Lista las citas activas del cliente (código ref, día, hora, servicio).", "mis_citas", {}),
 tool("preparar_cancelacion", "Paso 1 de cancelar una cita del cliente por su código. NO cancela todavía; luego pide confirmación.", "preparar_cancelacion", {"ref": REF}),
 tool("preparar_reprogramacion", "Paso 1 de mover una cita del cliente a otro día/hora libre. NO la mueve todavía; luego pide confirmación.", "preparar_reprogramacion", {"ref": REF, "fecha": FECHA, "hora": HORA}),
]

ops = []
for old in ["Info negocio", "Ver turnos libres", "Agendar cita"]:
    ops.append({"type": "removeNode", "nodeName": old})
ops.append({"type": "updateNodeParameters", "nodeName": "Normalizar mensaje", "parameters": {"jsCode": normalizar}})

def add(name, typ, ver, pos, params, creds=None, **settings):
    n = {"name": name, "type": typ, "typeVersion": ver, "position": pos, "parameters": params}
    if creds: n["credentials"] = creds
    ops.append({"type": "addNode", "node": n})
    if settings: ops.append({"type": "setNodeSettings", "nodeName": name, "settings": settings})

add("Registrar entrada", "n8n-nodes-base.postgres", 2.6, [224, 64],
    {"operation": "executeQuery", "query": "select bot.register_inbound($1::uuid, nullif($2, ''), $3, nullif($4, ''), $5, $6, $7, nullif($8, '')::jsonb) as r;",
     "options": {"queryReplacement": "={{ [ '" + BID + "', $json.bsuid || '', $json.to, $json.nombre || '', $json.text, $json.message_id, $json.tipo, $json.referral || '' ] }}"}},
    PG, onError="continueErrorOutput", retryOnFail=True, maxTries=2)
add("¿Mensaje nuevo?", "n8n-nodes-base.if", 2.2, [448, 64],
    cond("={{ $json.r.ok === true && $json.r.duplicate !== true && !!$json.r.contact_id }}", TRUE))
add("Lock conversación", "n8n-nodes-base.redis", 1, [672, 0],
    {"operation": "incr", "key": "={{ 'lock:conv:' + " + N + ".to }}", "expire": True, "ttl": 90}, REDIS)
add("¿Conversación libre?", "n8n-nodes-base.if", 2.2, [896, 0],
    cond("={{ Number(Object.values($json)[0]) }}", {"type": "number", "operation": "equals"}, 1))
add("Encolar pendiente", "n8n-nodes-base.redis", 1, [1120, 200],
    {"operation": "push", "list": "={{ 'pending:' + " + N + ".to }}", "messageData": "={{ " + N + ".text }}", "tail": True}, REDIS)
add("Contexto negocio", "n8n-nodes-base.postgres", 2.6, [1120, -64],
    {"operation": "executeQuery", "query": "select bot.business_context($1::uuid) as ctx;", "options": {"queryReplacement": "={{ [ '" + BID + "' ] }}"}},
    PG, onError="continueErrorOutput", retryOnFail=True, maxTries=2)
add("Leer pre-reserva", "n8n-nodes-base.redis", 1, [1344, -64],
    {"operation": "get", "key": "={{ 'hold:last:' + " + CID + " }}", "propertyName": "hold_last", "keyType": "string"}, REDIS)
add("Preparar turno", "n8n-nodes-base.code", 2, [1568, -64], {"jsCode": preparar})
add("Registrar salida", "n8n-nodes-base.postgres", 2.6, [2240, -64],
    {"operation": "executeQuery", "query": "select bot.register_outbound($1::uuid, $2, nullif($3, ''), 'text', null) as r;",
     "options": {"queryReplacement": "={{ [ " + CID + ", $('Agente de citas').last().json.output, String(($json.messages && $json.messages[0] && $json.messages[0].id) || '') ] }}"}},
    PG, onError="continueRegularOutput")
add("Leer pendientes", "n8n-nodes-base.redis", 1, [2464, -64],
    {"operation": "get", "key": "={{ 'pending:' + " + N + ".to }}", "propertyName": "pendientes", "keyType": "list"}, REDIS, onError="continueRegularOutput")
add("Borrar pendientes", "n8n-nodes-base.redis", 1, [2688, -64],
    {"operation": "delete", "key": "={{ 'pending:' + " + N + ".to }}"}, REDIS, onError="continueRegularOutput")
add("¿Hay pendientes?", "n8n-nodes-base.if", 2.2, [2912, -64],
    cond("={{ Array.isArray($json.pendientes) && $json.pendientes.length > 0 }}", TRUE))
add("Liberar lock conversación", "n8n-nodes-base.redis", 1, [3136, 64],
    {"operation": "delete", "key": "={{ 'lock:conv:' + " + N + ".to }}"}, REDIS, onError="continueRegularOutput")
add("Gemini respaldo", "@n8n/n8n-nodes-langchain.lmChatGoogleGemini", 1.2, [1700, 300],
    {"modelName": "models/gemini-3.1-flash-lite", "options": {"maxOutputTokens": 1024, "temperature": 0.4}}, GEM)
for i, t in enumerate(tools):
    ops.append({"type": "addNode", "node": {**t, "position": [1900 + i * 160, 300]}})

# Agent, models, Kapso tweaks
ops.append({"type": "updateNodeParameters", "nodeName": "Agente de citas", "replace": True, "parameters": {
    "promptType": "define", "text": "={{ $json.texto }}", "needsFallback": True,
    "options": {"systemMessage": system, "maxIterations": 10}}})
ops.append({"type": "updateNodeParameters", "nodeName": "Google Gemini Chat Model", "replace": True, "parameters": {
    "modelName": "models/gemini-3-flash-preview", "options": {"maxOutputTokens": 1024, "temperature": 0.4}}})
ops.append({"type": "setNodeSettings", "nodeName": "Responder por WhatsApp", "settings": {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000}})
ops.append({"type": "setNodeSettings", "nodeName": "Avisar error al cliente", "settings": {"onError": "continueRegularOutput"}})

C = lambda s, t, si=0, ti=0, ct="main": {"type": "addConnection", "source": s, "target": t, "sourceIndex": si, "targetIndex": ti, "connectionType": ct}
ops += [
 {"type": "removeConnection", "source": "Normalizar mensaje", "target": "Info negocio"} if False else None,
]
ops = [o for o in ops if o]
ops += [
 C("Normalizar mensaje", "Registrar entrada"),
 C("Registrar entrada", "¿Mensaje nuevo?"),
 C("Registrar entrada", "Avisar error al cliente", 1),
 C("¿Mensaje nuevo?", "Lock conversación"),
 C("Lock conversación", "¿Conversación libre?"),
 C("¿Conversación libre?", "Contexto negocio"),
 C("¿Conversación libre?", "Encolar pendiente", 1),
 C("Contexto negocio", "Leer pre-reserva"),
 C("Contexto negocio", "Avisar error al cliente", 1),
 C("Leer pre-reserva", "Preparar turno"),
 C("Preparar turno", "Agente de citas"),
 C("Responder por WhatsApp", "Registrar salida"),
 C("Registrar salida", "Leer pendientes"),
 C("Leer pendientes", "Borrar pendientes"),
 C("Borrar pendientes", "¿Hay pendientes?"),
 C("¿Hay pendientes?", "Leer pre-reserva"),
 C("¿Hay pendientes?", "Liberar lock conversación", 1),
 C("Avisar error al cliente", "Liberar lock conversación"),
 C("Gemini respaldo", "Agente de citas", 0, 1, "ai_languageModel"),
]
for t in tools:
    ops.append(C(t["name"], "Agente de citas", 0, 0, "ai_tool"))
ops.append({"type": "setWorkflowMetadata", "name": "Barbería · Bot WhatsApp v2 (Supabase + Calendar)"})
json.dump(ops, open('wf1ops.json', 'w'), ensure_ascii=False)
print(len(ops), len(json.dumps(ops, ensure_ascii=False)))
