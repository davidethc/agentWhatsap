# Arma la COPIA de version4 conectada a «Eli → CRM» (TK-19). No toca ningún nodo existente:
# solo agrega 3 pares (Code + Execute Workflow sin esperar) y los cuelga en paralelo.
# Uso (TK-20): SIEMPRE sobre el version4 más nuevo de main, para no perder cambios como los
# seguimientos automáticos («Seg: …»):
#   jq -f scripts/crm-copia-version4.jq /Users/d/agentWhatsap/workflows/eli-version4.json \
#      > workflows/pruebas/eli-version4-crm-copia.json
# Última generación: version4 de main 4dbbf07 (11-oct-2026: seguimientos, notas de voz e imágenes con
# Gemini —«Leer webhook» + cadena de medios + «Normalizar mensaje» al final—, fechas de Ecuador y
# modelo de respaldo OpenRouter).
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
# Con CRM_REAL=1 (solo TK-20, sobre un export del version4 VIVO) no se renombra nada: mismo id, mismo
# nombre y mismo webhook. Sin esa variable sale la copia de prueba (otro id, otro nombre, otro webhook).
| if ($ENV.CRM_REAL // "") == "1" then .
  else (.id = "Zv4CopiaCrmTk19001"
    | .name = "version4 · COPIA CRM (prueba, inactiva)"
    | (.nodes[] | select(.name == "Webhook Kapso") | .parameters.path) = "copia-crm-tk19-no-usar"
    | (.nodes[] | select(.name == "Webhook Kapso") | .webhookId) = "c0b1a000-0000-4000-8000-000000000019")
  end
| .nodes += [
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
    llamar("c19a0001-0000-4000-8000-000000000006"; "CRM: enviar cita_reservada (sin esperar)"; [$p3[0] + 480, $p3[1] - 220])
  ]
| (.nodes[] | select(.name | startswith("CRM: armar"))) += {
    notes: "Eli Panel (CRM): arma el evento sin texto del mensaje. Rama en paralelo; si falla, Eli sigue igual.",
    notesInFlow: true
  }
| (.nodes[] | select(.name | startswith("CRM: enviar"))) += {
    notes: "Llama al sub-workflow «Eli → CRM» SIN esperar la respuesta. Si el CRM está caído, el evento queda en la lista Redis v4:crm:errores.",
    notesInFlow: true
  }
# La rama del CRM va PRIMERO y «Cita reservada» queda de última, para que la respuesta de la herramienta al agente siga siendo la de siempre.
| .connections["¿Mensaje nuevo?"].main[0] = [{ node: "CRM: armar mensaje_entrante", type: "main", index: 0 }] + .connections["¿Mensaje nuevo?"].main[0]
| .connections["Responder por WhatsApp"].main[0] = [{ node: "CRM: armar mensaje_saliente", type: "main", index: 0 }] + .connections["Responder por WhatsApp"].main[0]
| .connections["Crear evento"].main[0] = [{ node: "CRM: armar cita_reservada", type: "main", index: 0 }] + .connections["Crear evento"].main[0]
| .connections["CRM: armar mensaje_entrante"] = { main: [[{ node: "CRM: enviar mensaje_entrante (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar mensaje_saliente"] = { main: [[{ node: "CRM: enviar mensaje_saliente (sin esperar)", type: "main", index: 0 }]] }
| .connections["CRM: armar cita_reservada"] = { main: [[{ node: "CRM: enviar cita_reservada (sin esperar)", type: "main", index: 0 }]] }
