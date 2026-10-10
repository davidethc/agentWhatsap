# ADR 0011: Las reglas del embudo viven en funciones de la base de datos

- **Estado:** Aceptada (Plan aprobado el 2026-10-10)
- **Fecha:** 2026-10-10

## Contexto

La etapa de un paciente cambia desde cuatro lugares: Eli (mensajes y reservas), el panel (arrastrar,
marcar asistencia, crear citas), la sincronización con Calendar y la tarea de las 24 h. Si cada uno
aplica las reglas por su cuenta, terminan diferentes.

## Decisión

Las reglas (Nuevo → Conversando con el 2.º mensaje, cita → Agendó, Asistió → Seguimiento + retorno,
No asistió → Perdido, 24 h sin respuesta → Perdido, reactivación) viven en **funciones de Postgres**
(`registrar_evento_eli`, `mover_etapa`, `marcar_asistencia`, `guardar_cita`,
`perdidos_por_silencio`). Todos los caminos las llaman y cada cambio queda en `cambios_etapa` y en
la auditoría.

## Consecuencias

- El panel no actualiza `pacientes.etapa` directamente. En el frontend, `lib/dominio` solo tiene
  etiquetas y formatos.
- Las reglas se prueban con pgTAP en `supabase/tests/`.
