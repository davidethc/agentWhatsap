# ADR 0007: Kapso como puente con WhatsApp y como modelo de cobro

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

Eli necesita enviar y recibir mensajes de WhatsApp de cada consultorio. Las opciones evaluadas:

| Opción | A favor | En contra |
|---|---|---|
| **Kapso** (intermediario oficial sobre la API Cloud de Meta) | Alta en minutos, nodo de n8n, búfer de mensajes, coexistencia con la app WhatsApp Business, **facturación administrada** (créditos de Kapso), MCP, gestión de plantillas y flows, funciones multi-cliente | Plan pago al pasar de 1 número; dependencia del proveedor; una cuenta con créditos de Kapso no puede pasarse luego a tarjeta propia sin migrar el número; la coexistencia es menos estable que un número dedicado |
| **API Cloud de Meta directo** (nodos de WhatsApp de n8n) | Sin plataforma intermedia: solo se paga a Meta | App de Meta, tokens de usuario de sistema, verificación; **cada cliente debe poner su tarjeta en Meta**; sin búfer (ya lo tenemos en n8n: dedup, lock, pendientes) |
| **Otros intermediarios** (360dialog, Twilio, WATI, Gupshup) | Algunos con tarifa fija; Twilio muy estable | Recargos por mensaje o por mes; integración con n8n menos directa |
| **No oficiales** (Evolution API, WAHA, Baileys) | Gratis, sin plantillas | Violan las condiciones de WhatsApp: riesgo de bloqueo del número del cliente |
| **Software dental con WhatsApp** (Doctocliq, Dentalink) | Todo en uno | No es nuestro producto; poca personalización |

Requisito de negocio (2026-10-10): **no pedir tarjeta a los clientes**. Según la documentación de Kapso,
solo un intermediario autorizado (BSP) puede pagarle a Meta por los clientes. Sin él, cada cliente debe
agregar su propia tarjeta en Meta.

## Decisión

- Usar **Kapso** como puente con WhatsApp, con **facturación administrada**: Kapso paga a Meta desde un
  saldo prepagado del proyecto, en dólares y al precio publicado por Meta.
- Gemini y el servidor se pagan con la tarjeta del proyecto. Al cliente se le cobra una **mensualidad
  fija por adelantado**, con margen sobre el costo de Meta (principalmente recordatorios), Gemini, el
  plan de Kapso y el servidor.
- No usar conectores no oficiales.

## Consecuencias

- Mantener saldo positivo en Kapso: si llega a cero, se pausan los envíos con costo de **todos** los
  clientes de esa cuenta.
- Al conectar un número nuevo, verificar que quede en «Kapso credits». Si la cuenta de WhatsApp ya tiene
  tarjeta propia en Meta, Meta rechaza el crédito de Kapso.
- Revisar periódicamente el precio del plan de Kapso por número. Con muchos clientes, comparar contra la
  API directa, aunque eso implicaría pedir tarjeta a los clientes o convertirse en intermediario.
- La lógica que haría falta para dejar Kapso (dedup, lock por conversación, mensajes pendientes) ya está
  en n8n, lo que reduce el costo de un cambio futuro.

Explicación sin tecnicismos: [como-funciona.md](../como-funciona.md).
