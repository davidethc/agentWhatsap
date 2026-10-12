# E2E — Despacho estándar: el CRM le pasa cada turno al cerebro (021, #89)

Arnés: `scripts/e2e-despacho.mjs`. Contrato:
[`specs/021-despacho-estandar/contracts/despacho.md`](../../specs/021-despacho-estandar/contracts/despacho.md).

Precondición: app corriendo (`next dev`) sobre una base migrada, con mocks
(`WA_MOCK_ENABLED=true`, `META_GRAPH_BASE_URL` → wa-mock, `OPENROUTER_BASE_URL`
→ ai-mock con `OPENROUTER_API_TOKEN` y `OPENROUTER_MODEL`), `BOT_API_KEY`
(≥16), `AGENT_COALESCE_MS=1500` y
`BRAIN_DISPATCH_URL=http://127.0.0.1:<puerto libre>/vocero/dispatch`. Para los
otros canales, `CHANNELS=whatsapp,instagram,messenger` y `ZERNIO_BASE_URL` →
zernio-mock.

El arnés hace de **cerebro**: levanta un servidor HTTP en esa URL, en su propio
proceso, verifica la firma de cada despacho sobre el cuerpo crudo y contesta
por `/api/bot/messages`. El turno cruza HTTP de verdad en las dos direcciones.

```bash
node --env-file=.env scripts/e2e-despacho.mjs
```

## Setup

1. Registro o login del operador y conexión de WhatsApp (wa-mock).
2. Interruptor del agente incluido **encendido**, con proveedor de IA: tendría
   con qué contestar.
3. `GET /api/agent/brain-status` → `dispatch.active = true`, `problem = null`;
   `embedded.silenced = true`, `embedded.answering = false`; `warning = null`.

## Historia 1 — Un mensaje llega al cerebro

4. **AC1** Un WhatsApp entrante aparece en la bandeja y, pasada la ventana, el
   cerebro recibe **un** `POST`: firma `x-vocero-signature` válida sobre el
   cuerpo crudo con `BOT_API_KEY`; cabeceras `x-vocero-dispatch-id` (igual al
   `dispatchId`, `dsp_…`) y `x-vocero-organization`; sin `x-vocero-event`; las
   claves del evento en el orden del contrato; `conversation.id` es la de la
   bandeja, `channel = whatsapp`, ventana abierta; un mensaje de texto sin
   adjunto. El cuerpo no lleva el token de WhatsApp ni la llave.
5. `GET /api/bot/context?conversationId=…` → 200, y la identidad del evento es
   la que devuelve el contexto.
6. `POST /api/bot/messages` con ese `conversationId` → 200 y la respuesta está
   en el outbox del wa-mock.
7. **AC10** Pasada otra ventana, el único saliente de la conversación es el del
   cerebro: el agente incluido no contestó. El cerebro recibió el turno una
   sola vez.
8. **AC2** Cinco mensajes seguidos de otro contacto → **un** despacho con los
   cinco, en orden.
9. **AC5** Con el cerebro tardando 3 s en acusar recibo, llega un segundo
   mensaje mientras el primer despacho está en vuelo → llega un **segundo**
   despacho, con otro `dispatchId`, que trae los dos mensajes.
10. **AC4** Una imagen con pie → el evento trae `mediaId`, `mimeType` y
    `caption`, y `GET /api/bot/media/{mediaId}` devuelve la imagen.
11. **AC3** Un mensaje de Messenger (por Meta) y uno de Instagram (por Zernio)
    se despachan con su `channel` y su identidad (`fb:…`, `ig:…`). El evento no
    dice por qué proveedor entró. El cerebro contesta al de Messenger por el
    mismo `/api/bot/messages`.

## Historia 3 — Quién contesta

12. **AC11** Con la IA en pausa en una conversación
    (`PATCH /api/conversations/{id} {aiEnabled:false}`), un mensaje nuevo queda
    en la bandeja y **no** llega al cerebro.
13. **AC11** Pausar la IA *durante* la ventana, con el despacho ya encolado: no
    se entrega, la conversación **no** queda traspasada con motivo `error` y
    `dispatch.pending = 0`.
14. **AC13** Una corrida completa del Laboratorio termina y ningún cliente
    simulado llega al cerebro.

## Historia 2 — El cerebro falla

15. **AC6/AC7** Con el cerebro respondiendo 500: el mensaje está en la bandeja;
    llegan **tres** intentos del **mismo** `dispatchId`, firmados, con ~1 s y
    ~4 s entre ellos, y no hay un cuarto; la conversación pasa a un humano
    (`aiEnabled = false`, `handoffReason = "error"`); `brain-status` enseña
    `dispatch.lastFailure` con el 500. Un mensaje posterior de ese contacto ya
    no se despacha.
16. **AC8** Con el cerebro respondiendo 422: **un** intento y a un humano.
17. **AC6** Con el cerebro apagado (conexión rechazada): a un humano, y el
    motivo es «no se pudo conectar con el cerebro», sin URL ni llave.
18. El cerebro vuelve: un cliente nuevo se despacha, y `lastDeliveredAt` queda
    posterior a `lastFailure.at`.

## Historia 4 — «Quién responde»

19. **AC14–AC16** `GET /api/agent/brain-status` → `dispatch.active`, `host`
    igual a host:puerto de la URL, `lastDeliveredAt`, `pending = 0`. La
    respuesta no contiene la ruta de la URL ni la llave. Las llaves de antes
    (`embedded.answering`, `external.active`, `external.lastSeenAt`, `warning`)
    siguen. Sin sesión → 401.

## Comprobaciones a mano

- **AC9 — reanudar tras un reinicio.** Con la app detenida, insertar una fila
  `pendiente` en `dispatch` (con `not_before` ya vencido) para una conversación
  cuyo último mensaje es del cliente; dejar un cerebro escuchando; arrancar la
  app. Sin que entre ningún mensaje, el cerebro recibe ese `dispatchId` firmado
  y la fila queda `entregado`. El log dice
  `[boot] despacho al cerebro activo → <host>`.
- **AC12 — sin la variable nada cambia.** Quitar `BRAIN_DISPATCH_URL`,
  reiniciar sobre una base nueva y correr `pnpm test:e2e`: el agente incluido
  contesta como antes y la tabla `dispatch` queda vacía.
- **AC16 — mal configurado.** Con `BRAIN_DISPATCH_URL` sin `BOT_API_KEY`, o con
  algo que no es una URL: el log de arranque lo dice, `pnpm doctor` lo marca
  con `!` y el arreglo, la tarjeta enseña «No se puede despachar», y el agente
  incluido sigue contestando.
- **La tarjeta.** En la pantalla Agente, la fila «Despacho al cerebro» dice
  «Activo · host» con la última entrega; tras un turno que no llegó, pasa a
  ámbar con el motivo; la fila del agente incluido dice que está en silencio.
