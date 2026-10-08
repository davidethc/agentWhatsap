# ADR 0005: Reglas fijas y botones antes que la IA

- **Estado:** Propuesta (diseño para consultorios dentales; aún no implementada)
- **Fecha:** 2026-10-07

## Contexto

Hoy todo mensaje de texto va directo a la IA. Para un consultorio dental eso es arriesgado y caro:

- Una urgencia («se me rompió un diente») no debe depender de que la IA la interprete bien.
- Lo clínico («¿es normal que sangre?») no debe responderlo una IA.
- Precios, horario y ubicación tienen una sola respuesta correcta; pasarlos por la IA gasta tokens y
  puede dar respuestas distintas cada vez.

## Decisión

Cada mensaje se revisa en este orden, y responde el primero que acierta:

1. Palabras de urgencia: aviso a la doctora y turno de urgencia.
2. Botón tocado (código exacto): respuesta del botón.
3. Reserva a medias (estado en Redis): siguiente paso.
4. Pregunta clínica, foto o queja: aviso a la doctora; el bot no opina.
5. Mensaje corto con palabra clave: respuesta fija.
6. Todo lo demás: la IA, con las herramientas de agenda. Si no puede resolverlo, pasa a la doctora.

Además, se agrega una **segunda entrada programada** para los recordatorios de cita.

El diseño completo está en [eli-dental.md](../eli-dental.md).

## Consecuencias

- Respuestas predecibles en lo crítico, y menos llamadas a la IA.
- Hay que mantener listas de palabras clave y plantillas aprobadas por Meta.
- El nodo *Normalizar mensaje* debe leer también las respuestas de botones, no solo el texto.
