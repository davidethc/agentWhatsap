# Eli Panel: informe de QA

Lo escribe `crm-qa-docs`. Un criterio de hecho por fila (los de [tasks.md](tasks.md)), con la evidencia
de cada prueba. Estado de las tareas en Notion: lo cambia el orquestador, no este informe.

## Ronda 1 · 11-oct-2026 · TK-1 a TK-11, TK-14, TK-21 y TK-22

Rama `feat/crm-docs` (sobre `feat/crm`, `0523780`). Supabase local ya levantado (API 55321, Postgres
55322). **No se hizo `db reset` ni se detuvo nada.**

| Resultado | Cantidad |
|---|---|
| Pasa | 14 de 14 tareas |
| Falla | 0 |
| Observaciones (no bloquean) | 5, al final |

### Resumen por tarea

| Tarea | Resultado | Evidencia |
|---|---|---|
| **TK-1** Supabase local | ✅ Pasa | `supabase test db` ok sin reiniciar nada; `[auth] enable_signup = false` en `config.toml`; `pg_cron`, `pg_net`, `pg_trgm` y `pgtap` en `pg_extension`; `supabase/README.md` existe. Registro público: `POST /auth/v1/signup` → 422 `signup_disabled`. Login con la doctora de prueba → 200. |
| **TK-2** Tipos, personal, pacientes, datos clínicos con RLS | ✅ Pasa | `01_pacientes_rls` ok (25 pruebas): personal lee y escribe, ajeno y anon ven 0 filas, un solo titular por conversación, teléfono 593…, `perdido` sin motivo falla. Consulta: las 11 tablas de `public` con `relrowsecurity = true`; 0 FK sin índice. |
| **TK-3** Agenda, mensajes, citas, horario, sync, Realtime | ✅ Pasa | `02_agenda_rls` ok (35 pruebas). Índices únicos `mensajes_id_externo_key` y `citas_gcal_event_id_key`. Horario semilla: días 1–5 de 09:00 a 18:00 y día 6 de 09:00 a 15:00. Publicación `supabase_realtime`: `citas`, `mensajes`, `pacientes`. |
| **TK-4** Auditoría y consentimiento | ✅ Pasa | `03_auditoria` ok (21 pruebas): editar paciente, cita o datos clínicos deja fila con antes, después y actor; datos clínicos sin `consentimiento_firmado_en` fallan; `personal`, `service_role` y hasta `postgres` no pueden editar ni borrar `auditoria`. Por HTTP: `GET /auditoria` con anon → 401. |
| **TK-5** `mover_etapa` y `marcar_asistencia` | ✅ Pasa | `04_etapas` ok (27 pruebas): Perdido sin motivo falla; Asistió → Seguimiento con `volver_el` = hoy + 6 meses, o la fecha dada, o `null`; No asistió → Perdido; cada cambio en `cambios_etapa` con actor. |
| **TK-6** `crear_paciente`, `guardar_cita`, `cancelar_cita` | ✅ Pasa | `05_pacientes_citas` ok (38 pruebas): `09…`, `+593…`, `00593…` y 9 dígitos → `5939…`; teléfono duplicado devuelve la ficha existente; dependiente con responsable; cita fuera de horario (error `22023`) y con choque (`23P01`) falla; cancelar → cancelada + sync pendiente. |
| **TK-7** `registrar_evento_eli` | ✅ Pasa | `06_evento_eli` ok (32 pruebas) **y en vivo** con curl (ver TK-8): número nuevo → Nuevo; 2.º turno → Conversando; `cita_reservada` → Agendó; cambios con `actor = eli`; mismo `message_id` dos veces → 1 solo mensaje (`select count(*) … id_externo='qa-msg-1'` = 1). |
| **TK-8** Edge Function `eli-evento` | ✅ Pasa | Con `supabase functions serve` y un secreto aleatorio solo local: sin secreto → **401**; secreto malo → **401**; JSON inválido → **400** `JSON inválido`; `tipo` desconocido → **400**; sin `telefono` → **400**; GET → **405**; evento válido → **200 `{"ok":true,"duplicado":false}`**; repetido → **200 `{"ok":true,"duplicado":true}`**. La cita repetida (`gcal_event_id`) también devuelve `duplicado: true`. Contrato en `supabase/functions/eli-evento/README.md`. |
| **TK-9** Perdido a las 24 h | ✅ Pasa | `07_perdidos_por_silencio` ok (13 pruebas, fechas simuladas: 25 h sin cita → Perdido `no_respondio`; con cita futura no cambia). `cron.job`: `perdidos-por-silencio` con `*/15 * * * *`. |
| **TK-10** `resumen_del_dia` | ✅ Pasa | `08_resumen_del_dia` ok (18 pruebas, hora de Guayaquil, cumpleaños y retornos). En vivo: la doctora llama `rpc/resumen_del_dia` → 200 con `fecha`, `semana`, `canales` y `numeros`; anon → 401 `permission denied for function`. |
| **TK-11** Seed y tipos | ✅ Pasa | `supabase gen types typescript --local --schema public` es **idéntico** a `crm/lib/data/database.types.ts` (413 líneas). Seed: 22 pacientes inventados (teléfonos `5939000000xx`, correos `@ejemplo.test`, 1 dependiente, 3 sin conversación), 73 mensajes, doctora de prueba. Sin correos ni teléfonos reales (ver revisión de secretos). |
| **TK-14** Guía de Google (solo revisión) | ✅ Pasa | `docs/crm/google-calendar.md` revisada: 7 pasos claros, dice que no pide tarjeta y a detenerse si la pide, la clave va a `secrets/` (en `.gitignore`: `git check-ignore` confirma `secrets/google-sa.json` y `google-sa*.json`), enlaza el ADR 0009, que existe. `node --check scripts/gcal-prueba.mjs` ok y sin credenciales falla con un mensaje claro («Falta GOOGLE_SA_JSON»). **No probada la lectura real**: la hace el usuario. |
| **TK-21** Scaffold `crm/` | ✅ Pasa | `pnpm install --frozen-lockfile`, `pnpm lint` (sin avisos), `pnpm typecheck` y `pnpm build` ok (con las dos variables públicas). 0 versiones con `^` o `~` en `package.json`. Todos los colores en `crm/styles/tokens.css` (ningún hex ni `oklch` fuera de él). Capturas a 1440 y 768 px: `capturas/tk21-1440.png` y `tk21-768.png`. |
| **TK-22** Login y menú | ✅ Pasa | `next start` + Playwright contra Supabase local: sin sesión `/`, `/pacientes`, `/citas`, `/salir`, `/registro` y `/signup` → 307 a `/login`; clave mala → «Correo o clave incorrectos. Revisa y vuelve a intentar.»; doctora de prueba → `/` (Resumen) con menú Resumen / Pacientes / Citas y su nombre; cada enlace navega; con sesión `/login` redirige a `/`; **Cerrar sesión** → `/login` y `/pacientes` vuelve a pedir login. No hay pantalla de registro. Capturas: `capturas/tk22-*`. |

### Detalle: pruebas de punta a punta de TK-7 y TK-8

Con el número claramente falso `0900000091` (`593900000091`):

| # | Llamada | Esperado | Obtenido |
|---|---|---|---|
| A | `mensaje_entrante` nuevo | 200, paciente en Nuevo | 200 `duplicado:false`, cambio `- → nuevo` (actor `eli`) |
| B | el mismo `message_id` otra vez | 200 `duplicado:true`, 1 mensaje | 200 `duplicado:true`; 1 fila con ese `id_externo` |
| C | `mensaje_saliente` | 200, guardado | 200 `duplicado:false` |
| D | 2.º `mensaje_entrante` con `+593900000091` | Conversando, mismo paciente | 200; `nuevo → conversando`, `turnos_entrantes = 2` |
| E | `cita_reservada` | cita ligada, Agendó | 200; cita `agendada`, `sync = ok`, origen `eli`, 10:00–11:00 Guayaquil (por defecto 1 h); `conversando → agendo` |
| F | la misma `cita_reservada` | 200 `duplicado:true` | 200 `duplicado:true` |
| G | sin `telefono` | 400 | 400 `Falta el campo telefono` |

### Revisión de seguridad y datos de salud (de esta ronda)

| Revisión | Resultado | Evidencia |
|---|---|---|
| Secretos en archivos versionados | ✅ | `git grep` de JWT (`eyJ…`), `sb_secret_`, claves privadas, `AIza…`, `ghp_`, `xox…`: sin coincidencias (solo un hash `sha512` de `pnpm-lock.yaml`, falso positivo). |
| Secretos en el historial `main..HEAD` | ✅ | Mismos patrones sobre `git log -p`: solo el mismo hash del lockfile. El secreto de prueba usado en esta ronda no está en ningún archivo del repositorio (vive en el scratchpad, fuera de git). |
| `.env` y claves fuera de git | ✅ | `git ls-files` solo trae `.env.example`; `.gitignore` cubre `.env`, `secrets/` y las claves de Google. |
| Datos reales en seed, tests y docs | ✅ | Solo `@ejemplo.test`, teléfonos `5939000000xx`, cédulas `0000000xxx`; los correos `admin@email.com` y `a1b2c3d4e5@group.calendar.google.com` son ejemplos (el primero, comentario por defecto de `config.toml`). |
| anon sin acceso | ✅ | Con la clave pública: `GET` a `pacientes`, `citas`, `mensajes`, `conversaciones` → `[]`; `auditoria` → 401; `POST /pacientes` → 401; `rpc/registrar_evento_eli` y `rpc/resumen_del_dia` → 401. Sin login no se ve nada. |
| Funciones y RLS | ✅ | 0 funciones `security definer` sin `search_path`; 0 funciones ejecutables por `anon`; 21 políticas, ninguna con `using (true)`. |
| La doctora sí ve datos | ✅ | Con su token: `GET /pacientes` devuelve las filas (23 en el momento de la prueba). |

## Ronda 2 · 11-oct-2026 · TK-13, TK-18, TK-19 y TK-23

Rama `feat/crm-docs` tras `git merge feat/crm` (`b848138`; conflictos solo en CHANGELOG y README de
docs, resueltos conservando ambos lados). No se hizo `db reset`, no se importó ni activó nada en n8n.

| Tarea | Resultado | Evidencia |
|---|---|---|
| **TK-13** `backup-crm.sh` | ✅ Pasa | Contra la base local (`--db-url …:55322`, destino fuera del repo): genera `eli-crm-AAAAMMDD-HHMMSS/` con `roles`, `schema` y `data` `.sql.gz` + `SHA256SUMS`; `shasum -c` → 3 × OK; carpeta 700 y archivos 600; el esquema trae 11 tablas, los datos traen `public`, `auth` y `storage` y la fila de QA (`593900000091`); sin claves en el esquema. Errores: sin `CRM_DB_URL` → «Falta CRM_DB_URL» (exit 1); URL `mysql://` → «no parece una cadena postgresql» (exit 1). `.gitignore` cubre `eli-crm-*/` (una copia hecha dentro de `crm/` no aparece en `git status`; la borré). Aviso esperado de `pg_dump` por la referencia circular de `pacientes` (la guía lo explica). **No probada la restauración** en una base vacía (haría falta un `db reset` o una base aparte). |
| **TK-18** `workflows/eli-crm.json` | ✅ Pasa (solo lectura del JSON) | 8 nodos; sin clave `active` (n8n lo importa inactivo); POST a `http://host.docker.internal:55321/functions/v1/eli-evento`, `timeout 5000`, `maxTries 3` (= 1 intento + 2 reintentos), `continueErrorOutput`; error → «Armar error» → `LPUSH v4:crm:errores` → `LLEN` → si > 200 `RPOP`; termina sin error. Credenciales solo por referencia (`Eli CRM secreto`, `Redis local`); sin tokens, JWT ni el secreto de prueba. **No ejecutado en n8n** (prohibido importar): el 200 con fila creada y la lista de errores en Redis quedan para TK-37. |
| **TK-19** copia de `version4` | ✅ Pasa (solo lectura del JSON) | `workflows/pruebas/eli-version4-crm-copia.json`: sin `active`, nombre «COPIA CRM (prueba, inactiva)», webhook con ruta propia (`copia-crm-tk19-no-usar`) para no chocar con producción. Frente al `version4` real: 6 nodos nuevos (3 «armar» + 3 «enviar … (sin esperar)»), **0 nodos eliminados, 0 conexiones originales perdidas**; el único nodo existente que cambia es «Webhook Kapso» (ruta e id). Las 3 llamadas son `executeWorkflow` con `waitForSubWorkflow: false` y `onError: continueRegularOutput`, colgadas **en paralelo** de «¿Mensaje nuevo?», «Responder por WhatsApp» y «Crear evento». Agente y modelo Gemini idénticos. `jq -f scripts/crm-copia-version4.jq workflows/eli-version4.json` reproduce la copia exacta. `workflows/eli-version4.json` real: **sin cambios** respecto al ancestro común con `main`. Simulé los 3 nodos «armar» con datos falsos y apliqué los eventos con `registrar_evento_eli` (paciente falso `593900000093`): Nuevo → Agendó, 2 mensajes, cita `agendada` / origen `eli` / sync `ok`; con teléfono o id vacíos el nodo no manda nada. |
| **TK-23** Capa de datos | ✅ Pasa | `pnpm test`: 3 archivos, **43 pruebas** ok; `pnpm lint`, `pnpm typecheck` y `pnpm build` (con las dos variables públicas) ok. Solo se llaman las funciones de la base (`resumen_del_dia`, `mover_etapa`, `marcar_asistencia`, `crear_paciente`, `guardar_cita`, `cancelar_cita`); 0 `insert/update/upsert/delete` a tablas en `lib`, `app` y `components`; el cliente solo lee `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `ELI_DATOS` (adaptador falso/real); la `service_role` solo aparece en un comentario que la prohíbe. `crm/.env.example` está en git; **no pude leer su contenido** (el permiso lo niega). |

### Observaciones de la ronda 2

| # | Qué | Impacto | Sugerencia |
|---|---|---|---|
| 6 | **La copia de `version4` quedó vieja.** `main` ya tiene un `version4` con los seguimientos automáticos (`d54e52b`, +179 líneas) que `feat/crm` no tiene; la copia se hizo sobre el anterior. | Aplicar la copia tal cual en TK-20 **borraría los seguimientos** de producción. | Antes de TK-20, `git merge main` y regenerar con el `jq` (probé el `jq` sobre el `version4` de `main`: da 46 nodos, 6 de ellos CRM). Ya tiene backup previo obligatorio (`scripts/backup.sh`). |
| 7 | En error, «Armar error» guarda en Redis (`v4:crm:errores`) el evento completo, con **teléfono y texto del mensaje**. | Datos de salud en una lista de Redis (hasta 200). Contradice la regla «sin teléfono ni texto» de `errores_integracion`. | Con TK-41 el evento ya no lleva texto; falta decidir si guardar el teléfono. |
| 8 | Alguien más levantó `supabase functions serve` con otro secreto; mi segundo `serve` salió solo y `eli-evento` devuelve 401 con mi secreto de la ronda 1. | Ninguno; no lo toqué. | Quien lo usa, que lo cierre al terminar (el runtime ya murió una vez por memoria). |

## Ronda 3 · 11-oct-2026 · TK-24, TK-27, TK-29, TK-32 y TK-33 (navegador) + verificación de TK-41

Rama `feat/crm-docs` tras `git merge feat/crm` (incluye TK-41: datos `a0db82d`, n8n `e2e36d2`). Playwright
contra Supabase local y la doctora de prueba, sobre el build de producción (`next start`, puerto 3100;
reconstruido tras el merge). Datos inventados; sin `db reset`. Base: `pnpm lint`, `typecheck`, `test`
(75 pruebas) y `build` ✅.

| Tarea | Resultado | Evidencia (capturas en `capturas/qa-*`) |
|---|---|---|
| **TK-24** Resumen y asistencia (HU-2) | ✅ Pasa | Citas de hoy por hora con paciente, servicio y estado (`qa-tk24-resumen-1440/768.png`). **Asistió** pide «volver en» (3 meses / 6 meses recomendado / 1 año / otra fecha / sin fecha). Jorge con el valor por defecto → Seguimiento, `volver_el` = 2027-04-11 (= hoy + 6 meses), cita `asistio`; Irene «sin fecha» → `volver_el = null`; paciente con «otra fecha» 2027-01-15 → `volver_el = 2027-01-15` (`qa-tk24-otra-fecha-1440.png`). **No asistió** (pide confirmación) → Perdido con motivo `no_asistio`, cita `no_asistio`. Cada cambio en `cambios_etapa` con `actor = personal`. |
| **TK-27** Kanban (HU-5.1–5.3) | ✅ Pasa | 6 columnas (Nuevo, Conversando, Agendó, Asistió, Seguimiento / Volver, Perdido) con contadores. Arrastrar Nuevo → Conversando cambia la etapa y queda en `cambios_etapa` (actor personal). Soltar en Perdido abre «¿Por qué se perdió…?» (No respondió / Indeciso / No asistió): con «Indeciso» → `perdido`, `motivo = indeciso`; «Cancelar» deja la tarjeta donde estaba. También se movió una tarjeta con el teclado (Espacio, flecha, Espacio). **HU-5.4 (buscar por nombre o teléfono) no existe todavía en la pantalla**: es TK-28, fuera de esta ronda. |
| **TK-29** Ficha (HU-6) | ✅ Pasa (con alcance) | Datos básicos, etapa con selector, fecha «Volver el» visible, citas e historial de etapas con quién/cuándo y «Motivo: indeciso». Enlaces: dependiente → responsable (`/pacientes/9`) y responsable → «Dependientes: …» (`/pacientes/21`). Editar el correo guarda y deja en `auditoria` `update` con antes/después y `actor = personal`. **Sin conversación** (correcto por TK-41). Datos clínicos y consentimiento (HU-6.3) aún no están: son TK-30. |
| **TK-32** Nuevo paciente (HU-8) | ✅ Pasa | Formulario con nombre, teléfono, cómo llegó (llamada / presencial / referido), cédula, nacimiento y correo; vacío → mensajes de zod; teléfono «123» → «El teléfono no es válido». Crear con `0900000071` → fila en **Nuevo**, origen presencial, teléfono `593900000071`. Mismo teléfono otra vez → «Ya existe … ¿abrir su ficha o crear dependiente?» (`qa-tk32-duplicado-1440.png`); «Crear dependiente» cambia el formulario a «Comparte el teléfono y la conversación de su responsable» (sin pedir teléfono) y al guardar crea al paciente con `responsable` y la misma conversación. «Abrir ficha» **no se hizo clic**. |
| **TK-33** Citas (HU-9) | ✅ Pasa | Crear (martes 13, 14:00, duración por defecto 1 h) → cita `agendada`, origen `panel`, sync `pendiente`, 14:00–15:00 Guayaquil, paciente → Agendó (aviso «Cita creada. El paciente pasó a Agendó.»). Domingo y lunes 19:00 → «La cita está fuera del horario del consultorio»; 09:45 sobre otra cita → «Ya hay otra cita en ese horario»; ninguna de las 3 se guardó. Cambiar a 15:00 con 2 h → 15:00–17:00, sync `pendiente`. Cancelar pide confirmación («Se quitará también de Google Calendar») → `cancelada`, sync `pendiente`. **No se verificó Google Calendar** (el push es TK-15/17). |

### Verificación de TK-41

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Columna `mensajes.texto` borrada | ✅ | Columnas: `id, conversacion_id, id_externo, direccion, enviado_en, created_at`. Migración `20261011000100_mensajes_sin_texto.sql`. |
| `registrar_evento_eli` rechaza `texto` | ✅ | Con `texto` → «texto ya no se acepta: el CRM no guarda el contenido de los mensajes»; sin él → `{"ok":true,"duplicado":false}`. `eli-evento/validar.ts` lo convierte en 400. |
| `errores_integracion` sin texto | ✅ | 0 filas con «texto». |
| Payloads de los nodos CRM (ejecutados con datos simulados con mensaje de salud) | ✅ | `mensaje_entrante`: `tipo, telefono, nombre_whatsapp, message_id, en`; `mensaje_saliente`: `tipo, telefono, execution_id, en`; `cita_reservada`: sin texto. El sub-workflow `eli-crm.json` además descarta `texto` si llegara. «Armar error» ya no guarda el texto (sí el teléfono). |
| Seed y pruebas | ✅ | `seed.sql`: 0 referencias a «texto»; pgTAP del repo: `hasnt_column mensajes.texto` y «texto se rechaza (TK-41)»; `06_evento_eli` ok. |
| Panel | ✅ | Sin conversación en la ficha; `pnpm test`, `lint`, `typecheck` y `build` verdes. Las pruebas de la capa de datos mencionan `texto` solo como filtro de búsqueda (nombre/teléfono). |
| Sigue registrándose que hubo mensaje | ✅ | Eventos aceptados con dirección y hora; Nuevo → Conversando, Agendó y deduplicación por `id_externo` probados (rondas 1–3). |
| `git grep -i texto` | ✅ | Solo quedan: migraciones históricas (`…0300`, `…0700`), el rechazo de `texto`, el filtro de búsqueda del panel, textos de UI y el texto que Eli le pasa al agente (no al CRM). |

### Hallazgos de la ronda 3

| # | Qué | Impacto | Sugerencia |
|---|---|---|---|
| F-1 | **Login intermitente (de la vuelta anterior).** En 1 de 5 intentos el botón se quedaba en «Entrando…»; el log mostraba `Route "/": … unstable value Date.now() while prerendering` en `__loadSession`. Tras el último reinicio y el build nuevo mi helper reintentó el login, así que **no se pudo confirmar si sigue ocurriendo**. | Posible bloqueo de acceso. | `crm-frontend`: reproducir con 5–10 logins seguidos sobre `next start` y revisar `app/(panel)/layout.tsx` / `getClaims()`. |
| F-2 | `supabase test db` falla en `01`, `02` y `03` (`permission denied for table pacientes/citas`). No es un fallo del código de `feat/crm`: la base compartida ya tiene migraciones de otras ramas que `feat/crm` aún no integra (`20261011000200_permisos_por_columna`, `…120100_calendario_push`, `…120200_calendario_pull`) y esas pruebas son las anteriores. `04`–`08` pasan (incluido `06`, con TK-41). | Hasta integrar `feat/crm-datos` no hay un pgTAP verde contra esta base. | Integrar `feat/crm-datos` y volver a correr `supabase test db`. |
| F-3 | Al marcar **Cancelar** una cita, el paciente se queda en Agendó (la HU-9 no pide otra cosa). | Menor. | Decidir con la doctora si debe volver a Conversando. |
| F-4 | `database.types.ts` no incluye las funciones de calendario que ya existen en la base (`aplicar_evento_calendario`, `calendario_citas_pendientes`…). | Menor, mismo origen que F-2. | Regenerar al integrar. |

Datos de QA dejados en la base local (inventados): pacientes «Paciente QA Nuevo» y «Hijo QA Dependiente»
(`593900000071`), la cita cancelada «Valoración QA» y la cita «QA Otra fecha» (insertada por SQL, porque hoy es
domingo y el panel no deja agendar fuera de horario).

## Observaciones (no son fallos de ningún criterio)

| # | Qué | Impacto | Sugerencia |
|---|---|---|---|
| 1 | El runtime de Edge Functions (`supabase_edge_runtime_eli-crm`) terminó con **código 137** (lo mató el sistema, probablemente falta de memoria con 4 GB en Docker) unos minutos después de que acabaran las pruebas; el resto del stack siguió `healthy`. | Quien use `eli-evento` en local (TK-18, TK-19, TK-28) puede ver 503 `name resolution failed` y debe volver a lanzar `supabase functions serve`. | Dejar la nota en `supabase/README.md`; no sirvas funciones y n8n con muchos paneles abiertos a la vez. |
| 2 | `pnpm build` **sin** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` falla en `/salir` con un mensaje claro. | Es a propósito, pero en TK-35 (Netlify) las dos variables deben estar puestas **antes** del primer build. | Anotarlo en la guía de publicación. |
| 3 | `anon` conserva los privilegios de tabla por defecto de Supabase en `public`; solo lo frena RLS (sin políticas) y los `GRANT` a funciones. | Hoy no se puede leer ni escribir (probado). Una política futura mal escrita expondría datos. | Defensa extra: `revoke all on all tables in schema public from anon` en una migración. Lo decide `crm-datos`. |
| 4 | Las pruebas dejaron filas de QA en la base compartida: paciente «QA Paciente Prueba» (`593900000091`), 3 mensajes (`qa-msg-1`, `qa-msg-2`, `out:qa-exec-1`) y la cita `qa-gcal-1`. | Suman 1 al conteo de pacientes y a «agendados» de la semana; puede descuadrar una comparación de TK-25 con una consulta del seed. | Un `supabase db reset` las quita (lo decide el orquestador; no lo hice). |
| 5 | `supabase/README.md` dice «21 pacientes»; el seed carga **22**. | Solo documentación. | Corregir el número en `crm-datos`. |

## Qué no se pudo probar

- La lectura real de Google Calendar (TK-14): la hace el usuario con su cuenta de servicio.
- `supabase db push` y el proyecto remoto: pertenecen a TK-12, aún no ejecutada.

## Cómo repetir esta ronda

```bash
supabase test db                                   # 9 archivos, 216 pruebas pgTAP
supabase functions serve --env-file <archivo-con-ELI_EVENTO_SECRETO-aleatorio>
cd crm && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave pública local> pnpm build
```

El secreto de prueba se genera con `openssl rand -hex 24` y no se guarda en el repositorio.
