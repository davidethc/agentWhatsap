#!/usr/bin/env bash
# Respaldo completo en backups/<fecha>/ (carpeta ignorada por Git).
# Incluye: base PostgreSQL, workflows, credenciales cifradas, volumen de n8n,
# docker-compose.yml y .env. Nunca borra nada.
# Uso: scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está corriendo: abre Docker Desktop (open -a Docker) y vuelve a intentar." >&2
  exit 1
fi

set -a; . ./.env; set +a
dest="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dest"
chmod 700 backups "$dest"

echo "Respaldando en $dest ..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$dest/postgres.dump"

docker compose exec -T n8n sh -c '
  n8n export:workflow --all --output=/tmp/workflows.json >/dev/null &&
  n8n export:credentials --all --output=/tmp/credentials.json >/dev/null'
docker compose cp n8n:/tmp/workflows.json "$dest/workflows.json" >/dev/null 2>&1
docker compose cp n8n:/tmp/credentials.json "$dest/credentials.json" >/dev/null 2>&1
docker compose exec -T -u root n8n rm -f /tmp/workflows.json /tmp/credentials.json

docker run --rm -v agentwhatsap_n8n_data:/data:ro -v "$PWD/$dest":/out alpine \
  sh -c "cd /data && tar czf /out/n8n_data.tar.gz . && chown $(id -u) /out/n8n_data.tar.gz"

cp docker-compose.yml "$dest/"
cp .env "$dest/env"
chmod 600 "$dest"/*

echo "Listo:"
ls -lh "$dest"
echo "Las credenciales van cifradas con N8N_ENCRYPTION_KEY (copia incluida en $dest/env)."
