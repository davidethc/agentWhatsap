# Eli Panel (CRM de EliDental)

CRM propio de EliDental: resumen del día, kanban de pacientes (como Kommo), ficha del paciente
y citas sincronizadas con Google Calendar. Se construye con **SDD (Spec-Driven Development)**.

**Fuente de verdad:** el hub de Notion [«Eli Panel — SDD Hub»](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112).
Esta carpeta es su espejo: cada documento se copia aquí cuando el usuario lo aprueba.

| Documento | Estado |
|---|---|
| [constitution.md](constitution.md) | Escrita (10-oct-2026) |
| [spec.md](spec.md) | Aprobada (10-oct-2026): 14 historias |
| [plan.md](plan.md) | Aprobado (10-oct-2026): arquitectura, datos, contrato Eli → CRM, Calendar, pantallas |
| [tasks.md](tasks.md) | Aprobadas (10-oct-2026): TK-1 a TK-40 en Ready |
| `integracion.md` | La escribe el orquestador durante la construcción |
| [qa.md](qa.md) | Informe de QA por tarea (ronda 1: TK-1 a TK-11, TK-14, TK-21 y TK-22; ronda 2: TK-13, TK-18, TK-19 y TK-23; ronda 3: TK-24, TK-27, TK-29, TK-32, TK-33 y TK-41; ronda 4: TK-25, TK-26, TK-28, TK-30 y TK-34; ronda 5: TK-36, TK-37 y TK-39) |
| [backup-crm.md](backup-crm.md) | Copia semanal de la base con `scripts/backup-crm.sh` y cómo restaurar (TK-13) |
| [tk-12-proyecto-remoto.md](tk-12-proyecto-remoto.md) | Paso a paso para crear `eli-crm` en la nube (✋ espera aprobación) |

## Agentes (`.claude/agents/`)

| Agente | Modelo | Rama / worktree | Para qué |
|---|---|---|---|
| `crm-planificador` | opus | `feat/crm` | Preguntas, Spec, Plan y Tareas en Notion. No programa |
| `crm-orquestador` | opus | `feat/crm` | Líder: abre un panel de herdr por agente, revisa, integra y actualiza Notion |
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

# Fase B: construir (un panel de herdr por agente)
# En herdr, en una pestaña nueva con la carpeta /Users/d/agentWhatsap-crm:
claude --agent crm-orquestador
#   el orquestador abre los paneles datos, frontend, n8n y qa con `herdr agent start`
#   ✋ apruebas antes de tocar Eli en producción

# Al final (tú): pasar feat/crm a main y hacer git push
```

## Configuración

- `CLAUDE.md`: reglas para todas las sesiones.
- `.claude/settings.json`: comandos bloqueados (`git push`, `reset --hard`, `rebase`, `branch -D`,
  cambiar a `main` y leer `.env`).
- Carpetas: `/Users/d/agentWhatsap` = `main` (Eli y otras sesiones); `/Users/d/agentWhatsap-crm` =
  worktree de `feat/crm` (planificador y orquestador); `/Users/d/agentWhatsap-crm-<agente>` =
  worktree de cada agente.
- `.claude/skills/` → `.agents/skills/` + `skills-lock.json`: skills de skills.sh
  (`mattpocock/skills`, `obra/superpowers`, `vercel-labs/agent-skills`), revisadas antes de
  instalarlas. Para reinstalarlas: `npx skills experimental_install`.
