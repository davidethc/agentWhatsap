# ADR 0002: Redis local (DB 1) para el estado del bot

- **Estado:** Aceptada
- **Fecha:** 2026-10-06

## Contexto

`version4` usa Redis para la memoria del chat, los locks por conversación, la deduplicación y los
mensajes pendientes. Usaba un Redis Cloud gratuito (credencial `Redis account`). Con el modo queue ya
existe un Redis local.

## Decisión

Los 7 nodos Redis de `version4` usan la credencial **`Redis local`**: host `redis`, puerto `6379`,
**base de datos 1**. La base 0 queda para la cola de n8n (`bull:*`), así los datos del bot nunca se
mezclan con la cola.

La credencial `Redis account` (la nube) se conserva por si hace falta volver atrás. Los workflows
antiguos (`version3`, v2) siguen apuntando a ella.

## Consecuencias

- Menos latencia y sin depender del plan gratuito de un proveedor externo.
- La memoria de conversación de Redis Cloud no se migró: el bot empezó con memoria vacía. No se pierde
  nada importante, porque la memoria dura 24 horas.
- Si Redis local cae, cae también la cola: el sistema entero se detiene, no solo el bot.
