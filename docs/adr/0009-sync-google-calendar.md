# ADR 0009: Google Calendar se sincroniza desde Supabase con una cuenta de servicio; ante un conflicto gana Calendar

- **Estado:** Aceptada (Plan aprobado el 2026-10-10)
- **Fecha:** 2026-10-10

## Contexto

La Spec pide citas creadas en el panel que lleguen a Google Calendar, y cambios hechos en Calendar
(por la doctora o por Eli) que lleguen al panel. Eli ya usa Calendar como su agenda.

## Decisión

- Un solo módulo, la Edge Function `calendario` en Supabase, con una **cuenta de servicio** de Google.
  La doctora comparte su calendario con ella.
- **Push:** al guardar una cita, `pg_net` llama a la función, que crea o modifica el evento
  (`extendedProperties.private.crm_cita_id`).
- **Pull:** cada 2 min, con `pg_cron`, una lectura incremental con `syncToken`; los eventos borrados
  pasan a **Cancelada**.
- **Conflicto:** el push usa `If-Match` con el etag; si Calendar cambió, **gana Calendar** y se
  registra en `errores_integracion`.

## Opciones descartadas

- **Sincronizar desde n8n:** reutiliza credenciales, pero depende de la Mac encendida, y las citas del
  panel no llegarían a Calendar (riesgo de doble reserva).
- **Llamar a Google desde el panel (Netlify):** reparte la lógica de Calendar en dos lugares.
- **Notificaciones push de Google (`watch`):** necesitan renovar canales; con 2 min alcanza.

## Consecuencias

- Hasta 2 min de atraso para lo que se cambia en Calendar.
- Los eventos creados a mano en Calendar quedan como citas **sin vincular** hasta que la doctora las
  liga a un paciente.
- La descripción del evento no lleva datos clínicos.
