#!/usr/bin/env bash
# Exporta un workflow de n8n al repositorio, sin datos privados.
#
# Uso: scripts/export-workflow.sh <workflow-id> <archivo-destino.json>
# Ej.: scripts/export-workflow.sh u4hWSJLdLFVSTtjQ workflows/sofi-version4.json
#
# Limpia: IDs de credenciales (quedan solo los nombres), metadatos de la instancia,
# el calendario de Google (correo -> TU_CALENDARIO@gmail.com) y el phone_number_id
# de WhatsApp en el código (-> TU_PHONE_NUMBER_ID).
set -euo pipefail
cd "$(dirname "$0")/.."

id="${1:?Falta el ID del workflow}"
dest="${2:?Falta el archivo de destino}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

docker compose exec -T n8n n8n export:workflow --id="$id" --output="/tmp/export-$id.json" >/dev/null
docker compose cp "n8n:/tmp/export-$id.json" "$tmp" >/dev/null 2>&1
docker compose exec -T -u root n8n rm -f "/tmp/export-$id.json"

jq '(if type == "array" then .[0] else . end)
  | {name, nodes, connections, settings, description}
  | .nodes |= map(
      (if .credentials then .credentials |= with_entries(.value |= {name: .name}) else . end)
      | (if (.parameters.calendar? // null) then
           .parameters.calendar = {"__rl": true, "mode": "list",
             "value": "TU_CALENDARIO@gmail.com", "cachedResultName": "TU_CALENDARIO@gmail.com"}
         else . end))' "$tmp" \
  | sed -E "s/(PERMITIDO = ')[0-9]+(')/\1TU_PHONE_NUMBER_ID\2/" > "$dest"

# Última revisión: no debe quedar ningún correo ni número largo.
leaks="$(grep -oE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|['\" =:][0-9]{12,}['\" ,]" "$dest" | grep -v '^TU_CALENDARIO@gmail.com$' || true)"
if [ -n "$leaks" ]; then
  echo "AVISO: revisa estos posibles datos privados en $dest antes de hacer commit:" >&2
  echo "$leaks" | sort -u >&2
  exit 2
fi
echo "Exportado: $dest ($(jq '.nodes | length' "$dest") nodos)"
