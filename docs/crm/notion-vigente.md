# Notion: enmiendas vigentes del hub y secciones 00–06

Fecha de sincronización: 2026-10-16. Relectura tras escritura; historial preservado en Notion.

## 🦷 Eli Panel — SDD Hub

[Fuente](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112?pvs=204)

## Dirección vigente — 2026-10-16
Continuamos **crm-v2-diseno** con **Codex y tmux**. Conversaciones e intervención de doctora con acceso restringido; permisos, conservación y eliminación se definirán antes de activar. El primer CRM y TK-1–41 se conservan como historial: sus Done no certifican el nuevo.
La coordinación está en implementación y validación sintética. Máximo coordinador + tres trabajadores, apoyos incluidos. Solo el coordinador actualiza este tablero. Código, pruebas locales y producción se registran por separado. Espejo vigente: docs/crm/transicion-v2.md y ADR 0013.
**Las tablas y comandos siguientes son históricos.**


## 🧭 00 · Cómo trabajamos (SDD vs backlog)

[Fuente](https://app.notion.com/p/3f55445f5f868125915bd75ab637f9d1?pvs=204)

## Método vigente — 2026-10-16
SDD se mantiene: especificación → aclaraciones → plan → tareas → implementación → revisión independiente → pruebas. Se continúa crm-v2-diseno. Ready exige alcance y aceptación; Done exige pruebas del commit integrado. Solo el coordinador escribe el tablero.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## 📜 01 · Constitución

[Fuente](https://app.notion.com/p/3f55445f5f8681d19d40cbb31fe22d37?pvs=204)

## Constitución vigente — 2026-10-16
Codex y tmux sustituyen el equipo anterior. Coordinador + hasta tres trabajadores, apoyos incluidos, un nivel adicional. Worktrees feat/crm-\*, integración secuencial en feat/crm. Sin push, gastos nuevos ni datos reales en pruebas. Aplicar permisos de servidor al stack real PostgreSQL/Drizzle/Better Auth; no dar por heredada la protección Supabase.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## 🎯 02 · Spec (aprobada)

[Fuente](https://app.notion.com/p/3f55445f5f8681c4bd1cd7a88eb14cef?pvs=204)

## Alcance vigente del CRM nuevo — 2026-10-16
Conversaciones e intervención de doctora con acceso restringido entran en el alcance de crm-v2-diseno. Esto sustituye el aplazamiento anterior para el nuevo producto. Antes de activar: definir permisos, conservación, eliminación y pausa que n8n respete. No se traslada la aprobación del primer CRM; cada línea tendrá especificación propia.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## ❓ 03 · Clarificaciones y decisiones

[Fuente](https://app.notion.com/p/3f55445f5f868182ba62cd08100e939b?pvs=204)

## Decisión aprobada: CRM nuevo y conversaciones — 2026-10-16
Continuar crm-v2-diseno, Codex por tarea y ventanas tmux. La decisión reemplaza ADR 0012 para el CRM nuevo (ADR 0013 local). Conservación y eliminación aún por definir; no se activan mensajes por esta actualización. Eli/n8n y Google Calendar siguen como referencia inicial; Gemini y conversación natural no cambian.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## 🏗️ 04 · Plan técnico

[Fuente](https://app.notion.com/p/3f55445f5f8681dd9e5dd5c29d8c1548?pvs=204)

## Plan de transición vigente — 2026-10-16
Stack nuevo observado: Next.js, PostgreSQL, Drizzle, Better Auth. Orden: privacidad/bandeja → agenda única → integración fiable → operación permanente → funciones doctora → piloto conectado. Cada línea requiere especificación antes de implementar. Evidencia separada: código existente, pruebas locales, producción. TK-1–41 se conservan y se relacionan con el nuevo alcance, sin heredar Done.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## 🤖 05 · Agentes, skills y prompts

[Fuente](https://app.notion.com/p/3f55445f5f86818fb454c4fa8d44319b?pvs=204)

## Equipo Codex/tmux vigente — 2026-10-16
Roles .Codex/agents/\*.toml: planificador y orquestador gpt-6-astra; datos, frontend, n8n, QA y operaciones gpt-6.1-sol; apoyo documental gpt-6-luna. Verificar catálogo y aceptación real del servicio. scripts/[crm-agents.py](http://crm-agents.py) sustituye los comandos de agentes anteriores; codex exec no usa --agent. Cada ejecución tiene ventana visible, tarea, padre, modelo, rama, worktree, panel, sesión e informe persistente. Solo coordinador escribe Notion. Skills locales verificadas; no instalar paquetes masivos.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**


## 🔀 06 · Flujos

[Fuente](https://app.notion.com/p/3f55445f5f8681dcb17dc05c96082d1f?pvs=204)

## Flujo vigente — 2026-10-16
Ready → In progress → In review → Testing → Done, con evidencia independiente antes de integrar. Sesión eli-crm; coordinador externo y hasta tres trabajadores, incluidos apoyos. Un nivel adicional. Cerrar ventana no es entregar: recuperar mediante UUID explícito y registro de intentos. El piloto futuro cubrirá mensaje, paciente, respuesta, reserva, reprogramación, cancelación e intervención; no se declara conectado por pruebas locales.
**El contenido siguiente se conserva como historial del primer CRM; no es aprobación del CRM nuevo.**



