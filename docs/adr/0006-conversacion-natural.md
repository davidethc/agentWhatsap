# ADR 0006: Conversación natural, sin botones ni formularios

- **Estado:** Aceptada. Reemplaza a la [ADR 0005](0005-reglas-antes-que-ia.md)
- **Fecha:** 2026-10-10

## Contexto

La ADR 0005 proponía botones, respuestas fijas y un formulario de WhatsApp (Flow) antes de la IA. Al
revisarlo con el dueño del proyecto:

- Los pacientes escriben como hablan («hola», «quiero info», «necesito agendar», «¿cómo está?»), no
  tocan botones. Un menú hace que la conversación se sienta como un bot.
- Meta no deja publicar el formulario en la cuenta actual (`422 Integrity requirements not met`).
- La IA con las herramientas de agenda ya resuelve bien la reserva; lo que falta es **cómo conversa** y
  **cómo propone horarios**.

## Decisión

- Eli conversa **solo con texto natural**. No hay botones, listas ni formularios.
- La lógica vive en el prompt del agente (secciones *OTROS MENSAJES*, *CÓMO CERRAR LA CITA* y *AGENDA*):
  saludo humano, información breve, honestidad si le preguntan si es un bot, límite ante groserías,
  siempre dos turnos concretos, y alternativas cercanas si la hora pedida está ocupada.
- Los recordatorios futuros serán plantillas de Meta **de solo texto**; la IA interpreta la respuesta
  del paciente con el contexto de la cita.
- El formulario de cita queda guardado en la rama git `feat/flow-formulario` y como borrador en Kapso,
  por si más adelante se quiere retomar.

Detalle: [conversacion.md](../conversacion.md).

## Consecuencias

- La experiencia se parece a escribirle a una recepcionista.
- Todo depende de la IA: si Gemini no tiene cuota, no hay respuestas fijas de respaldo. El aviso de
  error deriva al WhatsApp del consultorio.
- Las urgencias se detectan por la IA y no por palabras clave. Hay que revisarlo con conversaciones
  reales.
- Los cambios de comportamiento se hacen en el prompt: hay que exportar el workflow y actualizar
  `conversacion.md` en el mismo cambio.
