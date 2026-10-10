# Constitución del Eli Panel

> Espejo de la página «01 · Constitución» del [hub de Notion](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112).
> Escrita el 10-oct-2026. Vale para **todas** las sesiones y agentes. Las reglas de git y de `.env`
> están bloqueadas también en `.claude/settings.json`.

## Trabajo
1. Español, claro y corto.
2. **Antes de lanzar un agente, una sesión o un comando que cambie algo, se muestra qué se lanza**
   (nombre, prompt o comando, y para qué).
3. Verificar antes de afirmar. Si algo falló o se saltó, se dice tal cual.
4. Si algo no está en la Spec o el Plan, se pregunta; no se inventa.
5. Todo documentado: `docs/`, README, GUIA, CHANGELOG y ADR.

## Git
1. Commits locales pequeños, con el ID de la tarea: `feat(db): … [TK-12]`.
2. **Nunca `git push`.** El push lo hace el usuario.
3. Nunca `reset --hard`, `rebase`, `push --force`, borrar ramas ni cambiar a `main`.
4. Ramas: `feat/crm-<agente>` → el orquestador las une en `feat/crm` → el usuario las pasa a `main`.

## Eli en producción
1. Antes de tocar `version4`: `scripts/backup.sh`, probar en una copia y `scripts/check.sh`.
2. El `version4` real se toca solo con la aprobación (✋) del usuario.
3. Si el CRM falla, **Eli sigue respondiendo**.
4. No se cambia el modelo de Gemini ni la conversación natural (ADR 0006).

## Datos y seguridad
1. Datos de pacientes = **datos de salud** (LOPDP Ecuador). Nunca datos reales en pruebas, docs,
   Notion ni logs.
2. RLS en todas las tablas y auditoría de cambios.
3. Los secretos solo van en `.env` y en las variables de Supabase, Vercel y n8n.

## Costos
1. **$0 en software.** Si algo pide tarjeta o tiene un límite que afecte el uso real, se avisa antes.
