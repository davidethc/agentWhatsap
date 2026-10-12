# ADR 0008: El Eli Panel vive en un proyecto de Supabase aparte y Eli le escribe con eventos sin esperar

- **Estado:** Aceptada (Plan aprobado el 2026-10-10)
- **Fecha:** 2026-10-10

## Contexto

Eli (n8n) no guarda pacientes: el chat vive 24 h en Redis. El CRM necesita una base permanente, con
login, RLS y auditoría (datos de salud, LOPDP), y $0 en software. Eli está en producción y no puede
depender del CRM.

## Decisión

- Proyecto nuevo de **Supabase gratis** (`eli-crm`), separado del Postgres de n8n.
- Eli le escribe con **3 eventos** (`mensaje_entrante`, `mensaje_saliente`, `cita_reservada`) a la
  Edge Function `eli-evento`, protegida con un secreto. n8n la llama desde un sub-workflow
  (`Eli → CRM`) con **Execute Workflow sin esperar**, con timeout, reintentos y registro del error.
- Cada evento es idempotente (`message_id`, `execution_id`, `gcal_event_id`).

## Opciones descartadas

- **Usar el Postgres de n8n:** mezcla datos de salud con los de n8n, sin login ni RLS para el panel,
  y depende de la Mac.
- **n8n escribe directo con la clave de servicio:** le da a n8n acceso total a la base; con la función
  y el secreto, n8n solo puede enviar eventos.
- **Llamada síncrona desde `version4`:** si el CRM se cae, Eli tarda o falla.

## Consecuencias

- Mover y cancelar de Eli no envían evento: llegan por la sincronización con Calendar (ADR 0009).
- Plan gratis: se pausa tras 7 días sin uso y no tiene copias descargables (ver `scripts/backup-crm.sh`).
