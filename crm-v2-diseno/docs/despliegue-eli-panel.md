# Despliegue del CRM (Vocero v2) junto al panel Eli

Este documento cubre la instalación **compartida**: el CRM completo de
`crm-v2-diseno/` corriendo en Vercel contra el **mismo proyecto Supabase** que
el panel «Eli Panel», pero en un **esquema propio (`vocero`)** para no chocar
con las tablas del panel en `public`.

## 1. Esquema `vocero` (search_path)

Las tablas de drizzle se declaran **sin esquema** (`pgTable("contact", …)`), así
que el esquema lo decide el `search_path` de la sesión:

| Dónde | Cómo |
|---|---|
| App (runtime) | `PG_CONNECTION_OPTIONS` en `src/lib/db/index.ts` fija `connection.search_path` con `DATABASE_SCHEMA` (`public` por defecto). |
| Migraciones | `scripts/migrate.mjs` fija el mismo `search_path` en su conexión. |
| `drizzle-kit` | `drizzle.config.ts` lo añade como `options` de la URL **y** limita la introspección con `schemaFilter: [schema]`. |

> El **pooler de Supabase (Supavisor) ignora `options`** en la URL, por eso las
> migraciones se corren con `scripts/migrate.mjs` (que sí puede fijar
> `search_path` en la conexión de postgres.js). Con un Postgres propio,
> `drizzle-kit` también respeta la URL.

Como las migraciones generadas por drizzle referencian las claves foráneas con
`"public".tabla`, en este fork se reescribieron a `"vocero".tabla`
(`drizzle/*.sql`). Si algún día corres `pnpm db:generate`, revisa el SQL: drizzle
volverá a emitir `"public".` porque `schema.ts` no usa `pgSchema`.

## 2. Variables de entorno

Las reales viven fuera de git en `~/.config/eli-crm/v2.env` y se cargan en
Vercel. Obligatorias:

```bash
APP_BASE_URL=https://eli-panel.vercel.app
DATABASE_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SCHEMA=vocero
BETTER_AUTH_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -base64 32>   # 32 bytes base64 (44 chars)
META_WEBHOOK_VERIFY_TOKEN=<openssl rand -hex 32>
BOT_API_KEY=<mínimo 16 caracteres>
```

Opcionales con efecto grande: `AGENDA=on` (pantalla Citas), `CHANNELS=whatsapp,instagram,messenger`,
`ATRIBUCION=on`, `OPENROUTER_API_TOKEN`, `BRAIN_DISPATCH_URL`, `MEDIA_DIR`.

## 3. Migraciones

```bash
set -a && . ~/.config/eli-crm/v2.env && set +a
MIGRATIONS_DIR="$PWD/drizzle" node scripts/migrate.mjs   # idempotente
```

Se aplican 17 migraciones (32 tablas) en `vocero`. **En Vercel no se aplican
solas**: el contenedor Docker las corre al arrancar (`vocero-entrypoint.sh`),
pero un deployment serverless no tiene ese paso, así que hay que correrlas una
vez (arriba) o desde un job manual.

## 4. Acceso y demo

```bash
# Acceso (usa Better Auth, misma puerta que el login)
NEW_PASSWORD='...' NEW_NAME='Cody Cabrera' \
  pnpm acceso:crear codycabreraa@gmail.com     # crea usuario + organización (owner)

# Demo «EliDental» (8 contactos, 32 mensajes, 9 KB, 1 corrida de Laboratorio)
pnpm seed:demo                                  # añade --force para recargar
```

El primer alta crea la organización con su pipeline (6 etapas) y el perfil del
agente; el seed llena la bandeja, el kanban, la base de conocimiento y una
corrida de Laboratorio. **La entrada es `POST /login`** con ese correo y esa
contraseña.

## 5. Vercel (serverless)

Funciona (todos los handlers son dinámicos), pero el diseño original asume un
**proceso largo** (self-hosted en Docker). En serverless:

- **Trabajo en segundo plano** (`src/server/ai/pipeline.ts` con `setTimeout`,
  `dispatch/worker.ts` con `setInterval`, `lab/runner.ts`): corre solo mientras
  vive la instancia; Vercel puede terminarla después de responder. El agente
  puede no contestar de forma fiable → revisa `maxDuration` y considera un
  cron/worker externo.
- **SSE (`GET /api/events`)**: streaming soportado, pero sujeto a la duración
  máxima de la función; el `heartbeat` de 25 s mantiene viva la conexión.
- **`MEDIA_DIR`**: en Vercel el FS es de solo lectura salvo `/tmp` (efímero):
  el logo, el icono y los adjuntos **no persisten**. Usa un volumen/almacén
  externo si necesitas adjuntos.
- **Pool de conexiones**: `PG_CONNECTION_OPTIONS` usa `max: 10` por instancia;
  con muchas instancias puede agotar el pooler. Supabase pooler en modo sesión
  (puerto 5432) es lo correcto aquí.

## 6. Conectar Eli (n8n) por `BOT_API_KEY`

Contrato público en `specs/001-vocero-core/contracts/api.md` y README
(«Trae tu propio agente»). Auth: header **`X-API-Key: <BOT_API_KEY>`** (sin
ella, 401). Base: `https://eli-panel.vercel.app`.

| Endpoint | Para qué |
|---|---|
| `GET  /api/bot/context?waIdentity=…` | Contacto, etapa, ficha, handoff, ventana de 24 h y (con `AGENDA`) citas. |
| `POST /api/bot/messages` | Responder al cliente (sale marcado como IA). |
| `GET  /api/bot/profile` | Perfil del agente y knowledge base. |
| `PUT  /api/bot/ficha` | Guardar lo que el bot descubre del lead (claves libres). |
| `POST /api/bot/handoff` | Devolver la conversación a un humano. |
| `POST /api/bot/typing` | Marcar leído y «escribiendo…». |
| `GET  /api/bot/media/{mediaId}` | Descargar un adjunto entrante. |
| `GET  /api/bot/availability` | Con `AGENDA`: huecos para ofrecer. |
| `POST` · `PATCH /api/bot/bookings` | Con `AGENDA`: reservar (201) / mover (200) un hueco ofrecido. |

### Cómo n8n crea contactos, conversaciones y citas

- **Contacto, lead y conversación los crea la ingesta**, no hay endpoint de alta.
  La única puerta pública es el webhook:
  `POST /api/webhooks/wa/<META_WEBHOOK_VERIFY_TOKEN>` con el formato de la
  WhatsApp Cloud API (campo `entry[].changes[].value.metadata.phone_number_id` +
  `messages[]`). Es idempotente (dedup por `wa_message_id`).
  **Requisito**: ese `phone_number_id` debe existir como número conectado en
  **Ajustes → WhatsApp**; si no, el evento se descarta («phone_number_id
  desconocido»). Sin `META_APP_SECRET` no se valida la firma HMAC del webhook.
- **Contexto / conversación pasa por `conversationId`** (o `identity`):
  `GET /api/bot/context?identity=<teléfono normalizado|bsuid:…|ig:…|fb:…>` o
  `?conversationId=<cv_…>`. La respuesta trae contacto, etapa, ficha, handoff,
  ventana de 24 h y (con `AGENDA`) las citas.
- **Ficha del lead**: `PUT /api/bot/ficha` con
  `{ "conversationId": "cv_…", "ficha": { "clave": "valor" } }` (merge; `null`
  borra una clave). Devuelve la ficha completa.
- **Responder**: `POST /api/bot/messages` con
  `{ "conversationId": "cv_…", "text": "…" }` → `{ "messageId": "msg_…" }`.
  409 tipados: `ai_paused`, `window_closed`, `sandbox_violation`.
- **Citas (requiere `AGENDA=on`)**:
  1. `GET /api/bot/availability?conversationId=cv_…` (opcional `date=YYYY-MM-DD`,
     `limit`, `perDay`, `days`). **Registra** las horas ofrecidas; sin esto no
     se puede reservar nada.
  2. `POST /api/bot/bookings` con
     `{ "conversationId": "cv_…", "startUtc": "2026-05-04T15:00:00.000Z", "notes": "…" }`
     → **201**. Solo acepta un instante que ya se haya ofrecido.
  3. `PATCH /api/bot/bookings` con `{ "conversationId": "cv_…", "startUtc": "…" }`
     → **200** (mover). Acepta 2xx: los mocks que devolvían 200 enmascararon
     fallos reales.
- **Despacho (recomendado si Eli es el cerebro)**: con `BRAIN_DISPATCH_URL` **y**
  `BOT_API_KEY`, el CRM le pasa cada turno a Eli en vez de que Eli reciba el
  webhook: `POST` firmado (`X-Vocero-Signature: sha256=<HMAC-SHA256 del cuerpo
  crudo con BOT_API_KEY>`, `X-Vocero-Dispatch-Id`, `X-Vocero-Organization`) con
  la ráfaga de la conversación (cuerpo con `dispatchId`, `organization`,
  `conversation`, `contact`, `messages`). Eli responde con `POST
  /api/bot/messages`. Contrato en
  `specs/021-despacho-estandar/contracts/despacho.md`.

