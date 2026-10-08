#!/usr/bin/env bash
# Crea .env desde .env.example con secretos aleatorios nuevos.
# Nunca sobrescribe un .env existente: en una instalación con datos, la clave de
# cifrado debe ser siempre la misma o las credenciales de n8n dejan de abrirse.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -e .env ]; then
  echo "Ya existe .env; no se modifica." >&2
  exit 1
fi

secret() { openssl rand -hex "$1"; }

sed -e "s|^N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=$(secret 32)|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret 24)|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(secret 24)|" \
    -e "s|^N8N_RUNNERS_AUTH_TOKEN=.*|N8N_RUNNERS_AUTH_TOKEN=$(secret 24)|" \
    .env.example > .env
chmod 600 .env

echo ".env creado con secretos nuevos (permisos 600)."
echo "Guarda una copia de N8N_ENCRYPTION_KEY en un gestor de contraseñas: sin ella no se recuperan las credenciales."
