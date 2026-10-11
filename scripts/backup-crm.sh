#!/usr/bin/env bash
# Copia de la base del Eli Panel (Supabase eli-crm). TK-13.
#
# El plan gratis de Supabase no tiene copias descargables: esto las hace con
# `supabase db dump` (pg_dump dentro de Docker, no hace falta instalar Postgres).
# Las copias tienen DATOS DE SALUD: se guardan FUERA del repositorio, con permisos
# 700/600, y nunca van a git. Nunca borra copias anteriores.
#
# Uso:
#   CRM_DB_URL='postgresql://...' scripts/backup-crm.sh
#   (o CRM_DB_URL en .env; ver docs/crm/backup-crm.md)
#   scripts/backup-crm.sh --db-url 'postgresql://...' [--dir carpeta]
#   (--db-url solo para la base LOCAL: en la línea de comandos la contraseña se ve en `ps`)
#
# Variables:
#   CRM_DB_URL      (obligatoria) cadena de conexión, con la contraseña codificada (%40 en vez de @...).
#                   Local:  postgresql://postgres:postgres@127.0.0.1:55322/postgres
#                   Nube:   la «Session pooler» de Supabase (Connect → Session pooler), puerto 5432.
#   CRM_BACKUP_DIR  carpeta destino (por defecto ~/EliPanel-copias). No puede estar dentro del repo
#                   salvo que git la ignore.
#
# Resultado: $CRM_BACKUP_DIR/eli-crm-AAAAMMDD-HHMMSS/{roles,schema,data}.sql.gz + SHA256SUMS
# Restaurar: ver docs/crm/backup-crm.md.
set -euo pipefail

# Opciones (pisan a las variables de entorno).
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-url) CRM_DB_URL="${2:?Falta el valor de --db-url}"; shift 2 ;;
    --dir)    CRM_BACKUP_DIR="${2:?Falta el valor de --dir}"; shift 2 ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1 (ver --help)" >&2; exit 1 ;;
  esac
done
# Una carpeta relativa se entiende desde donde se lanzó el script, no desde el repo.
if [[ -n "${CRM_BACKUP_DIR:-}" && "$CRM_BACKUP_DIR" != /* && "$CRM_BACKUP_DIR" != "~"* ]]; then
  CRM_BACKUP_DIR="$PWD/$CRM_BACKUP_DIR"
fi

cd "$(dirname "$0")/.."
repo="$PWD"

# CRM_DB_URL del entorno manda; si no está, se busca solo esa línea en .env (no se carga todo el .env).
if [[ -z "${CRM_DB_URL:-}" && -f .env ]]; then
  CRM_DB_URL="$(grep -E '^CRM_DB_URL=' .env | tail -n1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")"
fi
if [[ -z "${CRM_DB_URL:-}" ]]; then
  echo "Falta CRM_DB_URL (cadena de conexión de la base). Ver docs/crm/backup-crm.md." >&2
  exit 1
fi
if [[ "$CRM_DB_URL" != postgres://* && "$CRM_DB_URL" != postgresql://* ]]; then
  echo "CRM_DB_URL no parece una cadena postgresql://..." >&2
  exit 1
fi
# Para los mensajes: la URL sin usuario ni contraseña.
destino_db="${CRM_DB_URL#*@}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "No está la CLI de Supabase (brew install supabase/tap/supabase)." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker no está corriendo: abre Docker Desktop (open -a Docker) y vuelve a intentar." >&2
  exit 1
fi

base="${CRM_BACKUP_DIR:-$HOME/EliPanel-copias}"
mkdir -p "$base"
base="$(cd "$base" && pwd -P)"
repo_real="$(cd "$repo" && pwd -P)"
# Dentro del repo solo si git ignora esa carpeta (las copias tienen datos de salud).
if [[ "$base/" == "$repo_real/"* ]] && ! git -C "$repo" check-ignore -q "$base/x.sql.gz"; then
  echo "CRM_BACKUP_DIR ($base) está dentro del repo y git NO lo ignora. Usa una carpeta fuera del repo." >&2
  exit 1
fi

umask 077
dest="$base/eli-crm-$(date +%Y%m%d-%H%M%S)"
mkdir "$dest"
chmod 700 "$base" "$dest"
# Si algo falla a medias, no queda una copia incompleta que parezca buena.
trap 'echo "Falló: se borra la copia incompleta $dest" >&2; rm -rf "$dest"' ERR

echo "Copiando $destino_db → $dest"
# Primero el esquema: si no es la base del panel, se corta ANTES de copiar datos ajenos.
supabase db dump --db-url "$CRM_DB_URL" -f "$dest/schema.sql"
grep -q 'CREATE TABLE IF NOT EXISTS "public"."pacientes"' "$dest/schema.sql" \
  || { echo "schema.sql no tiene la tabla pacientes: ¿es la base correcta?" >&2; false; }
supabase db dump --db-url "$CRM_DB_URL" --role-only -f "$dest/roles.sql"
supabase db dump --db-url "$CRM_DB_URL" --data-only --use-copy -f "$dest/data.sql"

for f in roles schema data; do
  [[ -s "$dest/$f.sql" ]] || { echo "$f.sql salió vacío" >&2; false; }
done

gzip -9 "$dest"/*.sql
(cd "$dest" && shasum -a 256 ./*.sql.gz > SHA256SUMS)
chmod 600 "$dest"/*
trap - ERR

echo "Listo:"
ls -lh "$dest"
echo "Contiene datos de salud: no la subas a git, a Notion ni a chats. Guárdala cifrada (ver docs/crm/backup-crm.md)."
