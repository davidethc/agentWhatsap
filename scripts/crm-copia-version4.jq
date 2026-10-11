# Arma la COPIA de version4 conectada a «Eli → CRM» (TK-19). No toca ningún nodo existente:
# solo agrega 3 pares (Code + Execute Workflow sin esperar) y los cuelga en paralelo.
# Uso: jq -f scripts/crm-copia-version4.jq workflows/eli-version4.json > workflows/pruebas/eli-version4-crm-copia.json
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

(pos("¿Mensaje nuevo?")) as $p1
| (pos("Responder por WhatsApp")) as $p2
| (pos("Crear evento")) as $p3
| .id = "Zv4CopiaCrmTk19001"
| .name = "version4 · COPIA CRM (prueba, inactiva)"
| (.nodes[] | select(.name == "Webhook Kapso") | .parameters.path) = "copia-crm-tk19-no-usar"
| (.nodes[] | select(.name == "Webhook Kapso") | .webhookId) = "c0b1a000-0000-4000-8000-000000000019"
| .nodes += [
    codigo("c19a0001-0000-4000-8000-000000000001"; "CRM: armar mensaje_entrante";
      "// Evento para Eli → CRM. Si algo falta, no manda nada.\nconst n = $('Normalizar mensaje').first().json;\nif (!n.to || !n.message_id) return [];\nreturn [{ json: { tipo: 'mensaje_entrante', telefono: n.to, nombre_whatsapp: n.nombre || undefined, message_id: n.message_id, texto: n.text, en: new Date().toISOString() } }];";
      [$p1[0] + 240, $p1[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000002"; "CRM: enviar mensaje_entrante (sin esperar)"; [$p1[0] + 480, $p1[1] - 220]),
    codigo("c19a0001-0000-4000-8000-000000000003"; "CRM: armar mensaje_saliente";
      "// Respuesta que Eli acaba de mandar. execution_id lleva el número de vuelta para que cada respuesta del bucle sea única.\nconst n = $('Normalizar mensaje').first().json;\nconst salida = $('Agente version4').last().json.output;\nif (!n.to || !salida) return [];\nreturn [{ json: { tipo: 'mensaje_saliente', telefono: n.to, texto: String(salida).slice(0, 3000), execution_id: $execution.id + '-' + $runIndex, en: new Date().toISOString() } }];";
      [$p2[0] + 240, $p2[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000004"; "CRM: enviar mensaje_saliente (sin esperar)"; [$p2[0] + 480, $p2[1] - 220]),
    codigo("c19a0001-0000-4000-8000-000000000005"; "CRM: armar cita_reservada";
      "// Cita creada en Google Calendar (Crear evento devuelve el id del evento).\nconst r = $('Validar pedido').first().json;\nconst c = $('Calcular turnos (mañana / tarde)').first().json;\nconst ev = $input.first().json;\nif (!ev.id || !r.telefono) return [];\nreturn [{ json: { tipo: 'cita_reservada', telefono: r.telefono, gcal_event_id: ev.id, inicio: c.inicio, fin: c.fin, servicio: c.servicio, nombre: c.nombre } }];";
      [$p3[0] + 240, $p3[1] - 220]),
    llamar("c19a0001-0000-4000-8000-000000000006"; "CRM: enviar cita_reservada (sin esperar)"; [$p3[0] + 480, $p3[1] - 220])
  ]
# La rama del CRM va PRIMERO y «Cita reservada» queda de última, para que la respuesta de la herramienta al agente siga siendo la de siempre.
| .connections["¿Mensaje nuevo?"].main[0] = [{ node: "CRM: armar mensaje_entrante", type: "main", index: 0 }] + .connections["¿Mensaje nuevo?"].main[0]
| .connections["Responder por WhatsApp"].main[0] = [{ node: "CRM: armar mensaje_saliente", type: "main", index: 0 }] + .connections["Responder por WhatsApp"].main[0]
| .connections["Crear evento"].main[0] = [{ node: "CRM: armar cita_reservada", type: "main", index: 0 }] + .connections["Crear evento"].main[0]
| .connections["CRM: armar mensaje_entrante"] = { main: [[{ node: "CRM: enviar mensaje_entrante (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar mensaje_saliente"] = { main: [[{ node: "CRM: enviar mensaje_saliente (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar cita_reservada"] = { main: [[{ node: "CRM: enviar cita_reservada (sin esperar)", type: "main", index: 0 }]] }
