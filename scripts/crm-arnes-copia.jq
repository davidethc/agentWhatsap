# Arnés de prueba de la COPIA de version4 (TK-19/TK-20). Nunca llama a Kapso ni a Gemini.
# Arma un workflow de prueba (inactivo) con:
#   · nodos simulados con los mismos nombres que usan los armadores (Normalizar mensaje, Validar pedido…),
#   · los 3 armadores «CRM: armar …» TAL CUAL salen de la copia,
#   · el envío al CRM: modo "ok"    → un POST por evento al eli-evento (nodo clonado de eli-crm.json);
#                      modo "caido" → los nodos reales de eli-crm.json (reintentos + Redis) para un solo $tipo.
#   · «Cita reservada» en paralelo, igual que en version4: si corre, Eli siguió respondiendo.
# Uso:
#   jq --slurpfile sub workflows/eli-crm.json --arg modo ok|caido --arg tipo mensaje_entrante \
#      --arg url <URL eli-evento> -f scripts/crm-arnes-copia.jq workflows/pruebas/eli-version4-crm-copia.json
def poner($id; $nombre; $json; $x): {
  parameters: { mode: "raw", jsonOutput: $json, options: {} }, id: $id, name: $nombre,
  type: "n8n-nodes-base.set", typeVersion: 3.4, position: [$x, 0]
};

($sub[0]) as $s
| ([.nodes[] | select(.name | startswith("CRM: armar")) | select($modo == "ok" or (.name | endswith($tipo)))]) as $armadores
| ($s.nodes[] | select(.name == "Enviar a eli-evento")) as $http
| {
    id: "ZZArnesCopia0000001",
    name: "ZZ arnés copia version4 (borrable)",
    nodes: (
      [
        { parameters: {}, id: "h1000001-0000-4000-8000-000000000001", name: "Manual",
          type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [0, 0] },
        poner("h1000001-0000-4000-8000-000000000002"; "Normalizar mensaje";
          "{\"to\":\"593900000093\",\"nombre\":\"Paciente Prueba\",\"text\":\"TEXTO-QUE-NO-DEBE-VIAJAR\",\"message_id\":\"wamid.arnes-\(now | floor)\"}"; 220),
        poner("h1000001-0000-4000-8000-000000000003"; "Validar pedido"; "{\"telefono\":\"593900000093\"}"; 440),
        poner("h1000001-0000-4000-8000-000000000004"; "Calcular turnos (mañana / tarde)";
          "{\"inicio\":\"2026-10-27T10:00:00.000-05:00\",\"fin\":\"2026-10-27T11:00:00.000-05:00\",\"servicio\":\"Limpieza\",\"nombre\":\"Paciente Prueba\"}"; 660),
        poner("h1000001-0000-4000-8000-000000000005"; "Crear evento"; "{\"id\":\"gcal-arnes-\(now | floor)\"}"; 880),
        poner("h1000001-0000-4000-8000-000000000006"; "Cita reservada"; "{\"ok\":true,\"eli_sigue\":true}"; 1100)
      ]
      + $armadores
      + (if $modo == "ok"
         then [$armadores[] | . as $a | ($http | .parameters.url = $url | .id = ("h2" + $a.id[2:]) | .name = ("POST " + ($a.name | ltrimstr("CRM: armar ")))
              | .position = [$a.position[0] + 300, $a.position[1]])]
         else [{ parameters: {}, id: "h1000001-0000-4000-8000-000000000007", name: "Entrada interna",
                 type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1500, 0] }]
              + [$s.nodes[] | select(.name != "Entrada interna")
                 | if .name == "Enviar a eli-evento" then .parameters.url = $url else . end]
         end)
    ),
    connections: (
      {
        "Manual": { main: [[{ node: "Normalizar mensaje", type: "main", index: 0 }]] },
        "Normalizar mensaje": { main: [[{ node: "Validar pedido", type: "main", index: 0 }]] },
        "Validar pedido": { main: [[{ node: "Calcular turnos (mañana / tarde)", type: "main", index: 0 }]] },
        "Calcular turnos (mañana / tarde)": { main: [[{ node: "Crear evento", type: "main", index: 0 }]] },
        "Crear evento": { main: [([$armadores[] | { node: .name, type: "main", index: 0 }] + [{ node: "Cita reservada", type: "main", index: 0 }])] }
      }
      + (if $modo == "ok"
         then ([$armadores[] | { key: .name, value: { main: [[{ node: ("POST " + (.name | ltrimstr("CRM: armar "))), type: "main", index: 0 }]] } }] | from_entries)
         else ([$armadores[] | { key: .name, value: { main: [[{ node: "Entrada interna", type: "main", index: 0 }]] } }] | from_entries)
              + { "Entrada interna": { main: [[{ node: "Enviar a eli-evento", type: "main", index: 0 }]] } }
              + ($s.connections | del(."Entrada interna"))
         end)
    ),
    settings: { executionOrder: "v1" }
  }
