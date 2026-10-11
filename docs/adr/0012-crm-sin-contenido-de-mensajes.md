# ADR 0012: El CRM no guarda ni muestra el contenido de los mensajes

- **Estado:** Aceptada (decisión del usuario, 2026-10-11, TK-41). Reemplaza en parte el contrato de
  [ADR 0008](0008-crm-supabase-eventos.md): los eventos de Eli ya no llevan `texto`.
- **Fecha:** 2026-10-11

## Contexto

El plan original (aprobado el 10-oct-2026) guardaba en Supabase cada mensaje de WhatsApp, entrante y
saliente, para que la doctora leyera la conversación en la ficha (HU-7, TK-31). Lo que un paciente le
escribe a Eli puede incluir **datos de salud** (síntomas, alergias, embarazo, miedos). Ese contenido ya
vive en Kapso y en el estado de conversación de Eli; copiarlo al CRM duplica datos sensibles en otro
sistema, con otras personas y otras copias de seguridad (`scripts/backup-crm.sh`), sin que el
embudo lo necesite.

## Decisión

Por ahora el CRM **no guarda ni muestra el contenido de los mensajes**. Sí sigue registrando que
**hubo** mensaje: quién (la conversación), la dirección (entrante o saliente) y cuándo. Con eso se
mantienen todas las reglas del embudo (Nuevo → Conversando con el 2.º mensaje, 24 h sin respuesta,
reactivación) y la deduplicación por `id_externo`.

- **Contrato Eli → CRM:** `mensaje_entrante` y `mensaje_saliente` ya no llevan `texto`. n8n no lo
  envía y `eli-evento` lo rechaza o lo ignora.
- **Base de datos:** la tabla `mensajes` queda sin la columna `texto`. El texto ya guardado (incluido el
  de las pruebas y el seed) se elimina con la migración.
- **Panel:** HU-7 «Leer la conversación con Eli» y **TK-31 quedan pospuestas** (Backlog). La ficha no
  muestra conversación.

## Consecuencias

- Menos datos de salud en el CRM, en sus copias de seguridad y en Realtime.
- La doctora no ve en el panel lo que el paciente dijo; si lo necesita, lo consulta en WhatsApp/Kapso.
- La tabla `mensajes` ya no sirve para entender qué quiere el paciente, solo para el embudo.
- Menos superficie en RLS y en `errores_integracion` (no se guarda texto ahí tampoco).
- El texto borrado **no se puede recuperar** desde el CRM.

## Cómo volver atrás

1. Migración nueva: `alter table public.mensajes add column texto text;` (con RLS igual que el resto
   de la tabla).
2. Contrato: volver a enviar `texto` en `mensaje_entrante` y `mensaje_saliente` (nodos «CRM: armar…»
   de `version4` y validación de `eli-evento`).
3. Panel: retomar TK-31 y la HU-7 (pasarla de «Pospuesta» a «Must»).
4. Avisar a la doctora y decidir la retención del texto (cuánto tiempo se guarda). Los mensajes
   anteriores al cambio **no se rellenan**: solo se guardarán desde ese día.
