# Eli Panel — SDD

El producto vigente es **crm-v2-diseno**. [Notion](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112) es fuente de verdad; esta carpeta conserva espejo e historial.

- [Decisiones, tareas y límites](transicion-v2.md).
- [Enmiendas Notion 00–06](notion-vigente.md) y [foto del tablero](tablero-notion.md).
- [Lanzador Codex/tmux](orquestacion-cli.md): iniciar, estado, recuperar y detener. Roles en .Codex/agents/*.toml.
- [Auditoría y relación con el alcance nuevo](auditoria-transicion.md).
- [Evidencia de orquestación](orquestacion-qa.md) y [revisión final](orquestacion-qa-final.md).
- [Plantilla de encargo](encargo-template.md).
- [ADR 0013](../adr/0013-crm-v2-conversaciones-codex-tmux.md).

constitution.md, spec.md, plan.md, tasks.md, qa.md y guías anteriores conservan el primer CRM (crm/, Supabase). Sus Done no certifican el producto nuevo. Conversaciones e intervención están aprobadas como dirección; permisos, conservación y eliminación se definen antes de activar.

Trabajo en /Users/d/agentWhatsap-crm, rama feat/crm; especialistas en worktrees y ramas feat/crm-*. Máximo coordinador + tres trabajadores, apoyos incluidos, un nivel adicional. Solo el coordinador escribe Notion e integra después de revisión independiente. Informes y commits persistentes; sin push.

Para observar: tmux attach -t eli-crm. Los workers usan codex exec; consultar la guía para intervenir y recuperar. Nunca introducir datos de pacientes en prompts ni logs.
