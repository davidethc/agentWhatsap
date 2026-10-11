#!/usr/bin/env bash
# Llama a la Edge Function «calendario» del Supabase LOCAL con la clave de servicio de desarrollo
# (la de `supabase status`, que no vale en la nube). No lee .env.
# Uso: scripts/calendario-local.sh [push|pull|sync]      (por defecto: sync)
# Requiere: supabase start y `supabase functions serve` corriendo (ver docs/crm/google-calendar.md).
set -euo pipefail
cd "$(dirname "$0")/.."

accion="${1:-sync}"
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

curl -sS -X POST "$API_URL/functions/v1/calendario" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"accion\":\"$accion\"}"
echo
