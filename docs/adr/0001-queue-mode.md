# ADR 0001: n8n en modo queue con PostgreSQL, Redis, worker y runners

- **Estado:** Aceptada
- **Fecha:** 2026-10-06

## Contexto

n8n corría en modo normal con SQLite: un solo proceso recibía webhooks, ejecutaba workflows y servía el
editor. SQLite no admite varios procesos escribiendo a la vez, y una ejecución lenta (la IA puede tardar
15 segundos) frenaba todo lo demás.

## Decisión

- **Modo queue:** el principal (`n8n`) recibe los webhooks y encola. Un `n8n-worker` ejecuta.
- **PostgreSQL 18** como base de datos y **Redis 7** como cola. Ninguno de los dos publica puertos: solo
  son accesibles dentro de la red Docker.
- **Runners externos** (`n8nio/runners`), uno para el principal y otro para el worker. Así los nodos
  Code corren aislados del proceso de n8n.
- **Misma versión exacta** en todas las imágenes (`N8N_VERSION`).
- **Volumen propio para el worker:** si el worker compartiera el volumen del principal, los dos
  instalarían Kapso a la vez en la misma carpeta. Con `N8N_REINSTALL_MISSING_PACKAGES=true`, el worker
  instala Kapso a partir de la lista guardada en PostgreSQL.
- **No se activa `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS`:** con esa opción, el principal no abre su
  broker de tareas y `n8n-runner` queda esperando para siempre.

## Consecuencias

- Las ejecuciones de producción no bloquean el editor, y se pueden agregar workers.
- Hay que **publicar y reiniciar el principal** cuando un workflow cambia por CLI (`publish:workflow`).
- La migración desde SQLite se hizo con `export:entities` / `import:entities`. La importación no
  actualiza las secuencias de PostgreSQL y hubo que ajustarlas a mano (ver
  [operacion.md](../operacion.md#migrar-desde-sqlite)).
- La SQLite original queda intacta en `agentwhatsap_n8n_data` como respaldo.
