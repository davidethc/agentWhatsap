# Arnés de prueba de la COPIA de version4 (TK-19/TK-20). Nunca llama a Kapso ni a Gemini.
# Arma un workflow de prueba (inactivo) con:
#   · nodos simulados con los mismos nombres que usan los armadores (Leer webhook, Normalizar mensaje,
#     Agente version4 —con los intermediateSteps que se le pasen—, Responder por WhatsApp, Validar pedido…),
#   · los 4 armadores «CRM: armar …» TAL CUAL salen de la copia, colgados de los mismos nodos que en version4,
#   · el envío al CRM: modo "ok"    → un POST por evento al eli-evento (nodo clonado de eli-crm.json);
#                      modo "caido" → los nodos reales de eli-crm.json (reintentos + Redis) para UN solo $tipo.
#   · «Cita reservada» en paralelo, igual que en version4: si corre, Eli siguió respondiendo.
# $tipo (solo modo caido): mensaje_entrante | mensaje_saliente | cita_reservada | cambios de agenda
# $pf: archivo JSON con el arreglo de intermediateSteps simulados del agente (ver scripts/pruebas/pasos-agenda.json).
# Uso:
#   jq --slurpfile sub workflows/eli-crm.json --slurpfile pf scripts/pruebas/pasos-agenda.json \
#      --arg modo ok|caido --arg tipo "cambios de agenda" --arg url <URL eli-evento> \
#      -f scripts/crm-arnes-copia.jq workflows/pruebas/eli-version4-crm-copia.json
def poner($id; $nombre; $json; $x): {
  parameters: { mode: "raw", jsonOutput: $json, options: {} }, id: $id, name: $nombre,
  type: "n8n-nodes-base.set", typeVersion: 3.4, position: [$x, 0]
};
# De qué nodo de version4 cuelga cada armador.
def origen($n):
  if ($n | endswith("mensaje_entrante")) then "Leer webhook"
  elif ($n | endswith("cita_reservada")) then "Crear evento"
  else "Responder por WhatsApp" end;
def destinos($lista): { main: [[ $lista[] | { node: ., type: "main", index: 0 } ]] };

($sub[0]) as $s
| ($pf[0] // []) as $pasos
| ([.nodes[] | select(.name | startswith("CRM: armar")) | select($modo == "ok" or (.name | endswith($tipo)))]) as $armadores
| ($s.nodes[] | select(.name == "Enviar a eli-evento")) as $http
| (now | floor) as $ahora
| ("{\"to\":\"593900000093\",\"nombre\":\"Paciente Prueba\",\"text\":\"TEXTO-QUE-NO-DEBE-VIAJAR\",\"message_id\":\"wamid.arnes-\($ahora)\"}") as $mensaje
| ([$armadores[] | select(origen(.name) == "Leer webhook") | .name]) as $d_leer
| ([$armadores[] | select(origen(.name) == "Crear evento") | .name]) as $d_crear
| ([$armadores[] | select(origen(.name) == "Responder por WhatsApp") | .name]) as $d_resp
| {
    id: "ZZArnesCopia0000001",
    name: "ZZ arnés copia version4 (borrable)",
    nodes: (
      [
        { parameters: {}, id: "h1000001-0000-4000-8000-000000000001", name: "Manual",
          type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [0, 0] },
        poner("h1000001-0000-4000-8000-000000000008"; "Leer webhook"; $mensaje; 110),
        poner("h1000001-0000-4000-8000-000000000002"; "Normalizar mensaje"; $mensaje; 220),
        poner("h1000001-0000-4000-8000-000000000003"; "Validar pedido"; "{\"telefono\":\"593900000093\"}"; 440),
        poner("h1000001-0000-4000-8000-000000000004"; "Calcular turnos (mañana / tarde)";
          "{\"inicio\":\"2026-10-27T10:00:00.000-05:00\",\"fin\":\"2026-10-27T11:00:00.000-05:00\",\"servicio\":\"Limpieza\",\"nombre\":\"Paciente Prueba\"}"; 660),
        poner("h1000001-0000-4000-8000-000000000005"; "Crear evento"; "{\"id\":\"gcal-arnes-\($ahora)\"}"; 880),
        poner("h1000001-0000-4000-8000-000000000006"; "Cita reservada"; "{\"ok\":true,\"eli_sigue\":true}"; 1100),
        poner("h1000001-0000-4000-8000-000000000009"; "Agente version4";
          ({ output: "respuesta simulada", intermediateSteps: $pasos } | tojson); 440),
        poner("h1000001-0000-4000-8000-00000000000a"; "Responder por WhatsApp"; "{\"ok\":true}"; 660)
      ]
      + $armadores
      + (if $modo == "ok"
         then [$armadores[] | . as $a | ($http | .parameters.url = $url | .id = ("h2" + $a.id[2:]) | .name = ("POST " + ($a.name | ltrimstr("CRM: armar ")))
              | .position = [$a.position[0] + 300, $a.position[1]] | .onError = "continueRegularOutput")]
         else [{ parameters: {}, id: "h1000001-0000-4000-8000-000000000007", name: "Entrada interna",
                 type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1500, 0] }]
              + [$s.nodes[] | select(.name != "Entrada interna")
                 | if .name == "Enviar a eli-evento" then .parameters.url = $url else . end]
         end)
    ),
    connections: (
      {
        "Manual": destinos(["Leer webhook"]),
        "Leer webhook": destinos(["Normalizar mensaje"] + $d_leer),
        "Normalizar mensaje": destinos(["Validar pedido", "Agente version4"]),
        "Validar pedido": destinos(["Calcular turnos (mañana / tarde)"]),
        "Calcular turnos (mañana / tarde)": destinos(["Crear evento"]),
        "Crear evento": destinos($d_crear + ["Cita reservada"]),
        "Agente version4": destinos(["Responder por WhatsApp"]),
        "Responder por WhatsApp": destinos($d_resp)
      }
      + (if $modo == "ok"
         then ([$armadores[] | { key: .name, value: destinos(["POST " + (.name | ltrimstr("CRM: armar "))]) }] | from_entries)
         else ([$armadores[] | { key: .name, value: destinos(["Entrada interna"]) }] | from_entries)
              + { "Entrada interna": destinos(["Enviar a eli-evento"]) }
              + ($s.connections | del(."Entrada interna"))
         end)
    ),
    settings: { executionOrder: "v1" }
  }
