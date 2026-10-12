# Operación del Eli Panel

Guía para quien administra el CRM: levantarlo en local, cambiar la base, sacar copias y qué hacer si algo
cae. Para Eli (n8n, Redis, ngrok) está [docs/operacion.md](../operacion.md); esta guía es solo del CRM.
Para la doctora: [guia-doctora.md](guia-doctora.md).

## Las piezas

| Pieza | Dónde vive | Para qué |
|---|---|---|
| **Base de datos** (Supabase) | Local: Docker, puerto 55322. Nube: proyecto `eli-crm` ([tk-12-proyecto-remoto.md](tk-12-proyecto-remoto.md)) | Pacientes, citas, historial, cuentas y reglas del embudo. |
| **`eli-evento`** (función de Supabase) | Junto a la base | Puerta de entrada de los avisos de Eli ([eli-crm.md](eli-crm.md)). |
| **Panel** (Next.js, carpeta `crm/`) | Local: `pnpm dev` o `pnpm start`. Publicación: Netlify (TK-35, [ADR 0010](../adr/0010-netlify.md)) | Lo que usa la doctora. |
| **Sub-workflow `Eli → CRM`** | n8n | Envía los avisos de `version4` a `eli-evento`. |

El panel solo guarda en el navegador la **URL** y la **clave pública** de Supabase. Los secretos
(`ELI_EVENTO_SECRETO`, claves de servicio, Google) **nunca** van en el panel ni en git.

## 1. Arrancar todo en local

Requisitos: Docker Desktop abierto, la CLI de Supabase y `pnpm`.

```bash
# 1. Base de datos local (primera vez baja imágenes: es lento)
supabase start                    # si corta por «HealthCheckTimeout»: supabase start --ignore-health-check
supabase status                   # muestra la URL de la API (127.0.0.1:55321) y las claves

# 2. Panel
cd crm
cp .env.example .env.local        # y poner la URL y la clave pública que mostró `supabase status`
pnpm install
pnpm dev                          # http://localhost:3000   (o: pnpm build && pnpm start)
```

Variables del panel (`crm/.env.local`, ignorado por git):

| Variable | Valor local |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:55321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave **pública** (`publishable`) de `supabase status` |

Sin esas dos variables el panel **falla a propósito** al construirse, con un mensaje claro.

**Cuenta de prueba (solo local):** `doctora@ejemplo.test` / `eli-panel-local`. La crea `supabase/seed.sql`,
junto con unos 22 pacientes inventados. No existe en la nube.

**Recibir avisos de Eli en local** (para probar `eli-evento`):

```bash
cp supabase/functions/.env.example supabase/functions/.env     # y poner un secreto largo y aleatorio
supabase functions serve --env-file supabase/functions/.env
```

El arranque tarda 20 a 40 segundos. Solo **una** sesión debe servir las funciones a la vez: si dos lo hacen
con secretos distintos, una se cierra sola y la otra responde 401 a la primera.

Datos de ayuda: puertos, `analytics` apagado y el `enable_signup` de correo en
[`supabase/README.md`](../../supabase/README.md).

### Comprobar que todo está sano

```bash
supabase test db                  # pruebas de seguridad y reglas (pgTAP): debe decir Result: PASS
cd crm && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## 2. Cambiar la base de datos (migraciones)

La base se cambia **solo con migraciones** (archivos SQL en `supabase/migrations/`, en orden de fecha). Nunca
a mano en el panel de Supabase.

1. `supabase migration new nombre_corto` y escribir el SQL, **pequeño e idempotente**.
2. Reglas de seguridad al crear algo nuevo: activar **RLS** en cada tabla, dar permisos **solo** a
   `authenticated` y por columna cuando se pueda, funciones con `search_path` fijo, y **revocar** lo que no
   deba tener `anon`. Las pruebas de `supabase/tests/` (en especial `10_seguridad`) fallan si una tabla queda sin RLS o algo queda abierto a `anon`.
3. Escribir o ajustar la prueba en `supabase/tests/`.
4. `supabase db reset` (**borra los datos locales** y vuelve a cargar el seed) y `supabase test db`.
5. Regenerar los tipos del panel y revisar que compile:
   `supabase gen types typescript --local --schema public > crm/lib/data/database.types.ts`
6. Commit local. Aplicarla a la **nube** lo hace el administrador con `supabase db push`, **después de sacar
   una copia** (sección 3). Nunca se aplica una migración a la nube sin probarla antes en local.

## 3. Copias de seguridad (`scripts/backup-crm.sh`)

El plan gratis de Supabase no trae copias descargables, así que se hace una **cada semana**.

```bash
# Local (para probar el script)
scripts/backup-crm.sh --db-url postgresql://postgres:postgres@127.0.0.1:55322/postgres
# Nube: con CRM_DB_URL en .env (Session pooler de Supabase)
scripts/backup-crm.sh
```

Deja `roles`, `schema` y `data` comprimidos, con `SHA256SUMS`, en `~/EliPanel-copias/eli-crm-AAAAMMDD-HHMMSS/`
(carpeta fuera del repositorio, permisos solo para tu usuario). **Tienen datos de salud:** nunca a git, Notion
ni chats; guárdalas cifradas. El script nunca borra copias anteriores.

Cómo programarlo cada semana, usarlo contra la nube y **cómo restaurar**:
[backup-crm.md](backup-crm.md). Una copia que nunca se probó restaurando no es una copia: restaura una vez en
una base vacía de prueba.

## 4. Si el CRM cae

**Primero, lo importante: Eli sigue respondiendo.** El CRM nunca está en el camino de la respuesta a los
pacientes. Lo único que se pierde mientras cae es el registro en el panel, y ese registro se puede recuperar.

| Qué ves | Causa probable | Qué hacer |
|---|---|---|
| El panel no abre o no deja entrar | El panel o Supabase están caídos | Local: `supabase status` y `docker ps`; si falta algo, `supabase start`. Nube: revisa el estado de Supabase y de Netlify. Avisa a la doctora que puede usar WhatsApp mientras tanto. |
| El panel abre pero no hay datos nuevos | `eli-evento` caído o secreto distinto | Prueba `curl -i -X POST <URL>/functions/v1/eli-evento -d '{}'`: **401** significa que está vivo (falta el secreto); 503 o sin respuesta, que no. Local: `supabase functions serve …`. Nube: revisa los registros de la función. |
| `eli-evento` da 401 a n8n | El secreto de n8n («Eli CRM secreto») no coincide con `ELI_EVENTO_SECRETO` | Poner el mismo valor en los dos sitios. |
| Un paciente no aparece | Su aviso quedó pendiente en Redis | Ver abajo «Avisos pendientes». |
| El indicador dice «Sin conexión en vivo» | Se cortó el tiempo real | Recargar la página; los datos están bien. |

### Avisos pendientes (Redis)

Cuando `eli-evento` no responde, n8n guarda cada aviso en la lista `v4:crm:errores` (máximo 200, los más viejos
se descartan). Está en la base **1** de Redis.

```bash
# ¿Cuántos hay?
docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning -n 1 llen v4:crm:errores'
# Verlos (cada entrada: hora, error y el aviso, sin texto del mensaje)
docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning -n 1 lrange v4:crm:errores 0 -1'
```

**Recuperarlos:** cuando `eli-evento` vuelva a responder, reenvía el campo `evento` de cada entrada con el
mismo secreto (un `POST` por aviso). Es seguro repetirlo: el CRM no duplica nada, responde `duplicado: true`.
No hay un reenvío automático todavía; si hay muchos, pídelo como mejora. Nunca copies el secreto a un chat.
Después de reenviar, vacía la lista (`del v4:crm:errores`).

Con pocas pérdidas también sirve **registrar a mano** a los pacientes nuevos desde el panel (**Nuevo
paciente**) y las citas desde **Citas**.

### Si se dañó o se perdió la base

1. No toques nada más; avisa.
2. Restaura la **última copia** en una base vacía siguiendo [backup-crm.md](backup-crm.md#restaurar).
3. Vuelve a programar la tarea de las 24 h (`cron`): no viaja en la copia (lo explica la guía).
4. Reenvía los avisos pendientes de Redis (arriba) para recuperar lo ocurrido desde la copia.

## 5. Cuentas y secretos

- **Cuentas del panel:** las crea el administrador en Supabase (Authentication → Users) y la agrega a la tabla
  `personal` (nombre y rol). **No hay registro público.** Una cuenta que no esté en `personal` entra al
  login pero no ve ningún dato.
- **Clave nueva o cuenta perdida:** el administrador restablece la clave desde Supabase.
- **Secretos** (`ELI_EVENTO_SECRETO`, contraseña de la base, claves de Google): solo en `.env`, en las
  credenciales de n8n y en los secretos de Supabase. Para cambiar el de `eli-evento`: generar uno nuevo
  (`openssl rand -hex 32`), ponerlo en Supabase (`supabase secrets set`) y en la credencial de n8n **a la vez**.
- **Contraseñas del proyecto en la nube:** largas (10–12 caracteres o más) y distintas a las de pruebas.

## 6. Qué falta o está pendiente

| Pendiente | Estado |
|---|---|
| Conectar el `version4` **real** al CRM (TK-20) | Plan listo en [integracion-version4.md](integracion-version4.md); espera aprobación y respaldo. |
| Publicar el panel (TK-35) | Netlify gratis; antes: poner las dos variables públicas y añadir cabeceras de seguridad (ver [qa.md](qa.md), S-1). |
| **Google Calendar** (TK-14 a TK-17 y TK-38) | **Pendiente: Google Calendar.** Última parte. Hace falta crear la cuenta de servicio con [google-calendar.md](google-calendar.md). |
