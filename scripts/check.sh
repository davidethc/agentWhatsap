#!/usr/bin/env bash
# Revisa la salud de todo el sistema sin mostrar secretos.
# Uso: scripts/check.sh
set -uo pipefail
cd "$(dirname "$0")/.."

set -a; . ./.env; set +a
fail=0
ok()  { printf '  OK    %s\n' "$1"; }
bad() { printf '  FALLA %s\n' "$1"; fail=1; }

echo "Servicios:"
for s in postgres redis n8n n8n-worker n8n-runner n8n-worker-runner; do
  state="$(docker compose ps --format '{{.State}} {{.Health}}' "$s" 2>/dev/null)"
  case "$state" in
    "running healthy"|"running ") ok "$s ($state)" ;;
    *) bad "$s (${state:-no existe})" ;;
  esac
done

echo "Dependencias:"
docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 \
  && ok "PostgreSQL acepta conexiones" || bad "PostgreSQL no responde"
[ "$(docker compose exec -T -e REDISCLI_AUTH="$REDIS_PASSWORD" redis redis-cli ping 2>/dev/null | tr -d '\r')" = "PONG" ] \
  && ok "Redis responde PONG" || bad "Redis no responde"

echo "n8n:"
curl -fsS http://127.0.0.1:5678/healthz >/dev/null 2>&1 \
  && ok "http://127.0.0.1:5678/healthz" || bad "n8n no responde en 127.0.0.1:5678"
main="$(docker compose exec -T n8n n8n --version 2>/dev/null | tr -d '\r')"
worker="$(docker compose exec -T n8n-worker n8n --version 2>/dev/null | tr -d '\r')"
[ -n "$main" ] && [ "$main" = "$worker" ] && [ "$main" = "$N8N_VERSION" ] \
  && ok "versión $main en main y worker" || bad "versiones distintas: main=$main worker=$worker .env=$N8N_VERSION"
for s in n8n n8n-worker; do
  docker compose exec -T "$s" test -f /home/node/.n8n/nodes/node_modules/@kapso/n8n-nodes-kapso/package.json 2>/dev/null \
    && ok "Kapso instalado en $s" || bad "Kapso no está instalado en $s"
done

echo "Túnel:"
url="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[]?.public_url | select(startswith("https"))' | head -1)"
if [ -z "$url" ]; then
  bad "ngrok no está activo (ejecuta: ngrok http 5678)"
elif [ "$url/" != "$WEBHOOK_URL" ]; then
  bad "ngrok usa $url pero WEBHOOK_URL es $WEBHOOK_URL"
else
  curl -fsS -H 'ngrok-skip-browser-warning: 1' "$url/healthz" >/dev/null 2>&1 \
    && ok "$url llega a n8n" || bad "$url no llega a n8n"
fi

exit "$fail"
