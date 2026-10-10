# Eli (agentWhatsap): reglas para Claude Code

Eli es la asistente de WhatsApp de EliDental (n8n en Docker + Kapso + Gemini + Google Calendar). Está
**en producción**. Arquitectura: `docs/arquitectura.md`.

## Siempre
- Responde en **español**, claro y corto. El usuario escribe rápido y con errores de tipeo.
- **Antes de lanzar un agente, una sesión o un comando que cambie algo, muestra qué vas a lanzar**:
  el nombre, el prompt o el comando, y para qué.
- Verifica antes de decir que algo funciona. Si algo falló o se saltó, dilo tal cual.
- Todo documentado: `docs/`, README, GUIA y CHANGELOG al día después de cada cambio.

## Git
- Commits locales pequeños. **Nunca `git push`**: lo hace el usuario con `! git push`.
- No reescribas la historia (`reset --hard`, `rebase`, `push --force`) ni borres ramas.
- El trabajo del CRM va en `feat/crm` (y en las ramas `feat/crm-*` de cada agente), **nunca en `main`**.

## Eli en producción
- Antes de tocar `workflows/eli-version4.json` o el workflow en n8n: `scripts/backup.sh`. Prueba en una
  copia y verifica con `scripts/check.sh`. Exporta con `scripts/export-workflow.sh`.
- No cambies el modelo de Gemini ni la conversación natural (`docs/adr/0006-conversacion-natural.md`).

## Seguridad
- Los secretos solo van en `.env` (nunca en git ni dentro de los JSON de los workflows).
- Datos de pacientes = datos de salud: nunca uses datos reales en pruebas, docs, Notion ni logs.
- $0 en software: si algo pide tarjeta o tiene un límite que afecte el uso real, avisa antes.

## CRM «Eli Panel» (SDD)
- La fuente de verdad es Notion, en el hub «Eli Panel — SDD Hub» (https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112). El espejo está en
  `docs/crm/`.
- Agentes en `.claude/agents/`: `crm-planificador` → `crm-orquestador` → `crm-datos`,
  `crm-frontend`, `crm-n8n` y `crm-qa-docs`. Cómo se trabaja: `docs/crm/README.md`.
