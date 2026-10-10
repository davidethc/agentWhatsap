# Eli Panel (CRM de EliDental)

CRM propio de EliDental: resumen del día, kanban de pacientes (como Kommo), ficha con la conversación
con Eli y citas sincronizadas con Google Calendar. Se construye con **SDD (Spec-Driven Development)**.

**Fuente de verdad:** el hub de Notion [«Eli Panel — SDD Hub»](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112).
Esta carpeta es su espejo: cada documento se copia aquí cuando el usuario lo aprueba.

| Documento | Estado |
|---|---|
| [constitution.md](constitution.md) | Escrita (10-oct-2026) |
| `spec.md` | Pendiente: se copia al aprobar la Spec |
| `plan.md` | Pendiente: se copia al aprobar el Plan |
| `tasks.md` | Pendiente: se copia al aprobar las Tareas |
| `integracion.md` | La escribe el orquestador durante la construcción |

## Agentes (`.claude/agents/`)

| Agente | Modelo | Rama / worktree | Para qué |
|---|---|---|---|
| `crm-planificador` | opus | `feat/crm` | Preguntas, Spec, Plan y Tareas en Notion. No programa |
| `crm-orquestador` | opus | `feat/crm` | Líder: lanza compañeros, revisa, integra y actualiza Notion |
| `crm-datos` | opus | `feat/crm-datos` · `../agentWhatsap-crm-datos` | Supabase: tablas, RLS, auditoría, login |
| `crm-frontend` | sonnet | `feat/crm-frontend` · `../agentWhatsap-crm-frontend` | Next.js: resumen, kanban, ficha, citas |
| `crm-n8n` | sonnet | `feat/crm-n8n` · `../agentWhatsap-crm-n8n` | Eli → CRM y Google Calendar, sin romper Eli |
| `crm-qa-docs` | sonnet | `feat/crm-docs` · `../agentWhatsap-crm-docs` | Pruebas con evidencia y documentación |

Para verlos en Claude Code: `/agents`.

## Cómo se trabaja

```bash
# Fase A: planear (una terminal)
claude --agent crm-planificador
#   ✋ apruebas la Spec  →  ✋ apruebas el Plan + Tareas

# Fase B: construir (un panel de tmux por agente)
tmux new -s eli-crm
claude --agent crm-orquestador --teammate-mode tmux
#   ✋ apruebas antes de tocar Eli en producción

# Al final (tú): pasar feat/crm a main y hacer git push
```

## Configuración

- `CLAUDE.md`: reglas para todas las sesiones.
- `.claude/settings.json`: equipos de agentes activados (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`,
  `teammateMode: tmux`) y comandos bloqueados (`git push`, `reset --hard`, `rebase`, `branch -D`,
  cambiar a `main` y leer `.env`).
- `.claude/skills/` → `.agents/skills/` + `skills-lock.json`: skills de skills.sh
  (`mattpocock/skills`, `obra/superpowers`, `vercel-labs/agent-skills`), revisadas antes de
  instalarlas. Para reinstalarlas: `npx skills experimental_install`.
