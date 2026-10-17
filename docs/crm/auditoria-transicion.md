# Auditoría de transición: Eli Panel → `crm-v2-diseno`

Fecha: 2026-10-16 · Tarea: ORQ-02

## Propósito y regla de lectura

Esta auditoría cruza las 41 tareas del plan aprobado de [tasks.md](tasks.md) y la evidencia consignada en [qa.md](qa.md) y [backup-crm.md](backup-crm.md) con el repositorio `crm-v2-diseno/`. Clasifica intención y evidencia, no certifica equivalencia funcional ni una migración de datos. Los nombres parecidos no bastan: la relación indicada abajo se apoya en rutas, módulos y esquema inspeccionados.

- **Reutilizable**: hay un concepto o pieza de implementación del diseño nuevo que puede servir como base dentro del alcance nuevo. Debe adaptarse y verificarse para Eli/la doctora.
- **Pendiente de verificar**: hay una intención relacionada, o evidencia histórica local, pero no alcanza para decidir que cubra el criterio nuevo. Requiere análisis o prueba dirigida antes de darlo por cubierto.
- **Sustituido**: la solución o criterio anterior queda fuera del alcance nuevo, o una decisión posterior la reemplazó. No implica que la necesidad de negocio desaparezca.

El alcance aprobado incluye privacidad/bandeja, agenda única, integración fiable, operación permanente, funciones de la doctora y piloto completo. Esta entrega solo prepara coordinación y planificación; no elimina necesidades clínicas por cambiar de implementación. No autoriza importar pacientes ni activar servicios. El informe no accedió a secretos o datos reales ni ejecutó pruebas del producto. Las menciones a pruebas son evidencia histórica atribuida, no verificación actual.

## Matriz de trazabilidad TK-1 a TK-41

| TK | Clasificación | Relación con `crm-v2-diseno` y justificación |
|---|---|---|
| TK-1 | Pendiente de verificar | El CRM nuevo usa PostgreSQL autocontenido (`docker-compose.yml`, `drizzle.config.ts`), no Supabase CLI. Auth y restricciones deben verificarse en su propio runtime; la inicialización Supabase no se traslada. |
| TK-2 | Pendiente de verificar | El dominio nuevo tiene organizaciones, contactos y conversaciones en `src/lib/db/schema.ts`; no es el modelo de pacientes/datos clínicos con RLS. No trasladar datos de salud ni asumir aislamiento equivalente. |
| TK-3 | Pendiente de verificar | Hay tablas de mensajes/citas y una outbox de despacho en Drizzle, pero no el conjunto de tablas, políticas Supabase, publicación Realtime y sync del plan anterior. Verificar los criterios de conversación/handoff pertinentes. |
| TK-4 | Pendiente de verificar | Auditoría y consentimiento requieren nueva especificación de privacidad V2-01. No inferir protección equivalente ni eliminar la necesidad clínica. |
| TK-5 | Pendiente de verificar | Las reglas de etapas/asistencia requieren contraste con el dominio nuevo y funciones doctora V2-05; no trasladar automáticamente las funciones SQL. |
| TK-6 | Pendiente de verificar | Pacientes, duplicados y reglas de citas requieren contrato nuevo en V2-02/V2-03 y pruebas de concurrencia; agenda existente no acredita equivalencia. |
| TK-7 | Pendiente de verificar | El diseño nuevo ingiere y persiste mensajes por webhooks (`src/server/inbox/ingest.ts`, `webhook.ts`) y maneja conversación/contacto; contrato e idempotencia difieren de `registrar_evento_eli`. Verificar el canal y caso de uso acotado. |
| TK-8 | Sustituido | La Edge Function `eli-evento` con secreto y payload de Eli no es la entrada del nuevo sistema. Usa rutas públicas tokenizadas de webhook de WhatsApp/Instagram/Messenger. |
| TK-9 | Pendiente de verificar | La automatización por silencio se debe conciliar con el alcance de funciones doctora V2-05; worker nuevo no acredita la política histórica. |
| TK-10 | Pendiente de verificar | Resumen diario entra en V2-05. Conservar cumpleaños/retornos como requisitos históricos a conciliar, sin descartarlos ni darlos por implementados. |
| TK-11 | Sustituido | Seed y tipos generados para Supabase pertenecen al proyecto anterior. El nuevo diseño tiene esquema Drizzle, migraciones y demo propios; no copiar datos del seed Eli. |
| TK-12 | Sustituido | Proyecto remoto `eli-crm`, migraciones y secretos Supabase no son infraestructura del nuevo producto. No se consultó ni modificó el proyecto remoto. |
| TK-13 | Pendiente de verificar | La política de backup puede ser útil como requisito operativo, pero `backup-crm.sh` respalda Supabase y `backup-crm.md` solo documenta simulacro local, no restauración remota. El despliegue Postgres/Docker del nuevo CRM requiere plan propio; no se comprobó backup/restauración en `crm-v2-diseno`. |
| TK-14 | Pendiente de verificar | Google Calendar sigue como referencia inicial en V2-02. Credenciales y calendario de prueba anteriores requieren comprobar aplicabilidad sin consultar secretos. |
| TK-15 | Pendiente de verificar | Agenda única V2-02 debe conciliar escrituras desde panel/Eli con Calendar. El conector nuevo no acredita compatibilidad ni evita reservas duplicadas. |
| TK-16 | Pendiente de verificar | V2-02 debe especificar cambios externos, cancelación y reconciliación; el pull legado no certifica la implementación nueva. |
| TK-17 | Sustituido | Trigger `pg_net`, cron de dos minutos y política de conflicto/etag dependen de Supabase. No equivalen a workers internos del CRM nuevo. |
| TK-18 | Sustituido | Sub-workflow n8n Eli→CRM depende del endpoint de Supabase anterior. El producto nuevo recibe webhooks y puede despachar a un cerebro externo mediante `src/server/dispatch/`; no utiliza ese workflow. |
| TK-19 | Pendiente de verificar | La metodología de copia y arnés puede servir para V2-03/V2-06, pero debe adaptarse al contrato nuevo. No certifica producción. |
| TK-20 | Sustituido | Aplicar cambios a `version4` real requería aprobación específica y no pertenece a este alcance. No se cambió ni se verificó producción. |
| TK-21 | Reutilizable | Esqueleto visual Next/TypeScript/Tailwind y criterios de responsive pueden inspirar la interfaz. La implementación nueva ya tiene Next 15/React 19 y UI propia; no es el scaffold clínico ni comparte componentes automáticamente. |
| TK-22 | Pendiente de verificar | El nuevo CRM usa Better Auth (`src/app/api/auth/[...all]/route.ts`, `src/lib/auth/`) con organización/miembros, distinto de Supabase Auth y su lista `personal`. Para acceso de la doctora hay que verificar roles y aislamiento en el entorno objetivo. |
| TK-23 | Pendiente de verificar | El anterior definía interfaz/adaptadores Supabase/falso. El nuevo usa acceso Drizzle en servidor; no comparte el contrato de datos. Se puede reutilizar la intención de aislar persistencia, no asumir el adaptador. |
| TK-24 | Pendiente de verificar | Asistencia, retornos y citas del día deben conciliarse con V2-05; no se excluyen por cambiar de CRM. |
| TK-25 | Pendiente de verificar | Resumen y métricas de doctora requieren criterios V2-05; analytics existente no prueba los números del consultorio. |
| TK-26 | Pendiente de verificar | Cumpleaños y retornos son requisitos históricos a conciliar en V2-05; no descartados por esta auditoría. |
| TK-27 | Pendiente de verificar | El embudo clínico requiere mapear etapas del nuevo pipeline antes de declarar paridad. |
| TK-28 | Reutilizable | Búsqueda/actualización viva son capacidades útiles para operar conversaciones. El nuevo producto tiene bandeja/SSE (`src/app/api/events/route.ts`, `src/server/inbox/queries.ts`); hay que verificar latencia, filtros y acceso para la doctora, no dar por equivalente el Realtime de Supabase. |
| TK-29 | Pendiente de verificar | Paciente, responsable y dependientes requieren decisión de dominio y permisos en V2-01/V2-03; contacto no equivale a paciente. |
| TK-30 | Pendiente de verificar | Datos clínicos y consentimiento requieren aclaración explícita en V2-01; esta auditoría no los excluye del producto ni autoriza copiarlos. |
| TK-31 | Sustituido | El criterio anterior de solo lectura y aplazamiento se sustituye por conversaciones e intervención restringida (ADR 0013/V2-01). No activar antes de definir permisos, conservación y eliminación. |
| TK-32 | Pendiente de verificar | Nuevo paciente, dependientes y deduplicación requieren conciliar dominio y pruebas; un contacto no acredita esa funcionalidad. |
| TK-33 | Pendiente de verificar | Crear, mover y cancelar citas forman parte de agenda única V2-02 y piloto V2-06; no se hereda la aprobación del CRUD anterior. |
| TK-34 | Pendiente de verificar | Agenda y vinculación a pacientes se especifican en V2-02; no hay prueba de equivalencia con vista del legado. |
| TK-35 | Sustituido | Publicar Eli Panel en Netlify era una decisión de hosting distinta. `crm-v2-diseno` documenta despliegue Docker/Coolify, compose y otros proveedores; no se publica nada en esta tarea. |
| TK-36 | Sustituido | QA HU-1 a HU-9 auditaba el panel Eli. `qa.md` reporta cierre con alcance, HU-7 pospuesta y HU-9 sin Calendar. Esa batería no valida `crm-v2-diseno`; esta tarea tampoco ejecuta tests del producto. |
| TK-37 | Pendiente de verificar | QA histórico reportó ejecución local del arnés sobre copia inactiva de version4 y CRM local, incluida caída simulada. No acredita webhooks, despacho, reintentos o continuidad en el sistema nuevo. Contratos relevantes: `specs/021-despacho-estandar/` y rutas webhook. |
| TK-38 | Pendiente de verificar | Calendar forma parte del plan nuevo V2-02/V2-06; QA histórico pendiente no acredita conectores nuevos. |
| TK-39 | Pendiente de verificar | QA anterior registró controles locales y cinco hallazgos S1–S5; no transferibles como certificación. En particular S-1 cabeceras, S-2 logout GET, S-3 contraseña mínima, S-4 teléfono en Redis y S-5 privilegios por defecto de `supabase_admin` necesitan decisión/evaluación propia en stack nuevo si son relevantes. |
| TK-40 | Sustituido | Documentación del primer CRM se conserva como historial. ORQ-02 actualiza SDD, README, GUIA y CHANGELOG para el nuevo producto. |
| TK-41 | Sustituido | ADR 0013 sustituye la decisión de no guardar texto para el CRM nuevo. El contrato legado no cambia por esta decisión; V2-01 exige permisos, conservación y eliminación antes de activar. |

## Cierres previos y límites de la evidencia

- **TK-13 — backup:** `qa.md` Ronda 2 dice expresamente “No probada la restauración” entonces. `backup-crm.md` registra después un simulacro de restauración en una base temporal/local, con sustitutos mínimos de objetos de plataforma y datos del seed; deja pendiente el backup contra `eli-crm` remoto. Por tanto, hay evidencia local del dump y de un simulacro parcial de restauración, **no** evidencia de backup ni restauración remotos/completos. Esta auditoría no repitió ninguno.
- **TK-36 — QA excluida:** el informe histórico lo cerró para HU-1 a HU-9 según evidencia local y revisión de código, con F-5 y HU-7 pospuesta (TK-41); se excluyó Calendar. Ese cierre no cubre el nuevo CRM. ORQ-02 no corre pruebas ni convierte dichas capturas en evidencia de producción.
- **TK-39 — hallazgos S1–S5:** el cierre histórico dice “pasa con 5 observaciones menores”. Quedan preservadas: S1 faltan cabeceras de seguridad y se expone `X-Powered-By`; S2 `GET /salir` cambia estado; S3 mínimo local de contraseña 6; S4 error Redis incluye teléfono/nombre; S5 objetos creados por `supabase_admin` heredan privilegios de `anon`. No se declara que estén corregidas en el Eli Panel ni que existan igual en el stack nuevo. Deben contrastarse con código/runtime nuevo si el alcance lo exige.
- **Producción vs local:** `qa.md` describe Supabase local, usuarios/seed inventados, `next start`, navegador/Playwright, consultas locales y un arnés n8n inactivo. Reporta explícitamente que TK-12 (proyecto remoto), lectura real de Calendar, aplicación a `version4` y Calendar QA no se completaron en esas rondas. Las frases de historial sobre “producción” en documentación del producto nuevo no constituyen verificación realizada por ORQ-02. No se accedió a producción ni se consultó Notion.

## Inventario observado de `crm-v2-diseno`

Este inventario es lectura estática del repositorio en el workspace. La existencia de código/rutas no prueba despliegue ni operación de esas funciones.

| Área | Stack o ubicación observada | Qué permite afirmar y qué no |
|---|---|---|
| Aplicación | Next.js 15, React 19, TypeScript; pnpm; Tailwind; configuración de Docker/Compose. `README.md`, `package.json`, `Dockerfile`, `docker-compose.yml`. | Es el stack declarado en el repositorio. No se hizo build ni se verificó una instancia activa. |
| Persistencia | PostgreSQL 16 + Drizzle ORM; `src/lib/db/schema.ts`, `drizzle/0000…0016*.sql`, `drizzle.config.ts`; `DATABASE_URL`, `DATABASE_SCHEMA` opcional. | Esquema con organización, usuarios/sesiones, contactos, conversaciones, mensajes, leads, agenda y dispatch. No existe equivalencia directa demostrada con las tablas Eli/Supabase ni se importaron datos. |
| Auth | Better Auth y plugin de organizaciones; `src/lib/auth/`, `src/app/api/auth/[...all]/route.ts`, páginas bajo `src/app/(auth)/`. Middleware/contexto de sesión en `src/lib/auth/` y layout `(app)`. | Código de autenticación multi-organización; no es el modelo de `personal`/RLS del CRM anterior. Se debe validar configuración/usuarios/roles para la doctora antes de uso. |
| Conversaciones y mensajes | `src/app/(app)/inbox/`, `src/components/inbox/`, `src/server/inbox/{queries,ingest,webhook,send,status,window}.ts`; APIs `src/app/api/conversations/`, `src/app/api/conversations/[id]/messages/`. | Existe bandeja de conversación con persistencia y envío. Las capacidades del canal, ventana de mensajería, flags de prueba y aislamiento org condicionan acciones. El alcance aquí no autoriza responder ni manipular conversaciones reales. |
| Handoff/intervención | `src/server/ai/handoff.ts`, `src/server/bot/handoff.ts`, campo `handoffAt`/`handoffReason` en `schema.ts`; `/api/bot/handoff`; UI de inbox. | Existe estado y flujo para escalar a una persona. Inspección de código no prueba notificación, asignación o procedimiento operativo concreto de la doctora. Restringir la revisión a la superficie y autorización necesarias. |
| Entrada webhook | `src/app/api/webhooks/wa/[webhookToken]/route.ts`, rutas `ig`/`messenger`; `src/server/inbox/webhook.ts`, `kapso.ts`, `src/server/zernio/dispatch.ts`; configuración `settings/webhook`, guardas de firma/token. | Hay handlers públicos de canales con autenticación por token/firma según proveedor. No son `eli-evento`; no se llamaron ni se enviaron eventos. |
| Agenda/Calendar | `src/server/agenda/`, `src/app/api/bookings/`, `src/app/api/calendar/`, `src/app/api/settings/google/`, conectores Google/Zoom y specs 015. | Código de agenda del nuevo producto. No se incluye en ORQ-02 ni se verificó contra calendario real. |
| Trabajo en segundo plano | `src/server/dispatch/{encolar,outbox,worker,estado}.ts`; worker por polling/temporizador y tabla dispatch. `src/server/ai/trigger.ts` y pipeline procesan mensajes. | Hay despacho/outbox y procesamiento en background dentro de la aplicación. No se identificó en los archivos inspeccionados una configuración de cron externo que permita afirmar periodicidad/operación desplegada; no equivale a `pg_cron` Eli. |
| Despliegue | `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `Caddyfile`, `fly.toml`, `railway.toml`, `render.yaml`, `docs/despliegue-eli-panel.md`, `INSTALL-IA.md`. | El repo incluye opciones y pasos de despliegue. La existencia de manifiestos/docs no acredita despliegue activo ni producción. |
| Pruebas y mocks | `tests/unit/`, `tests/e2e/`, scripts `scripts/e2e-*`, rutas `src/app/api/dev/*` detrás de guardas; `package.json` declara Vitest/Playwright. | Son artefactos de verificación disponibles. Esta tarea no los ejecutó y no atribuye su resultado. |

## Rutas relevantes para la revisión acotada

- Auth/API: `src/app/api/auth/[...all]/route.ts`; sesión y roles: `src/lib/auth/`.
- Bandeja UI: `src/app/(app)/inbox/`, componentes en `src/components/inbox/`.
- Conversaciones y mensajes API: `src/app/api/conversations/` y subrutas `[id]/messages/`.
- Modelo: `src/lib/db/schema.ts` (organization, user/session, contact, conversation, message y campos de handoff).
- Ingesta, envío y estado: `src/server/inbox/ingest.ts`, `webhook.ts`, `queries.ts`, `send.ts`, `status.ts`, `window.ts`.
- Intervención: `src/server/ai/handoff.ts`, `src/server/bot/handoff.ts`, `/api/bot/handoff`.
- Eventos en vivo: `src/app/api/events/route.ts` (SSE).
- Webhooks: `/api/webhooks/wa/[webhookToken]`, `/api/webhooks/ig/[webhookToken]`, `/api/webhooks/messenger/[webhookToken]`.
- Procesamiento asíncrono: `src/server/dispatch/` y `src/server/ai/trigger.ts`.

## Decisiones de esta auditoría

1. No se reutilizan pacientes, datos clínicos ni mensajes del seed anterior como datos del sistema nuevo.
2. “Reutilizable” indica punto de partida técnico/funcional, no paridad ni autorización para activar envíos.
3. Antes de ampliar el trabajo sobre conversaciones o intervención de la doctora, precisar identidad/rol autorizado, contexto visible, acción permitida y registro de la intervención. La auditoría identifica rutas y controles existentes, pero no concede acceso operativo.
4. La matriz es de lectura estática y trazabilidad documental; no es certificación de seguridad, migración, QA ni estado de producción.
