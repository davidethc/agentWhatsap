# Eli Panel: Tareas (aprobadas)

> Espejo de la base «Tareas (tablero SDD)» del hub
> [Eli Panel — SDD Hub](https://app.notion.com/p/c39bd425ea3e4c388f23a5a0f90717b2).
> **Aprobadas el 10-oct-2026** (punto de control 2) y en estado **Ready**. El estado vivo de cada
> tarea está en Notion; este archivo es la foto de lo aprobado.

Ramas y modelos: `crm-datos` → `feat/crm-datos` (opus) · `crm-n8n` → `feat/crm-n8n` (sonnet) ·
`crm-frontend` → `feat/crm-frontend` (sonnet) · `crm-qa-docs` → `feat/crm-docs` (sonnet).
✋ = necesita la aprobación del usuario antes de ejecutarse.

## Resumen

| ID | Tarea | Agente | Prio | Tam | Depende de |
|---|---|---|---|---|---|
| TK-1 | Inicializar Supabase local (CLI, config, Auth sin registro, extensiones) | crm-datos | P0 | S | — |
| TK-2 | Migración: tipos, personal, conversaciones, pacientes y datos_clinicos con RLS | crm-datos | P0 | M | TK-1 |
| TK-3 | Migración: mensajes, citas, cambios_etapa, horario, errores_integracion y sync_calendario con RLS y Realtime | crm-datos | P0 | M | TK-2 |
| TK-4 | Auditoría por trigger y bloqueo de datos clínicos sin consentimiento | crm-datos | P0 | S | TK-3 |
| TK-5 | Funciones de etapa: mover_etapa y marcar_asistencia | crm-datos | P0 | M | TK-4 |
| TK-6 | Funciones: crear_paciente (duplicado/responsable) y guardar_cita/cancelar_cita | crm-datos | P0 | M | TK-5 |
| TK-7 | registrar_evento_eli: mensaje_entrante, mensaje_saliente y cita_reservada | crm-datos | P0 | M | TK-6 |
| TK-8 | Edge Function eli-evento (secreto y validación) | crm-datos | P0 | S | TK-7 |
| TK-9 | Tarea programada: Perdido (no respondió) a las 24 h | crm-datos | P1 | S | TK-7 |
| TK-10 | Función resumen_del_dia: citas de hoy, números, cumpleaños y retornos | crm-datos | P1 | M | TK-6 |
| TK-11 | seed.sql con datos inventados y tipos TypeScript generados | crm-datos | P0 | S | TK-7 |
| TK-12 | ✋ Crear el proyecto remoto eli-crm y aplicar las migraciones | crm-datos | P0 | S | TK-8, TK-9, TK-10, TK-11 |
| TK-13 | Script backup-crm.sh (copia semanal de la base) | crm-datos | P2 | S | TK-12 |
| TK-14 | Guía y secretos: cuenta de servicio de Google y calendario compartido | crm-n8n | P0 | S | — |
| TK-15 | Función calendario: push de citas pendientes a Google Calendar | crm-n8n | P0 | M | TK-6, TK-14 |
| TK-16 | Función calendario: pull incremental de Google Calendar | crm-n8n | P0 | M | TK-15 |
| TK-17 | Disparos y conflictos: trigger pg_net, cron de 2 min y etag | crm-n8n | P1 | M | TK-16 |
| TK-18 | Sub-workflow n8n «Eli → CRM» | crm-n8n | P0 | M | TK-8 |
| TK-19 | Conectar una COPIA de version4 a «Eli → CRM» en 3 puntos, sin esperar | crm-n8n | P0 | M | TK-18 |
| TK-20 | ✋ Aplicar el cambio al version4 real | crm-n8n | P0 | S | TK-19, TK-12 |
| TK-21 | Scaffold crm/: Next.js, TypeScript estricto, Tailwind, shadcn, tema clínico, Inter y Lucide | crm-frontend | P0 | S | — |
| TK-22 | Login, middleware y layout con menú lateral | crm-frontend | P0 | M | TK-21, TK-1 |
| TK-23 | Capa de datos lib/data (interfaz, adaptador Supabase y adaptador falso) | crm-frontend | P0 | M | TK-22 |
| TK-24 | Resumen: citas de hoy, Asistió / No asistió y diálogo «volver en» | crm-frontend | P0 | M | TK-23, TK-10, TK-5 |
| TK-25 | Resumen: tarjetas de números y gráficos | crm-frontend | P1 | M | TK-24 |
| TK-26 | Resumen: cumpleaños y retornos | crm-frontend | P2 | S | TK-24 |
| TK-27 | Kanban: 6 columnas, arrastrar con dnd-kit y motivo de Perdido | crm-frontend | P0 | M | TK-23, TK-5 |
| TK-28 | Kanban: búsqueda y actualización en tiempo real | crm-frontend | P1 | S | TK-27, TK-8 |
| TK-29 | Ficha: datos básicos editables, responsable/dependientes e historial de etapas | crm-frontend | P0 | M | TK-23 |
| TK-30 | Ficha: datos clínicos con consentimiento | crm-frontend | P0 | S | TK-29, TK-4 |
| TK-31 | Ficha: conversación con Eli de solo lectura | crm-frontend | P0 | S | TK-29 |
| TK-32 | Nuevo paciente (formulario, duplicado por teléfono y dependiente) | crm-frontend | P0 | M | TK-23, TK-6 |
| TK-33 | Citas: crear, editar y cancelar desde el panel | crm-frontend | P0 | M | TK-23, TK-6 |
| TK-34 | Citas: vista de semana y vincular citas sin paciente | crm-frontend | P1 | M | TK-33 |
| TK-35 | ✋ Publicar el panel en Netlify gratis | crm-frontend | P1 | S | TK-12, TK-24, TK-27, TK-33 |
| TK-36 | QA: pruebas de punta a punta del panel (HU-1 a HU-9) | crm-qa-docs | P0 | M | TK-24, TK-25, TK-26, TK-27, TK-30, TK-31, TK-32, TK-33, TK-34 |
| TK-37 | QA: integración Eli → CRM, incluido el CRM caído | crm-qa-docs | P0 | M | TK-19 |
| TK-38 | QA: sincronización con Google Calendar | crm-qa-docs | P0 | M | TK-17, TK-33 |
| TK-39 | QA: revisión de seguridad y datos de salud | crm-qa-docs | P0 | S | TK-12, TK-36 |
| TK-40 | Documentación final del Eli Panel | crm-qa-docs | P1 | M | TK-36, TK-37, TK-38 |

Pueden empezar ya: **TK-1**, **TK-14** (necesita que el usuario cree la cuenta de servicio) y
**TK-21**.

## Criterios de hecho

- **TK-1:** `supabase start` y `supabase db reset` sin errores; `enable_signup = false` en
  config.toml; extensiones pg_cron, pg_net, pg_trgm y pgtap activas; README corto en `supabase/`.
- **TK-2:** `supabase db reset` ok. pgTAP: alguien de `personal` lee y escribe; un autenticado ajeno y
  anon ven 0 filas; un solo titular por conversación; teléfono con check 593…; FK con índice.
- **TK-3:** `supabase db reset` ok. pgTAP de RLS en las 6 tablas; unique(id_externo) y
  unique(gcal_event_id); horario semilla L–V 09–18 y sábado 09–15; pacientes, citas y mensajes en la
  publicación de Realtime.
- **TK-4:** pgTAP: editar un paciente, una cita o datos clínicos deja una fila en `auditoria` con
  antes, después y actor; insertar en datos_clinicos sin `consentimiento_firmado_en` falla; nadie puede
  editar ni borrar `auditoria`.
- **TK-5:** pgTAP: mover a Perdido sin motivo falla; Asistió → cita asistio, paciente Seguimiento y
  volver_el = +6 meses (o la fecha dada, o null); No asistió → Perdido (no_asistio); cada cambio queda
  en cambios_etapa con el actor.
- **TK-6:** pgTAP: 09… se guarda como 5939…; teléfono duplicado devuelve la ficha existente; con
  responsable se crea el dependiente; cita fuera de horario o con choque falla; 1 h por defecto; cita
  nueva → Agendó y sync = pendiente; cancelar → cancelada + pendiente.
- **TK-7:** pgTAP: número nuevo → titular en Nuevo con su mensaje; 2.º turno → Conversando; Perdido +
  mensaje → Conversando; mismo message_id 2 veces → 1 mensaje; cita_reservada → cita ligada al titular
  y Agendó; actor = eli en el historial.
- **TK-8:** con `supabase functions serve`: curl sin secreto → 401; JSON inválido → 400; evento válido
  → 200 y fila creada; repetido → 200 {duplicado: true}. Contrato en
  `supabase/functions/eli-evento/README.md`.
- **TK-9:** pgTAP de `private.perdidos_por_silencio()` con fechas simuladas: Nuevo/Conversando sin
  cita futura y más de 24 h sin escribir → Perdido (no_respondio); con cita futura no cambia. cron.job
  registrado cada 15 min.
- **TK-10:** pgTAP con datos de prueba: citas de hoy ordenadas por hora (zona America/Guayaquil);
  nuevos, agendadas e inasistencias de la semana por canal; cumpleaños de hoy y de la semana; retornos
  vencidos o de esta semana sin cita futura.
- **TK-11:** `supabase db reset` carga ~20 pacientes inventados en todas las etapas, citas de hoy y de
  la semana, mensajes y una doctora de prueba; `supabase gen types` → `crm/lib/data/database.types.ts`;
  ningún dato real.
- **TK-12:** con aprobación del usuario: proyecto gratis creado sin tarjeta; `supabase db push` ok;
  registro público desactivado; cuentas de doctora y admin en `personal`; advisors de seguridad sin
  errores; secreto ELI_EVENTO_SECRETO configurado.
- **TK-13:** `scripts/backup-crm.sh` genera un dump fechado fuera del repositorio; .gitignore lo
  cubre; probado una vez contra eli-crm; documentado en docs/crm.
- **TK-14:** `docs/crm/google-calendar.md` paso a paso, sin tarjeta; el usuario la sigue; un
  calendario de PRUEBA compartido para desarrollo; secretos GOOGLE_SA_JSON y GCAL_CALENDAR_ID fuera de
  git; una lectura de prueba del calendario funciona.
- **TK-15:** en local con el calendario de prueba: cita con sync = pendiente → evento creado con
  extendedProperties.private.crm_cita_id y descripción sin datos clínicos; editar mueve el evento;
  cancelar lo borra; si falla queda sync = error con el detalle.
- **TK-16:** con el calendario de prueba: evento movido → hora nueva en citas; borrado → Cancelada;
  evento de Eli con «Tel: 593…» → ligado al titular; evento manual → cita sin vincular; eventos de día
  entero o «Disponible» ignorados; syncToken guardado y reutilizado.
- **TK-17:** migración con fecha posterior a las de crm-datos. Guardar una cita dispara el push en
  menos de 10 s; cron.job de 2 min registrado; prueba de conflicto (cambio en el panel y en Calendar) →
  gana Calendar y queda una fila en errores_integracion.
- **TK-18:** `workflows/eli-crm.json` importado en n8n: con el CRM local arriba → 200 y fila creada;
  con una URL inválida termina sin error y deja la entrada en `v4:crm:errores` (máx. 200); timeout 5 s
  y 2 reintentos; sin credenciales en el JSON.
- **TK-19:** `scripts/backup.sh` hecho. En la copia: mensaje simulado → paciente y mensajes en
  Supabase; reserva → cita ligada y Agendó; con el CRM apagado Eli responde igual (ids de ejecución);
  el modelo y el system message no cambian; `scripts/check.sh` ok.
- **TK-20:** con aprobación del usuario: backup; cambio aplicado; `scripts/check.sh` ok; un mensaje
  desde un número de prueba aparece en eli-crm; export sin secretos con `scripts/export-workflow.sh`;
  cómo revertirlo documentado.
- **TK-21:** pnpm lint, typecheck y build ok; versiones exactas fijadas; tokens de color en un solo
  archivo (acento turquesa suave, fondo blanco); página de prueba revisada a 1440 y 768 px.
- **TK-22:** contra Supabase local (con un usuario de prueba creado a mano): sin sesión cualquier ruta
  → /login; login correcto → Resumen; error claro si falla; no hay pantalla de registro; cerrar sesión
  funciona; menú Resumen / Pacientes / Citas.
- **TK-23:** una interfaz pequeña para pacientes, citas, resumen y mensajes que llama a las funciones
  de la base (no escribe tablas a mano); pruebas con el adaptador falso; solo URL y clave pública en el
  cliente; `crm/.env.example`.
- **TK-24:** con el seed: citas de hoy por hora con paciente, servicio y estado; Asistió pide «volver
  en» (6 meses por defecto, cambiable o vacío) y el paciente pasa a Seguimiento; No asistió → Perdido;
  capturas a 1440 y 768 px.
- **TK-25:** tarjetas (citas hoy, nuevos, agendadas e inasistencias de la semana) que coinciden con
  una consulta SQL del seed; barras de nuevos por día y dona de canales con los gráficos de shadcn;
  captura.
- **TK-26:** listas de cumpleaños de hoy y de la semana y de retornos, según el seed, con enlace a la
  ficha; ningún botón para enviar mensajes.
- **TK-27:** columnas Nuevo, Conversando, Agendó, Asistió, Seguimiento/Volver y Perdido; soltar llama
  mover_etapa y queda en el historial; al soltar en Perdido pide el motivo; se puede mover con el
  teclado; captura.
- **TK-28:** buscar por nombre o teléfono filtra las tarjetas; un evento simulado (curl a eli-evento
  local) hace aparecer o mover la tarjeta sin recargar la página.
- **TK-29:** editar y guardar datos básicos deja la fila en auditoría; enlaces al responsable y a los
  dependientes; etapa con selector; historial de etapas con motivos de Perdido; fecha de retorno
  visible; captura.
- **TK-30:** sin consentimiento, los campos clínicos están bloqueados, con un aviso; «Marcar
  consentimiento firmado» pide la fecha; después se pueden guardar alergias, enfermedades, embarazo y
  miedo.
- **TK-31:** mensajes del paciente y de Eli en orden, con fecha y hora, incluidos los de hace más de
  24 h; sin caja para responder; los dependientes ven la conversación del responsable.
- **TK-32:** formulario con los datos de la ficha y el origen (llamada, presencial, referido);
  teléfono existente → ofrece «Abrir ficha» o «Crear dependiente»; el paciente nuevo aparece en Nuevo;
  validación con zod.
- **TK-33:** diálogo con paciente, fecha, hora, duración (1 h por defecto) y servicio; fuera de
  horario o con choque → mensaje claro; al crear, el paciente pasa a Agendó; mover y cancelar con
  confirmación; la cita queda sync = pendiente.
- **TK-34:** semana con navegación ◀ ▶ y las citas por día; las citas sin vincular se resaltan y se
  pueden ligar a un paciente; las canceladas se ven tachadas; captura a 1440 y 768 px.
- **TK-35:** con aprobación del usuario: sitio en Netlify gratis sin tarjeta, condiciones del plan
  revisadas; solo la URL y la clave pública de Supabase como variables; el login funciona contra
  eli-crm.
- **TK-36:** pruebas con Playwright sobre el seed; informe en `docs/crm/qa.md` con una tabla criterio
  → pasa / falla / no se pudo, con evidencia (captura o consulta) para cada criterio de HU-1 a HU-9.
- **TK-37:** sobre la copia de version4: evidencia (id de ejecución + consulta en Supabase) de cada
  criterio de HU-11, HU-12 y HU-13; mismo mensaje dos veces → una fila; CRM apagado → Eli responde y
  el error queda registrado.
- **TK-38:** con el calendario de prueba: panel → Calendar, Calendar movido → panel en ≤ 2 min,
  borrado → Cancelada, evento manual → sin vincular, conflicto → gana Calendar; evidencia de cada caso
  en `docs/crm/qa.md`.
- **TK-39:** advisors de Supabase sin errores; anon y un usuario ajeno no ven datos; sin secretos ni
  datos reales en git (búsqueda); la clave de servicio no está en el cliente; descripción de Calendar
  sin datos clínicos; informe en `docs/crm/qa.md`.
- **TK-40:** docs/crm (cómo funciona, cómo levantarlo y guía corta para la doctora); README, GUIA y
  CHANGELOG al día; `docs/arquitectura.md` incluye el CRM; ADR 0008–0011 en estado Aceptada.
