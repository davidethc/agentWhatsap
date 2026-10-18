# Construcción primera entrega — plan de ejecución

Objetivo: implementar la [especificación aprobada](privacidad.md) reutilizando crm-v2-diseno.

Arquitectura: conservar src/server para dominio existente, src/lib para auth/persistencia y src/components/inbox para UI. PostgreSQL + Drizzle + Better Auth; ningún sistema paralelo Supabase.

## Base verificada

Commit inicial feat/crm: c2d05a8. pnpm lint PASS; pnpm test PASS (91 archivos, 1026 tests); pnpm build PASS; pnpm typecheck PASS al repetirse después del build. Primer typecheck falló TS6053 al correr simultáneo con Next regenerando .next/types: interferencia de la ejecución, no fallo previo confirmado. Advertencias Vite por imports dinámicos en version.test.ts.

Versiones exactas pnpm-lock.yaml: Next 15.5.27, React/React DOM 19.2.7, Better Auth 1.6.23, Drizzle ORM 0.38.4, Drizzle Kit 0.30.6, postgres.js 3.4.9, TypeScript 5.9.3, Zod 3.25.76, Vitest 2.1.9, Playwright 1.61.1. Sin actualizaciones automáticas.

Referencias oficiales consultadas: [Next 15](https://nextjs.org/docs/15/app/getting-started/server-and-client-components), [sesiones Better Auth](https://better-auth.com/docs/concepts/session-management), [transacciones](https://orm.drizzle.team/docs/transactions) y [migraciones Drizzle](https://orm.drizzle.team/docs/migrations). Las páginas evolutivas no sustituyen las firmas instaladas; compilación y pruebas comprobarán compatibilidad.

## Encargos y contratos

- [ ] Datos, gpt-6.1-sol, feat/crm-privacidad: schema/migración, auth, backend inbox/bot/SSE/media, retención/purga durable y fencing. Posee src/server, src/lib, src/app/api, instrumentación y pruebas backend.
- [ ] Frontend, gpt-6.1-sol, feat/crm-bandeja: componentes/página inbox, confirmación accesible, estados y pruebas UI. PATCH conversación aiEnabled false/true; DELETE misma ruta 202; 403 sin permiso, 404 contenido no disponible.
- [ ] Integración, gpt-6.1-sol, feat/crm-prueba-local: arnés ficticio y copia de flujo inactiva; diagnóstico de servicios y procedimiento de arranque.
- [ ] QA independiente al liberarse cupo: casos negativos y revisión antes de integrar; coordinador resuelve hallazgos y verifica versión integrada.
- [ ] Coordinación: documentación/Notion, migración aislada, recorrido UI y API, commits locales.
- [ ] Operación final solicitada: Docker/n8n/panel/ngrok y comprobaciones para prueba WhatsApp del usuario.

Máximo coordinador y tres especialistas. Worktrees separados creados desde c2d05a8. Esta sesión carece de HERDR_ENV: la skill herdr prohíbe controlar Herdr desde fuera. Especialistas visibles en la conversación; no se afirma haber creado paneles Herdr. Modelos según .Codex/agents. Ningún especialista escribe Notion ni integra ramas ajenas.

## Riesgos que revisará QA

Revocación con SSE abierto; volver a Eli no revalida respuestas antiguas; llegada tardía de medios no recrea archivos eliminados; nueva actividad no revive historial caducado; contenido indirecto en preview, errores/logs, despacho o medios huérfanos.
