# Workflows

Exportaciones de n8n listas para importar (**⋯ → Import from File**). Ninguna contiene secretos ni datos
personales: las credenciales van solo por nombre, y el calendario y el número usan marcadores
(`TU_CALENDARIO@gmail.com`, `TU_PHONE_NUMBER_ID`).

| Archivo | Estado | Qué es |
|---|---|---|
| [`eli-version4.json`](eli-version4.json) | **Producción** | Eli: webhook Kapso, agente Gemini con memoria en Redis y agenda interna en Google Calendar (ver [arquitectura](../docs/arquitectura.md)) |
| [`eli-crm.json`](eli-crm.json) | **Nuevo, inactivo** (TK-18) | Sub-workflow `Eli → CRM`: POST a la Edge Function `eli-evento` (timeout 5 s, 2 reintentos); si falla guarda la entrada en la lista Redis local `v4:crm:errores` (máx. 200) y termina sin error. Credenciales: `Eli CRM secreto` (Header Auth) y `Redis local` |
| [`pruebas/eli-version4-crm-copia.json`](pruebas/eli-version4-crm-copia.json) | Copia de prueba, inactiva (TK-19, regenerada para TK-20 sobre el `version4` de `main` d54e52b, con los seguimientos «Seg:») | `version4` + 3 ramas hacia `Eli → CRM` sin esperar (tras «¿Mensaje nuevo?», «Responder por WhatsApp» y «Crear evento»). Se genera con [`../scripts/crm-copia-version4.jq`](../scripts/crm-copia-version4.jq); lo único que cambia fuera de las ramas nuevas es el path del webhook |
| [`pruebas/queue-selftest.json`](pruebas/queue-selftest.json) | Prueba | Webhook GET + Code: comprueba cola → worker → runner |
| [`pruebas/redis-selftest.json`](pruebas/redis-selftest.json) | Prueba | Webhook GET + Redis set/get: comprueba la credencial `Redis local` |
| [`legacy/v2-bot-supabase.json`](legacy/v2-bot-supabase.json) | Histórico | Bot v2 integrado con Supabase (`barberia-reservas`), ver [`legacy/supabase/`](legacy/supabase/) |
| [`legacy/v2-agenda-gcal.json`](legacy/v2-agenda-gcal.json) | Histórico | Sub-workflow de agenda v2 (reemplazado por la entrada interna de version4, [ADR 0004](../docs/adr/0004-un-solo-workflow.md)) |
| [`legacy/v2-fuentes/`](legacy/v2-fuentes/) | Histórico | Scripts que generaron la v2 |
| [`legacy/version4-inicial.sdk.ts`](legacy/version4-inicial.sdk.ts) | Histórico | Fuente original de version4 con el Workflow SDK de n8n (OpenRouter + Redis Cloud). **La fuente de verdad es `eli-version4.json`** |

## Privacidad del CRM (TK-41)

Por ahora el CRM **no guarda ni muestra el contenido de los mensajes**. Los eventos `mensaje_entrante`
y `mensaje_saliente` salen sin `texto` (solo `tipo`, `telefono`, `nombre_whatsapp`, `message_id` o
`execution_id` y `en`). `eli-crm.json` además quita `texto` antes del POST y antes de guardar en la
lista `v4:crm:errores`. Para volver a guardar el texto hay que reponerlo en los dos armadores de
`scripts/crm-copia-version4.jq` y en esas dos expresiones de `eli-crm.json`.

## Reglas

- **La fuente de verdad es el JSON exportado** desde n8n con `scripts/export-workflow.sh`. No se editan
  a mano, salvo para corregir un dato privado.
- Cada cambio en producción se exporta y se sube en el mismo PR que lo describe (ver
  [CONTRIBUTING.md](../CONTRIBUTING.md)).
- Un workflow nuevo de producción lleva un nombre con versión (`Eli · Recordatorios`, `version5`) y
  una fila en esta tabla.
- Lo que deja de usarse va a `legacy/`, no se borra.
