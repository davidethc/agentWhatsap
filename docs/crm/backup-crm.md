# Copias de la base del Eli Panel (`scripts/backup-crm.sh`)

TK-13. El plan gratis de Supabase **no tiene copias descargables**, así que hacemos una copia
**semanal** con `scripts/backup-crm.sh`.

> ⚠️ Las copias tienen **datos de salud** (pacientes, conversaciones, datos clínicos) y las cuentas
> del panel. Nunca van a git, a Notion, a chats ni a una nube pública. El script las guarda fuera del
> repositorio, con permisos solo para tu usuario (carpetas 700, archivos 600).

## Qué hace

1. Lee la conexión de `CRM_DB_URL` (variable de entorno, o la línea `CRM_DB_URL=` de `.env`).
2. Con `supabase db dump` (pg_dump dentro de Docker; no hace falta instalar Postgres) guarda 3 archivos:
   - `roles.sql`: roles propios de la base.
   - `schema.sql`: tablas, RLS, funciones, triggers e índices de `public` y `private`.
   - `data.sql`: datos de `public` (pacientes, mensajes, citas, auditoría…) y de `auth` (cuentas de
     la doctora y el admin), con `COPY`.
3. Comprueba que nada salió vacío y que el esquema tiene la tabla `pacientes` (base correcta).
4. Los comprime (`.sql.gz`) y escribe `SHA256SUMS`.
5. Si algo falla a medias, borra esa copia incompleta. **Nunca borra copias anteriores.**

Resultado: `~/EliPanel-copias/eli-crm-AAAAMMDD-HHMMSS/` con `roles.sql.gz`, `schema.sql.gz`,
`data.sql.gz` y `SHA256SUMS`.

## Requisitos

- Docker Desktop abierto y la CLI de Supabase (`brew install supabase/tap/supabase`).
- `CRM_DB_URL` con la contraseña **codificada para URL** (`@` → `%40`, `#` → `%23`, `/` → `%2F`…).

| Dónde | `CRM_DB_URL` |
|---|---|
| Local | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Nube (`eli-crm`) | Panel de Supabase → **Connect** → **Session pooler** (puerto 5432). La directa (`db.<ref>.supabase.co`) es solo IPv6 en el plan gratis |

En la nube va en `.env` (que git ignora), nunca en el código:

```bash
CRM_DB_URL=postgresql://postgres.<ref>:<contraseña-codificada>@aws-0-<región>.pooler.supabase.com:5432/postgres
```

Variable opcional: `CRM_BACKUP_DIR` (por defecto `~/EliPanel-copias`). Si apunta dentro del repo, el
script se niega salvo que git ignore esa carpeta.

## Uso

```bash
scripts/backup-crm.sh                                        # toma CRM_DB_URL de .env
CRM_DB_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres' scripts/backup-crm.sh   # local
```

### Semanal (automático)

No se instala solo: lo activas tú. Con `crontab -e`, los domingos a las 21:00 (la Mac tiene que estar
encendida y Docker abierto):

```cron
0 21 * * 0  cd /Users/d/agentWhatsap && scripts/backup-crm.sh >> "$HOME/EliPanel-copias/backup.log" 2>&1
```

Si la Mac suele estar apagada a esa hora, mejor un recordatorio semanal y correrlo a mano.

### Dónde guardarlas

- La carpeta local basta como primera copia. Para una segunda copia fuera de la Mac: un disco externo
  cifrado o un `.zip` con contraseña / imagen cifrada de macOS (Utilidad de Discos → imagen cifrada AES-256).
- Borrar copias viejas es manual (por ejemplo, quedarse con las últimas 8 semanas).

## Restaurar

Solo en una base **vacía** (un proyecto nuevo o la base local tras `supabase db reset` sin seed). Con
el `psql` de la imagen oficial de Postgres, dentro de la carpeta de la copia:

```bash
cd ~/EliPanel-copias/eli-crm-AAAAMMDD-HHMMSS
shasum -a 256 -c SHA256SUMS                  # la copia está sana
gunzip -k *.sql.gz
docker run --rm -v "$PWD":/c -w /c postgres:17 psql "$DESTINO_DB_URL" \
  --single-transaction -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql \
  -c 'SET session_replication_role = replica' \
  -f data.sql
rm -f *.sql                                   # no dejar copias sin comprimir
```

- `session_replication_role = replica` apaga los triggers mientras se cargan los datos: no se
  duplica la auditoría y se resuelve la referencia circular de `pacientes.responsable_id` (pg_dump
  avisa de ella al hacer la copia; es esperado).
- **La tarea de pg_cron no viaja en la copia** (Supabase excluye el esquema `cron`). Después de
  restaurar, volver a correr el bloque `cron.schedule` de
  `supabase/migrations/20261010000800_perdidos_por_silencio.sql` (es idempotente).
- El historial de migraciones tampoco viaja: en un proyecto nuevo, marcar las migraciones como
  aplicadas con `supabase migration repair --status applied <versión>` para que `db push` no las repita.
- Los secretos de las Edge Functions (`ELI_EVENTO_SECRETO`…) no están en la base: se vuelven a poner
  con `supabase secrets set`.

## Verificación (11-oct-2026, Supabase local)

- `supabase db dump --db-url postgresql://postgres:postgres@127.0.0.1:55322/postgres` con
  `--role-only`, sin flags y con `--data-only --use-copy`: los tres archivos salieron bien.
- `data.sql` trae las 11 tablas de `public` y `auth.users`; filas iguales a la base:
  pacientes 22, mensajes 73, citas 12, auditoría 64; 9 `setval` de secuencias.
- `schema.sql` trae `CREATE TABLE IF NOT EXISTS "public"."pacientes"`, las políticas RLS y las
  funciones de `private` (la comprobación del script usa esa línea).
- `git check-ignore` cubre `EliPanel-copias/`, `eli-crm-*/`, `*.sql.gz` y `backups/`.
- **Pendiente:** probar el script una vez contra `eli-crm` en la nube (cuando exista, TK-12) y un
  simulacro de restauración en una base vacía.
