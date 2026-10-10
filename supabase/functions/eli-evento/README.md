# Edge Function `eli-evento` · Contrato Eli → CRM

Entrada única de Eli (n8n) al Eli Panel. Plan: [docs/crm/plan.md §5](../../../docs/crm/plan.md).
Valida el JSON y llama a `public.registrar_evento_eli(p_evento jsonb)` con la clave de servicio, que
nunca sale de Supabase. **Idempotente:** reenviar el mismo evento no duplica nada.

## Llamada

```
POST https://<proyecto>.supabase.co/functions/v1/eli-evento     (local: http://127.0.0.1:55321/functions/v1/eli-evento)
x-eli-secreto: <ELI_EVENTO_SECRETO>
Content-Type: application/json
```

- No lleva JWT de Supabase (`verify_jwt = false` en `config.toml`): la llave es el secreto.
- n8n: timeout 5 s, 2 reintentos y **sin esperar** (Eli nunca depende de la respuesta).

## Eventos

`telefono` acepta `09…`, `9…`, `+593…`, `00593…` o `593…` y se guarda como `593…`. Las fechas van en
ISO 8601 con zona (`2026-10-13T10:00:00-05:00`).

| `tipo` | Obligatorios | Opcionales | Efecto | Idempotencia |
|---|---|---|---|---|
| `mensaje_entrante` | `telefono`, `message_id` | `nombre_whatsapp`, `texto`, `en` (por defecto ahora) | Crea la conversación y el titular en **Nuevo** si es la primera vez; guarda el mensaje; suma un turno; 2.º turno: Nuevo → **Conversando**; Perdido → **Conversando** | `message_id` (el del dedup de n8n) |
| `mensaje_saliente` | `telefono`, `execution_id` (texto o número) | `texto`, `en` | Guarda la respuesta de Eli; no cuenta turnos | `out:<execution_id>` |
| `cita_reservada` | `telefono`, `gcal_event_id`, `inicio` | `fin` (por defecto +1 h), `servicio`, `nombre` | Crea o actualiza la cita (origen `eli`, `sync = ok`) ligada al titular; paciente → **Agendó**. `nombre` solo se usa si hay que crear al titular | `gcal_event_id` |

Todo lo que cambia queda con **actor = eli** en `cambios_etapa` y `auditoria`.

Ejemplo:

```json
{"tipo":"mensaje_entrante","telefono":"0900000091","nombre_whatsapp":"Paciente Prueba",
 "message_id":"wamid.ABC","texto":"Hola","en":"2026-10-10T10:00:00-05:00"}
```

## Respuestas

| HTTP | Cuerpo | Cuándo |
|---|---|---|
| 200 | `{"ok":true,"duplicado":false}` | Guardado |
| 200 | `{"ok":true,"duplicado":true}` | Ya estaba (reintento o mensaje repetido) |
| 400 | `{"ok":false,"error":"…"}` | JSON inválido, `tipo` desconocido, falta un campo, fecha o teléfono no válidos |
| 401 | `{"ok":false,"error":"No autorizado"}` | Sin `x-eli-secreto` o incorrecto |
| 405 | `{"ok":false,"error":"Use POST"}` | Otro método |
| 500 | `{"ok":false,"error":"…"}` | Fallo interno; queda una fila en `errores_integracion` (origen `eli`) con el tipo y los ids, **sin teléfono ni texto** |

## Probar en local

```bash
cp supabase/functions/.env.example supabase/functions/.env   # y poner un secreto largo
supabase functions serve --env-file supabase/functions/.env
curl -i -X POST http://127.0.0.1:55321/functions/v1/eli-evento \
  -H "x-eli-secreto: $ELI_EVENTO_SECRETO" \
  -d '{"tipo":"mensaje_entrante","telefono":"0900000091","message_id":"wamid.prueba1","texto":"Hola"}'
```

Solo números claramente falsos (`5939000000xx`). En el proyecto remoto el secreto se pone con
`supabase secrets set ELI_EVENTO_SECRETO=…` (TK-12) y el mismo valor en la credencial de n8n.
