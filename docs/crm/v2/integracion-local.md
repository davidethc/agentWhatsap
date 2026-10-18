# Eli simulada: contrato local de privacidad

Fecha: 2026-10-16. Sin cambios a producción, Gemini ni conversación natural.

`crm-v2-diseno/scripts/eli-privacidad.mjs` exporta `crearEli({request,responder})`.
Consulta `GET /api/bot/context?conversationId=...`, conserva `conversation.epoch`
y prepara texto ficticio. Envía `POST /api/bot/messages` con conversationId,
text, epoch, idempotencyKey. Usa `eli:<eventId>:0` para una salida por evento;
reintentos conservan clave y cuerpo. Para respuestas múltiples usar índices
separados por salida. `pausar` usa POST `/api/bot/handoff`.

Contrato backend acordado: sin epoch → 409 epoch_required; antiguo → 409
stale_epoch; pausa → 409 ai_paused; borrada/expirada → 404 not_found. Errores
vienen en `{error:{code,message}}`. Reanudar usa PATCH
`/api/conversations/:id` con `{aiEnabled:true}` y sesión de usuario. Durante
pausa puede prevalecer stale_epoch según el orden de validación; ambas rechazan.

## Pruebas reproducibles

Desde la raíz: `node --test crm-v2-diseno/scripts/eli-privacidad.test.mjs`.
Son siete pruebas del adaptador con doble HTTP en memoria: envío, duplicados,
reintentos, pausa, pausa→devolver, respuesta antigua, eliminación, fail closed
sin epoch y destino loopback. No certifican DB, locks ni backend real. No
leen `.env`, abren puertos ni llaman WhatsApp/IA.

Para E2E contra una instancia ficticia se exporta
`verificarContratoPrivacidad({request,conversationId,reanudar,eventId})`.
`request` retorna `{status,body}`; `reanudar` hace y comprueba el PATCH con la
sesión local. La función devuelve `{checks:8,passed:true}` o lanza excepción
sin imprimir cuerpos. Un fallo puede dejar el fixture pausado: restaurarlo
antes de repetir. Este E2E real queda pendiente hasta arrancar panel/BD ficticia.

Transporte disponible: `transporteLocal({base,apiKey,cookie})`; sólo HTTP
loopback, timeout 15s, sin redirecciones. La clave va en memoria como header
X-API-Key. No cargar el .env real ni pasar secretos por argumentos de shell.
Comprobar WA_MOCK_ENABLED=true, proveedor mock y BD ficticia antes de ejecutar:
loopback solo no impide que un servidor mal configurado llame a Meta.

## Copia inactiva n8n

`workflows/pruebas/eli-privacidad-simulacion.json`: trigger manual + payload
ficticio. Sin credenciales, red, webhook ni IDs reales; active=false. Es una
copia mínima del límite de integración, no un clon de version4. No ejecuta
las pruebas Node; muestra el comando. Importación/ejecución n8n pendientes.

## Fuentes oficiales consultadas

- [Webhook n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/): URL test al escuchar; producción al publicar.
- [Seguridad Kapso](https://docs.kapso.ai/docs/platform/webhooks/security.md): HMAC SHA256 del cuerpo crudo, X-Webhook-Signature y comparación constante.
- [Entrega Kapso](https://docs.kapso.ai/docs/platform/webhooks/advanced.md): reintentos y lotes por conversación.

El arnés empieza después de ingesta autenticada y no valida firmas Kapso.
No sustituye el contrato de firma Meta por el de Kapso. El ID original del
evento debe sobrevivir a los reintentos para deduplicar.
