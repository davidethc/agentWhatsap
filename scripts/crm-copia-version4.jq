# Conecta version4 a «Eli → CRM» (TK-19/TK-20). No toca ningún nodo existente: agrega 4 pares
# (Code que arma el evento + Execute Workflow SIN esperar) y los cuelga en paralelo, siempre primeros:
#   ¿Mensaje nuevo?        → CRM: armar mensaje_entrante
#   Responder por WhatsApp → CRM: armar cambios de agenda, CRM: armar mensaje_saliente
#   Crear evento           → CRM: armar cita_reservada
#
# IDEMPOTENTE: se puede aplicar sobre el version4 de main o sobre el version4 VIVO aunque ya tenga las
# ramas CRM; los nodos «CRM: …» se reemplazan por nombre (mismos ids) y las conexiones no se duplican.
#
# Copia de prueba (inactiva, otro id/nombre/webhook), SIEMPRE sobre el version4 más nuevo de main:
#   jq -f scripts/crm-copia-version4.jq /Users/d/agentWhatsap/workflows/eli-version4.json \
#      > workflows/pruebas/eli-version4-crm-copia.json
# Para el version4 REAL (TK-20): sobre un export del vivo, sin renombrar nada (ver docs/crm/integracion-version4.md):
#   n8n export:workflow --id=u4hWSJLdLFVSTtjQ --output=/tmp/v4-vivo.json ; jq '.[0]' /tmp/v4-vivo.json > /tmp/v4-vivo-obj.json
#   CRM_REAL=1 jq -f scripts/crm-copia-version4.jq /tmp/v4-vivo-obj.json > /tmp/v4-con-crm.json
# Última generación: version4 de main 4dbbf07 (11-oct-2026: seguimientos, notas de voz e imágenes con
# Gemini —«Leer webhook» + cadena de medios + «Normalizar mensaje» al final—, fechas de Ecuador y
# modelo de respaldo OpenRouter) + cambios de agenda (mover_cita / cancelar_cita).
def pos(n): (.nodes[] | select(.name == n) | .position);

def codigo(id; nombre; js; p): {
  parameters: { jsCode: js }, id: id, name: nombre,
  type: "n8n-nodes-base.code", typeVersion: 2, position: p, onError: "continueRegularOutput"
};
def llamar(id; nombre; p): {
  parameters: {
    workflowId: { "__rl": true, value: "EliCrmSubwf00001", mode: "id" },
    workflowInputs: { mappingMode: "passthrough" },
    options: { waitForSubWorkflow: false }
  },
  id: id, name: nombre, type: "n8n-nodes-base.executeWorkflow", typeVersion: 1.2,
  position: p, onError: "continueRegularOutput"
};
# Como llamar, pero una llamada al sub-workflow POR CADA evento (puede haber varios cambios de agenda).
def llamar_cada(id; nombre; p): llamar(id; nombre; p) | .parameters.mode = "each";

# Deja estos nodos como PRIMEROS de la conexión (en ese orden) sin duplicarlos si ya estaban.
def primeros($desde; $lista):
  .connections[$desde].main[0] |= (
    [ $lista[] | { node: ., type: "main", index: 0 } ]
    + map(select(.node as $n | ($lista | index($n)) | not)));

(pos("¿Mensaje nuevo?")) as $p1
| (pos("Responder por WhatsApp")) as $p2
| (pos("Crear evento")) as $p3
# Con CRM_REAL=1 (solo TK-20, sobre un export del version4 VIVO) no se renombra nada: mismo id, mismo
# nombre y mismo webhook. Sin esa variable sale la copia de prueba (otro id, otro nombre, otro webhook).
| if ($ENV.CRM_REAL // "") == "1" then .
  else (.id = "Zv4CopiaCrmTk19001"
    | .name = "version4 · COPIA CRM (prueba, inactiva)"
    | (.nodes[] | select(.name == "Webhook Kapso") | .parameters.path) = "copia-crm-tk19-no-usar"
    | (.nodes[] | select(.name == "Webhook Kapso") | .webhookId) = "c0b1a000-0000-4000-8000-000000000019")
  end
| ([
    codigo("c19a0001-0000-4000-8000-000000000001"; "CRM: armar mensaje_entrante";
      "// Evento para Eli → CRM. Por ahora NO lleva el texto del mensaje (privacidad). Si algo falta, no manda nada.\n// Se lee de «Leer webhook» (está justo antes de ¿Mensaje nuevo?): no espera la cadena de medios con Gemini.\nconst n = $('Leer webhook').first().json;\nif (!n.to || !n.message_id) return [];\nreturn [{ json: { tipo: 'mensaje_entrante', telefono: n.to, nombre_whatsapp: n.nombre || undefined, message_id: n.message_id, en: new Date().toISOString() } }];";
      [$p1[0] + 240, $p1[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000002"; "CRM: enviar mensaje_entrante (sin esperar)"; [$p1[0] + 480, $p1[1] - 220]),
    codigo("c19a0001-0000-4000-8000-000000000003"; "CRM: armar mensaje_saliente";
      "// Respuesta que Eli acaba de mandar. Por ahora NO lleva el texto (privacidad). execution_id lleva el número de vuelta para que cada respuesta del bucle sea única.\nconst n = $('Normalizar mensaje').first().json;\nif (!n.to) return [];\nreturn [{ json: { tipo: 'mensaje_saliente', telefono: n.to, execution_id: $execution.id + '-' + $runIndex, en: new Date().toISOString() } }];";
      [$p2[0] + 240, $p2[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000004"; "CRM: enviar mensaje_saliente (sin esperar)"; [$p2[0] + 480, $p2[1] - 220]),
    codigo("c19a0001-0000-4000-8000-000000000005"; "CRM: armar cita_reservada";
      "// Cita creada en Google Calendar (Crear evento devuelve el id del evento).\nconst r = $('Validar pedido').first().json;\nconst c = $('Calcular turnos (mañana / tarde)').first().json;\nconst ev = $input.first().json;\nif (!ev.id || !r.telefono) return [];\nreturn [{ json: { tipo: 'cita_reservada', telefono: r.telefono, gcal_event_id: ev.id, inicio: c.inicio, fin: c.fin, servicio: c.servicio, nombre: c.nombre } }];";
      [$p3[0] + 240, $p3[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000006"; "CRM: enviar cita_reservada (sin esperar)"; [$p3[0] + 480, $p3[1] - 220]),
    codigo("c19a0001-0000-4000-8000-000000000007"; "CRM: armar cambios de agenda";
      "// Eli → CRM: cambios de agenda que Eli hizo con mover_cita / cancelar_cita (van directo a Google Calendar).\n// Lee los pasos del agente (intermediateSteps: action.tool, action.toolInput, observation) y cuenta SOLO las\n// llamadas que no fallaron. Un ítem por evento; ninguno si no hubo cambios. No lleva texto del mensaje.\nconst n = $('Normalizar mensaje').first().json;\nif (!n.to) return [];\nlet salida;\ntry { salida = $('Agente version4').itemMatching(0).json; } catch (e) { salida = $('Agente version4').last().json; }\nconst pasos = Array.isArray(salida?.intermediateSteps) ? salida.intermediateSteps : [];\nconst leer = (v) => { if (typeof v !== 'string') return v ?? null; try { return JSON.parse(v); } catch (e) { return null; } };\nconst fallo = (obs) => { const o = leer(obs); const l = Array.isArray(o) ? o : (o == null || o === '' ? [] : [o]); return l.length === 0 || l.some((x) => !x || typeof x !== 'object' || x.error); };\nconst eventos = new Map();\nfor (const p of pasos) {\n  const tool = p?.action?.tool;\n  if (tool !== 'mover_cita' && tool !== 'cancelar_cita') continue;\n  if (fallo(p.observation)) continue;\n  let a = leer(p.action.toolInput) ?? {};\n  if (typeof a.input === 'string') a = leer(a.input) ?? a; else if (a.input && typeof a.input === 'object') a = a.input;\n  const id = String(a.event_id ?? '').trim();\n  if (!id) continue;\n  if (tool === 'cancelar_cita') { eventos.set(id, { tipo: 'cita_cancelada', telefono: n.to, gcal_event_id: id }); continue; }\n  const obs = leer(p.observation);\n  const ev = Array.isArray(obs) ? obs[0] : obs;\n  let inicio = ev?.start?.dateTime;\n  let fin = ev?.end?.dateTime;\n  if (!inicio && a.nueva_fecha && a.nueva_hora) {\n    const d = DateTime.fromISO(a.nueva_fecha + 'T' + a.nueva_hora, { zone: 'America/Guayaquil' });\n    if (d.isValid) { inicio = d.toISO(); fin = d.plus({ hours: 1 }).toISO(); }\n  }\n  if (!inicio) continue;\n  if (!fin) fin = DateTime.fromISO(inicio).plus({ hours: 1 }).toISO();\n  eventos.set(id, { tipo: 'cita_movida', telefono: n.to, gcal_event_id: id, inicio, fin });\n}\nreturn [...eventos.values()].map((json) => ({ json }));";
      [$p2[0] + 240, $p2[1] - 440]),
    llamar_cada("c19a0001-0000-4000-8000-000000000008"; "CRM: enviar cambios de agenda (sin esperar)"; [$p2[0] + 480, $p2[1] - 440])
  ]
  | map(
      if (.name | startswith("CRM: armar")) then
        . + { notes: "Eli Panel (CRM): arma el evento sin texto del mensaje. Rama en paralelo; si falla, Eli sigue igual.", notesInFlow: true }
      else
        . + { notes: "Llama al sub-workflow «Eli → CRM» SIN esperar la respuesta. Si el CRM está caído, el evento queda en la lista Redis v4:crm:errores.", notesInFlow: true }
      end)
  ) as $N
| ($N | map(.name)) as $nombres
# Idempotente: si ya existen (p. ej. en el version4 vivo) se reemplazan por nombre.
| .nodes |= (map(select(.name as $n | ($nombres | index($n)) | not)) + $N)
# Las ramas del CRM van PRIMERO y «Cita reservada» queda de última, para que la respuesta de la herramienta al agente siga siendo la de siempre.
| primeros("¿Mensaje nuevo?"; ["CRM: armar mensaje_entrante"])
| primeros("Responder por WhatsApp"; ["CRM: armar cambios de agenda", "CRM: armar mensaje_saliente"])
| primeros("Crear evento"; ["CRM: armar cita_reservada"])
| .connections["CRM: armar mensaje_entrante"] = { main: [[{ node: "CRM: enviar mensaje_entrante (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar mensaje_saliente"] = { main: [[{ node: "CRM: enviar mensaje_saliente (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar cita_reservada"] = { main: [[{ node: "CRM: enviar cita_reservada (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar cambios de agenda"] = { main: [[{ node: "CRM: enviar cambios de agenda (sin esperar)", type: "main", index: 0 }]] }
