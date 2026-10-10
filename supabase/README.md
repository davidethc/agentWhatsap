# supabase/ · Base de datos del Eli Panel

Base del CRM (proyecto `eli-crm`). Modelo y reglas: [docs/crm/plan.md](../docs/crm/plan.md) §4–5.

## Levantar en local

```bash
supabase start          # primera vez baja imágenes (lento); con poca RAM: supabase start --ignore-health-check
supabase db reset       # aplica migrations/ + seed.sql desde cero (borra todo lo creado a mano)
supabase test db        # pruebas pgTAP de tests/ (no dependen del seed)
supabase functions serve --env-file supabase/functions/.env   # Edge Functions (eli-evento)
```

- Puertos **5532x** (API 55321, Postgres 55322, Studio 55323, correo 55324) para no chocar con otros
  proyectos de Supabase ni con el Postgres de n8n.
- `analytics` está apagado: con 4 GB en Docker no arrancaba junto a n8n. Si `supabase start` corta
  por «HealthCheckTimeout», usar `--ignore-health-check` y esperar a que todo quede `healthy`.
- Sin registro público: `[auth] enable_signup = false`. **`[auth.email] enable_signup` debe quedar en
  `true`**: en `false` apaga el login por correo («Email logins are disabled»).
- Solo local. El proyecto remoto `eli-crm` se crea en TK-12, con aprobación del usuario.

## Acceso de prueba (SOLO LOCAL)

| Correo | Contraseña | Rol |
|---|---|---|
| `doctora@ejemplo.test` | `eli-panel-local` | doctora (fila en `personal`) |

La crea `seed.sql`. Nunca se usa en el proyecto remoto: allí las cuentas las crea el admin y se
agregan a `personal`.

## Datos de prueba (`seed.sql`)

Todo inventado: 21 pacientes (nombres ficticios, teléfonos `5939000000xx`, cédulas `0000000xxx`,
correos `@ejemplo.test`) en las 6 etapas, un dependiente, un paciente sin teléfono, ~70 mensajes,
citas de hoy y de la semana (una sin vincular y una cancelada), dos fichas con consentimiento y datos
clínicos, cumpleaños y retornos. Las fechas son relativas a **hoy en Guayaquil**.

La tarea de las 24 h (pg_cron, cada 15 min) pasa a Perdido a quien lleve más de 24 h sin escribir:
al día siguiente las columnas Nuevo y Conversando se vacían. Otro `supabase db reset` lo restaura.

## Tipos TypeScript

```bash
supabase gen types typescript --local --schema public > crm/lib/data/database.types.ts
```

Regenerar después de cada migración nueva.

## Carpetas

| Ruta | Qué hay |
|---|---|
| `migrations/` | SQL versionado, pequeño e idempotente, en orden de fecha |
| `tests/` | Pruebas pgTAP (RLS, auditoría, reglas del embudo, evento de Eli, resumen) |
| `functions/eli-evento/` | Entrada Eli → CRM ([README](functions/eli-evento/README.md)) |
| `functions/.env.example` | Secretos de las funciones en local (copiar a `functions/.env`, ignorado por git) |
| `seed.sql` | **Solo datos inventados** |

## Interfaz de la base (para el panel y las integraciones)

| Función | Quién | Qué hace |
|---|---|---|
| `mover_etapa(p_paciente_id, p_etapa, p_motivo?)` | personal | Kanban. Perdido exige motivo |
| `marcar_asistencia(p_cita_id, p_asistio, p_volver_el?)` | personal | Asistió → Seguimiento + retorno (+6 meses por defecto, fecha o null); No asistió → Perdido |
| `crear_paciente(p_nombre, p_origen, p_telefono?, p_cedula?, p_fecha_nacimiento?, p_correo?, p_responsable_id?)` | personal | `{duplicado, paciente}` |
| `guardar_cita(p_paciente_id, p_inicia_en, p_termina_en?, p_servicio?, p_cita_id?)` | personal | Crea o edita; horario y choque; → Agendó; `sync = pendiente` |
| `cancelar_cita(p_cita_id)` | personal | Cancelada + `sync = pendiente` |
| `resumen_del_dia(p_fecha?)` | personal | jsonb del inicio (ver comentario en la migración 0900) |
| `registrar_evento_eli(p_evento)` | service_role | Contrato Eli → CRM |
| `private.perdidos_por_silencio(p_ahora?)` | pg_cron | Perdido (no respondió) a las 24 h |

Errores: 22023 datos inválidos / fuera de horario · 23P01 choque de citas · P0002 no existe ·
42501 sin permiso · P0001 falta el consentimiento.

## Reglas

Nombres en español y minúsculas · `bigint identity` · `timestamptz` · FK con índice · RLS en todas
las tablas con `(select private.es_personal())` · funciones internas en `private` con
`search_path = ''` · zona `America/Guayaquil`.
