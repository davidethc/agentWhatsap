# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Fechas en hora de
Ecuador.

## [Sin publicar]

### Agregado
- **Eli Panel: permisos por columna (TK-39).** Migración `20261011000200_permisos_por_columna.sql`:
  las funciones del panel pasan a `security definer`; el personal solo edita directo los datos básicos
  y el consentimiento del paciente, los datos clínicos y el horario; etapas, citas y conversaciones
  solo por funciones; `anon` sin privilegios en `public`. Prueba pgTAP `09_permisos` y 01/02/03
  adaptadas. README de `supabase/`: 21 pacientes (20 + 1 dependiente) y 3 sin teléfono.
- **Eli Panel: el CRM no guarda el contenido de los mensajes (TK-41).** Migración
  `20261011000100_mensajes_sin_texto.sql` (borra `mensajes.texto`; `registrar_evento_eli` rechaza
  `texto`), `eli-evento` responde 400 si llega `texto`, seed, pgTAP, tipos y capa de datos del panel
  sin contenido.
- **Eli Panel (CRM), fase de planificación con SDD** ([docs/crm/](docs/crm/README.md)): hub en
  Notion como fuente de verdad (constitución, spec en borrador con 14 historias, clarificaciones,
  flujos y tablero de tareas), `CLAUDE.md` con las reglas del proyecto, 6 agentes en
  `.claude/agents/` (planificador, orquestador y 4 compañeros en paneles de tmux), permisos que
  bloquean `git push` y `.env`, y skills de skills.sh instaladas en el proyecto. Se descartó Twenty CRM.
- **Eli Panel: Spec, Plan y Tareas aprobados** (10-oct-2026, puntos de control 1 y 2): [spec.md](docs/crm/spec.md), [plan.md](docs/crm/plan.md) y [tasks.md](docs/crm/tasks.md) (TK-1 a TK-40). ADR [0008](docs/adr/0008-crm-supabase-eventos.md) (Supabase aparte + eventos de Eli sin esperar), [0009](docs/adr/0009-sync-google-calendar.md) (Calendar desde Supabase con cuenta de servicio), [0010](docs/adr/0010-netlify.md) (Netlify en vez de Vercel Hobby) y [0011](docs/adr/0011-reglas-embudo-en-la-base.md) (reglas del embudo en la base).
- **Guía de Google Calendar (TK-14)** ([docs/crm/google-calendar.md](docs/crm/google-calendar.md)): paso a paso sin tarjeta para crear la cuenta de servicio, la clave JSON y un calendario de PRUEBA; `scripts/gcal-prueba.mjs` (lectura de prueba, solo Node) y `.gitignore` para que la clave nunca entre a git.
- **Informe de QA del Eli Panel, ronda 1** ([docs/crm/qa.md](docs/crm/qa.md)): TK-1 a TK-11, TK-14
  (solo la guía), TK-21 y TK-22 pasan (216 pruebas pgTAP, `eli-evento` por curl, lint/typecheck/build
  y login de la doctora de prueba) y sin secretos ni datos reales en git; 5 observaciones.
- **Copia de la base del Eli Panel (TK-13)**: `scripts/backup-crm.sh` (`supabase db dump` de roles,
  esquema y datos, fechada, comprimida, fuera del repo en `~/EliPanel-copias`, con `CRM_DB_URL` por
  variable de entorno) y [docs/crm/backup-crm.md](docs/crm/backup-crm.md) con la restauración;
  `.gitignore` cubre las copias. Paso a paso de TK-12 para aprobar:
  [docs/crm/tk-12-proyecto-remoto.md](docs/crm/tk-12-proyecto-remoto.md).
- **Integración Eli → CRM en n8n (TK-18, TK-19)**: sub-workflow `Eli → CRM` ([workflows/eli-crm.json](workflows/eli-crm.json), inactivo) y una COPIA inactiva de version4 con 3 ramas sin esperar ([workflows/pruebas/eli-version4-crm-copia.json](workflows/pruebas/eli-version4-crm-copia.json), generada con `scripts/crm-copia-version4.jq`). `version4` real sin cambios.
- **QA del Eli Panel, ronda 4** ([docs/crm/qa.md](docs/crm/qa.md)): TK-25, TK-26, TK-28, TK-30 y TK-34
  pasan con Playwright (números iguales a SQL, búsqueda y tiempo real con curl a `eli-evento`, datos
  clínicos solo con consentimiento, vista de semana y vincular citas). Hallazgo F-5: «Vincular» aparece en
  citas no agendadas y falla. El login (F-1) no se reprodujo en 15 intentos, pero sigue sin arreglo.
- **QA del Eli Panel, ronda 3** ([docs/crm/qa.md](docs/crm/qa.md)): TK-24, TK-27, TK-29, TK-32 y TK-33
  pasan con Playwright contra Supabase local (asistencia con «volver en», kanban con motivo de Perdido,
  ficha con auditoría, duplicado y dependiente, citas con aviso de horario y choque). Pendientes: login
  intermitente (F-1) y pgTAP hasta integrar `feat/crm-datos` (F-2).
- **QA del Eli Panel, ronda 2** ([docs/crm/qa.md](docs/crm/qa.md)): TK-13, TK-18, TK-19 y TK-23 pasan
  (backup contra la base local con checksums, workflows inactivos y sin secretos, `version4` real sin
  cambios, 43 pruebas del panel). Aviso: la copia de `version4` hay que regenerarla sobre el `version4`
  de `main` antes de TK-20.
- **El CRM no guarda ni muestra el contenido de los mensajes (TK-41)** — decisión del usuario del
  11-oct-2026, por privacidad ([ADR 0012](docs/adr/0012-crm-sin-contenido-de-mensajes.md)): el contrato
  Eli → CRM y la tabla `mensajes` quedan sin `texto` (sigue registrándose que hubo mensaje, para el
  embudo); la HU-7 «conversación con Eli» y TK-31 quedan pospuestas. Integrado y verificado por QA
  (ronda 3, [docs/crm/qa.md](docs/crm/qa.md)): columna borrada, `registrar_evento_eli` y `eli-evento`
  rechazan `texto`, los nodos CRM de n8n no lo mandan y la ficha del panel no muestra conversación.
- **Privacidad (TK-41): el CRM no guarda el contenido de los mensajes, por ahora.** Los eventos `mensaje_entrante` y `mensaje_saliente` ya no llevan `texto` (solo `tipo`, `telefono`, `nombre_whatsapp`, `message_id` o `execution_id` y `en`), y `Eli → CRM` descarta `texto` aunque alguien lo mande, tanto en el POST como en la lista Redis `v4:crm:errores`. La base no cambia: `texto` sigue siendo opcional y queda vacío.
- Guía de la reunión de venta con EliDental ([docs/comercial/reunion-elidental.md](docs/comercial/reunion-elidental.md)).

### Cambiado
- La asistente se llama **Eli** y atiende a **EliDental** (Loja, Dra. Viviana Sucunuta) con los
  datos públicos de su Facebook: dirección, WhatsApp 099 970 1778, correo y servicios (valoración,
  limpieza, resina, control de ortodoncia, urgencia). Sin precios; horario provisional. Deriva quejas
  y pedidos de hablar con la doctora al WhatsApp del consultorio.
- Datos del Instagram de EliDental: horario oficial (L–V 09:00–18:00, sábado 09:00–15:00), nombre
  completo y formación de la doctora, lista completa de tratamientos, atención a niños y embarazadas,
  y sedación para pacientes con miedo.
- Horario por día con descanso de mediodía (provisional, reemplazado el mismo día): L–V 09:00–13:00 y 15:00–19:00, sábado
  09:00–13:00, domingo cerrado. `Validar pedido` usa `HORARIO` por bloques; se borró la memoria de chat
  anterior (2 conversaciones de prueba).
- `workflows/sofi-version4.json` → `workflows/eli-version4.json`, `docs/sofi-dentista.md` → `docs/eli-dental.md`.
- `scripts/export-workflow.sh` admite contacto público del negocio (`workflows/.datos-publicos`).
- `version4` en producción con contexto de consultorio dental y datos provisionales: prompt de Sofi
  (trato de usted, urgencias, sin consejos médicos, sin prometer recordatorios), servicios y precios,
  horario 09:00–18:00 de lunes a sábado, eventos `🦷 <Servicio> - <Paciente>`.

### Diseño
- Sofi para consultorios dentales: reglas antes que la IA, urgencias, derivación a la doctora y
  recordatorios de cita con plantilla de Meta ([docs/eli-dental.md](docs/elidental.md),
  [ADR 0005](docs/adr/0005-reglas-antes-que-ia.md)).

## 2026-10-10

### Agregado
- `docs/como-funciona.md`: explicación sin tecnicismos (piezas, qué hace Eli, Kapso, costos, glosario).
- [ADR 0007](docs/adr/0007-kapso.md): Kapso como puente con WhatsApp y modelo de cobro sin tarjeta del cliente.
- Guía de la documentación en el README: qué leer según lo que se necesite.

### Reorganizado
- `docs/conversacion-natural.md` + `docs/embudo-elidental.md` → **`docs/conversacion.md`** (un solo documento).
- `docs/eli-dental.md` → **`docs/elidental.md`**, sin lo que repetía la conversación.
- `supabase/` → `workflows/legacy/supabase/` (histórico de la v2).
- Las preguntas clínicas en la documentación se alinean con el prompt: Eli ofrece una valoración; las
  quejas van al WhatsApp del consultorio.
- **Conversación natural sin botones** ([ADR 0006](docs/adr/0006-conversacion-natural.md)): nuevo prompt de
  Eli con saludo humano, información breve, honestidad si le preguntan si es un bot, límite ante
  groserías, siempre dos turnos concretos y alternativas cercanas si la hora pedida está ocupada.
  Referencia en [docs/conversacion-natural.md](docs/conversacion.md).
- Embudo de conversación de Eli por etapas (bienvenida, urgencia, conversación, cita, atendido,
  retención), con mensajes reales, esperas dentro de la ventana de 24 h y plantillas de Meta
  ([docs/embudo-elidental.md](docs/conversacion.md)).
- Guía de instalación en Windows ([docs/instalacion-windows.md](docs/instalacion-windows.md)).

### Cambiado
- `version4` vuelve a la **conversación natural** (sin formulario): el formulario WhatsApp Flow queda
  guardado en la rama `feat/flow-formulario` hasta que Meta permita publicarlo.
- Modelo del agente: `gemini-3.5-flash-lite` (cambiado en el editor de n8n).
- `docs/operacion.md`: cómo levantar todo después de reiniciar el computador.
- `scripts/backup.sh` avisa si Docker no está corriendo.

## 2026-10-07

### Cambiado
- `version4` usa solo Gemini (`gemini-3.5-flash`); se quitó OpenRouter ([ADR 0003](docs/adr/0003-gemini.md)).
- Repositorio reorganizado: `docs/` (arquitectura, operación, seguridad, ADR), `scripts/`,
  `workflows/` (producción, pruebas, legacy), normas en `CONTRIBUTING.md`.
- `GUIA.md` reescrita para el sistema actual (queue mode, Gemini, Redis local, `sofi-version4.json`).

### Agregado
- `scripts/init-env.sh`, `check.sh`, `backup.sh` y `export-workflow.sh`.
- Workflows de autotest en `workflows/pruebas/`.
- Historial v2 (Supabase, sub-workflow de agenda) y fuente SDK de version4, integrados en `legacy/`.

### Seguridad
- Se reemplazaron por marcadores el correo del calendario, el `phone_number_id`, los IDs de
  credenciales y un teléfono de ejemplo en los archivos del repositorio.

## 2026-10-06

### Cambiado
- n8n 2.41.5 en **modo queue**: PostgreSQL 18, Redis 7, worker y runners externos; migración de SQLite
  con `import:entities` y ajuste de secuencias ([ADR 0001](docs/adr/0001-queue-mode.md)).
- Estado del bot en Redis local (DB 1), en vez de Redis Cloud ([ADR 0002](docs/adr/0002-redis-local.md)).

## 2026-10-02

### Agregado
- `version4`: un solo workflow con la agenda como entrada interna, dedup, lock por conversación y
  cola de pendientes en Redis ([ADR 0004](docs/adr/0004-un-solo-workflow.md)).
- v2: integración con Supabase (`barberia-reservas`) y sub-workflow de agenda validado.
- Mensaje de aviso al cliente cuando el agente falla; reglas contra horarios inventados.

### Cambiado
- Modelo: de Claude a OpenRouter y luego a Gemini Flash (nivel gratuito).

## 2026-10-01

### Agregado
- Primera versión: n8n en Docker, workflow de citas con Kapso, Claude y Google Calendar.
