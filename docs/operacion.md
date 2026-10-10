# Operación

Procedimientos para mantener Eli funcionando. Todos los comandos se ejecutan en la carpeta del
proyecto.

## Encender y apagar

```bash
open -a Docker              # macOS: abre Docker Desktop y espera a que el motor esté listo
docker compose up -d        # levanta los 6 servicios
ngrok http 5678             # en otra terminal, que se queda abierta (o con tu dominio: --url=...)
scripts/check.sh            # todo debe salir OK
```

Para apagar sin perder datos: `docker compose stop` (o `docker compose down`).

> **Nunca** uses `docker compose down -v`, `docker volume rm` ni `docker system prune --volumes`:
> borran los workflows, las credenciales y la base de datos.

Al arrancar, n8n tarda alrededor de 1 minuto en terminar de instalar Kapso: `/healthz` responde antes
de que todo esté listo. Espera a ver `Editor is now accessible` en `docker compose logs n8n`.

## Después de reiniciar el computador

Si el Mac se reinició o se cerró Docker, **nada responde**: ni n8n, ni ngrok, ni Eli. Para levantar todo:

```bash
open -a Docker                                   # espera a que la ballena quede quieta
cd ~/agentWhatsap
docker compose up -d                             # los 6 servicios
nohup ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678 > local-files/ngrok.log 2>&1 &
scripts/check.sh                                 # todo OK, incluido «Túnel»
```

- `nohup … &` deja ngrok corriendo aunque cierres la terminal. Para detenerlo: `pkill -f "ngrok http"`.
- Para que Docker arranque solo al iniciar sesión: Docker Desktop → *Settings → General* → **Start
  Docker Desktop when you sign in**.
- Si `scripts/check.sh` marca «ngrok no está activo», repite la línea de ngrok.

## Revisar la salud

`scripts/check.sh` revisa los 6 servicios, PostgreSQL, Redis, `/healthz`, que las versiones coincidan,
que Kapso esté instalado en el principal y en el worker, y el túnel de ngrok. Sale con código 0 si todo
está bien.

Logs útiles:

```bash
docker compose logs -f n8n n8n-worker            # ejecuciones y errores
docker compose logs n8n-worker | grep execution  # "Worker started/finished execution N"
```

## Cambiar la URL pública (ngrok)

1. En `.env`, cambia `N8N_HOST`, `N8N_PROTOCOL=https` y `WEBHOOK_URL` (con `/` al final).
2. Ejecuta `docker compose up -d`: recrea n8n y el worker con la nueva URL.
3. Actualiza la URL en Kapso (webhook), en Google Cloud (orígenes y URI de redirección) y en los
   conectores MCP.

## Publicar un cambio en un workflow

Desde el editor (lo normal): edita, pulsa **Save** y luego **Publish**. El worker toma la nueva versión
publicada en la siguiente ejecución.

Por CLI (importar un archivo):

```bash
scripts/backup.sh
docker compose cp workflows/eli-version4.json n8n:/tmp/wf.json
docker compose exec n8n n8n import:workflow --input=/tmp/wf.json
docker compose exec n8n n8n publish:workflow --id=<ID>
docker compose restart n8n           # obligatorio: el CLI no avisa al proceso que ya está corriendo
```

Importar **desactiva** el workflow: no olvides `publish:workflow`. Después ejecuta el autotest (abajo).

Para llevar un cambio al repositorio: `scripts/export-workflow.sh <ID> workflows/<archivo>.json`
(ver [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Autotests sin efectos externos

En `workflows/pruebas/` hay dos workflows inocuos: no envían WhatsApp ni tocan el calendario.

| Workflow | URL (cuando está publicado) | Qué prueba | Respuesta esperada |
|---|---|---|---|
| `queue-selftest.json` | `GET /webhook/queue-selftest-7f3a9c` | Cola → worker → runner JS | `{"ok":true,"sum":6,...}` |
| `redis-selftest.json` | `GET /webhook/redis-selftest-4b8e2d` | Worker → Redis local (DB 1) con la credencial `Redis local` | `{"valor":"ok-local"}` |

Publícalos solo mientras pruebas: mientras ngrok esté encendido, son URLs públicas. El log del worker
debe mostrar `Worker started execution N` y `Worker finished execution N`.

## Respaldos

```bash
scripts/backup.sh
```

Crea `backups/<fecha>/` con permisos 700. La carpeta contiene `postgres.dump`, `workflows.json`,
`credentials.json` (cifradas), `n8n_data.tar.gz`, `docker-compose.yml` y `env`. **No** se sube a Git.
Haz un respaldo antes de cada cambio de versión, migración o importación por CLI.

### Restaurar

- **Un workflow:** impórtalo desde `workflows.json` con `import:workflow` (ver arriba).
- **Toda la base:**
  ```bash
  docker compose stop n8n n8n-worker
  docker compose exec -T postgres pg_restore -U n8n -d n8n --clean --if-exists < backups/<fecha>/postgres.dump
  docker compose start n8n n8n-worker
  ```
  Requiere la misma `N8N_ENCRYPTION_KEY` (está en `backups/<fecha>/env`).

## Migrar desde SQLite

Esto es lo que funcionó el 2026-10-06 al pasar de SQLite a PostgreSQL:

1. Respaldo del volumen y de `.env`. Comprueba que `N8N_ENCRYPTION_KEY` de `.env` coincida con
   `encryptionKey` de `/home/node/.n8n/config`.
2. Exporta desde SQLite: `n8n export:entities --outputDir=/files/n8n-migration`.
3. Con PostgreSQL y Redis sanos y **sin worker**, importa con n8n principal detenido:
   `docker compose run --rm --no-deps n8n import:entities --inputDir=/files/n8n-migration --truncateTables=true`.
4. **Ajusta las secuencias.** La importación conserva los IDs pero no actualiza los contadores, y la
   primera ejecución falla con `duplicate key value violates unique constraint`:

   ```sql
   DO $$ DECLARE r record; m bigint; cur bigint; BEGIN
     FOR r IN SELECT n.nspname sch, s.relname seq, t.relname tbl, a.attname col
       FROM pg_class s JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a','i')
       JOIN pg_class t ON t.oid = d.refobjid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       JOIN pg_namespace n ON n.oid = s.relnamespace
       WHERE s.relkind = 'S' AND n.nspname = 'public'
     LOOP
       EXECUTE format('SELECT max(%I) FROM %I.%I', r.col, r.sch, r.tbl) INTO m;
       EXECUTE format('SELECT last_value FROM %I.%I', r.sch, r.seq) INTO cur;
       IF m IS NOT NULL AND m > cur THEN PERFORM setval(format('%I.%I', r.sch, r.seq), m, true); END IF;
     END LOOP; END $$;
   ```
5. Comprueba que coincidan los conteos (workflows, credenciales, ejecuciones) y que las credenciales se
   descifren. Después arranca el worker.

## Problemas conocidos

| Síntoma | Causa | Solución |
|---|---|---|
| `Database connection recovered after ~355000ms`, `Failed to heartbeat instance` | El Mac se suspendió y Docker congeló la VM | Nada: se recupera solo. Para 24/7, usar un servidor |
| Worker: `n8n detected that some packages are missing` | En modo worker, n8n no instala desde `N8N_COMMUNITY_PACKAGES` | `N8N_REINSTALL_MISSING_PACKAGES=true` en el worker (ya está en el Compose) |
| `n8n-runner` en «Waiting for task broker to be ready» para siempre | `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true` deja al principal sin broker | No activar esa opción |
| Webhook 404 después de importar o publicar por CLI | El principal no se enteró del cambio | `docker compose restart n8n` y esperar a `Editor is now accessible` |
| `duplicate key value violates unique constraint` | Secuencias sin ajustar tras `import:entities` | El script SQL de arriba |
| `There was a problem executing the workflow` (500) | Error dentro de la ejecución | `docker compose logs n8n n8n-worker` y la pestaña **Executions** |
| Credenciales «could not be decrypted» | `N8N_ENCRYPTION_KEY` distinta de la original | Restaurar la clave desde un respaldo de `.env` |

Más errores de configuración (Google OAuth, Kapso, zsh) en la [GUIA](../GUIA.md#errores-frecuentes).
