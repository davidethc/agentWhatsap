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
