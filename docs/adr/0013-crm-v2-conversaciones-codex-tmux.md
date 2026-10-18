# ADR 0013: CRM nuevo, conversaciones restringidas y Codex/tmux

- Fecha: 2026-10-16.
- Estado: aceptada como dirección del proyecto por el plan del usuario. Activación de mensajes pendiente de especificación y verificación.
- Sustituye ADR 0012 para crm-v2-diseno; no modifica por sí sola el contrato legado ni Eli productiva.

## Decisión

Continuar crm-v2-diseno. La doctora podrá ver conversaciones e intervenir con acceso restringido. Antes de activar: definir usuarios y permisos de lectura, envío, exportación y eliminación; duración de conservación; borrado de adjuntos y copias; auditoría, revocación y pausa que Eli/n8n respete. No se ha elegido un plazo de conservación ni se da por implementada esta protección. Los mensajes antiguos eliminados no se recuperan.

La agenda inicial sigue referenciada a Eli/n8n y Google Calendar. No activar un segundo motor de respuestas o reservas sin contrato y pruebas. Se conserva Gemini y la conversación natural.

Coordinación con Codex y tmux; coordinador y hasta tres trabajadores, incluidos apoyos. Un nivel adicional de delegación. Los informes y commits son memoria persistente; tmux permite observar. Solo el coordinador escribe Notion. Revisión independiente antes de integrar.

## Consecuencias

TK-1–41 se conservan como historial, sin otorgar aprobación al producto nuevo. Separar código existente, pruebas locales y comprobación en producción. Software sin gastos nuevos. No activar conversaciones mientras privacidad, permisos, conservación y eliminación sigan sin aceptación. Ver [transición](../crm/transicion-v2.md).
