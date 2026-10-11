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
3. Copia **primero el esquema** y comprueba que tiene la tabla `pacientes`: si la URL apunta a otra
   base (por ejemplo otro proyecto de Supabase local en 54322), corta **antes** de copiar datos
   ajenos. Después comprueba que nada salió vacío.
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
scripts/backup-crm.sh --db-url postgresql://postgres:postgres@127.0.0.1:55322/postgres --dir /tmp/copias
scripts/backup-crm.sh --help
```

`--db-url` y `--dir` pisan a las variables. Usa `--db-url` solo con la base local: en la línea de
comandos la contraseña se ve en `ps`. Para la nube, `CRM_DB_URL` en `.env`.

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

## Verificación (11-oct-2026, Supabase local, solo datos inventados del seed)

1. **Base equivocada:** `scripts/backup-crm.sh --db-url …@127.0.0.1:54322/postgres` (otro proyecto
   local) → «schema.sql no tiene la tabla pacientes: ¿es la base correcta?», corta antes de copiar
   datos y borra la carpeta incompleta (queda vacía).
2. **Copia real:** `scripts/backup-crm.sh --db-url …@127.0.0.1:55322/postgres --dir <scratchpad>` →
   `eli-crm-20261011-085026/` con `roles.sql.gz` (233 B), `schema.sql.gz` (10 KB), `data.sql.gz`
   (10 KB) y `SHA256SUMS`, todo `-rw-------`. `shasum -a 256 -c SHA256SUMS` → OK los tres.
3. **Simulacro de restauración** en una base temporal `tk13_restauracion` (mismo contenedor, aparte
   de `postgres`; borrada al final). Como una base nueva no trae lo que pone la plataforma, se
   crearon sustitutos mínimos: esquemas `auth`/`extensions`, `auth.uid()` y `auth.users`.
   - `schema.sql`: todo lo nuestro se creó. Solo fallaron piezas de la plataforma que en un proyecto
     Supabase ya existen: `pg_cron` (solo en la base `postgres`), esquema `vault` y la publicación
     `supabase_realtime`.
   - Datos de `public` + `auth.users` con `SET session_replication_role = replica` en una sola
     transacción: sin errores.
   - Filas restauradas = filas del archivo: users 3, auditoría 64, conversaciones 18, pacientes 22,
     cambios_etapa 23, citas 12, datos_clinicos 2, horario 6, mensajes 73, personal 2; 7 secuencias.
   - Estructura igual a la original: RLS 11/11 tablas, 21 políticas, 24 funciones
     (`public`+`private`), 15 triggers.
4. `git check-ignore` cubre `EliPanel-copias/`, `eli-crm-*/`, `*.sql.gz` y `backups/`.

**Pendiente:** correrlo una vez contra `eli-crm` en la nube (cuando exista, TK-12). Ahí la
restauración completa (con `auth` real) se prueba en un proyecto nuevo o en la base local.
