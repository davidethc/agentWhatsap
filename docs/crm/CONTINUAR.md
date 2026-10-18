# Continuar el CRM (Eli Panel) más adelante

Estado al 2026-10-18: el CRM se **pausó** y se guardó completo en esta rama (`version-crm`). `main` es Eli
sin CRM. No se borró nada: ni la base de Supabase ni el despliegue.

## Qué hay aquí
- `crm/` Eli Panel (Next.js + Supabase) y `crm-v2-diseno/` diseño v2 portado.
- `supabase/` y `crm/` migraciones; `workflows/eli-crm.json` y `workflows/pruebas/eli-version4-crm-copia.json`
  para conectar Eli con el panel.
- `docs/crm/` Spec, Plan, Tareas, QA, operación, privacidad y relevos (empieza por [README.md](README.md)).
- `.claude/agents/` los agentes `crm-*` (planificador → orquestador → datos, frontend, n8n, qa-docs).
- Rama de Flow de Meta (`flows/`) ya unida aquí.

## Para retomarlo
1. `git clone` del repo y `git switch version-crm`.
2. Sigue [docs/recuperacion.md](../recuperacion.md) para el `.env` y Docker.
3. Lee [operacion.md](operacion.md) (arrancar, migraciones, copias) y [tasks.md](tasks.md) (qué faltaba).
4. Crea o reutiliza el proyecto de Supabase ([tk-12-proyecto-remoto.md](tk-12-proyecto-remoto.md)) y
   aplica las migraciones.
5. Antes de conectar Eli real: [integracion-version4.md](integracion-version4.md) y
   [privacidad en workflows/README.md](../../workflows/README.md). El CRM no guarda el texto de los mensajes.

## Pendiente conocido
- Conectar el CRM al `version4` real y a Google Calendar ([google-calendar.md](google-calendar.md)).
- Notion «Eli Panel — SDD Hub» sigue siendo la fuente de verdad del SDD; `docs/crm/` es el espejo.
