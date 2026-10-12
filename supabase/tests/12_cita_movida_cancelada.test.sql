-- Contrato Eli → CRM: cita_movida y cita_cancelada (CRM sincronizado con Eli). Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(24);

create function pg_temp.cita(p_gcal text) returns public.citas language sql as $$
  select * from public.citas where gcal_event_id = p_gcal $$;
grant execute on function pg_temp.cita(text) to service_role;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Paciente con una cita de Eli (10:00–11:00)
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0992220001",
  "nombre_whatsapp":"Marta Inventada","message_id":"wamid.M1"}');
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","inicio":"2026-10-13T10:00:00-05:00","fin":"2026-10-13T11:00:00-05:00",
  "servicio":"Limpieza"}');

-- ── cita_movida ──
select is(public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","inicio":"2026-10-14T15:00:00-05:00","fin":"2026-10-14T15:30:00-05:00"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'cita_movida → ok');
select results_eq(
  $$select inicia_en, termina_en, servicio, estado::text, sync from pg_temp.cita('gcal-m1')$$,
  $$values ('2026-10-14 15:00-05'::timestamptz, '2026-10-14 15:30-05'::timestamptz, 'Limpieza', 'agendada', 'ok')$$,
  'cambia inicio y fin; servicio, estado y sync = ok se quedan');
select results_eq(
  $$select (antes->>'inicia_en')::timestamptz, actor::text from public.auditoria
     where tabla = 'citas' and fila_id = (pg_temp.cita('gcal-m1')).id and accion = 'update'$$,
  $$values ('2026-10-13 10:00-05'::timestamptz, 'eli')$$, 'el cambio queda auditado con actor eli');

-- Repetir el mismo evento: no cambia nada
select is(public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","inicio":"2026-10-14T15:00:00-05:00","fin":"2026-10-14T15:30:00-05:00"}'),
  '{"ok":true,"duplicado":true}'::jsonb, 'mismo cita_movida → duplicado');
select is((select count(*)::int from public.auditoria
            where tabla = 'citas' and fila_id = (pg_temp.cita('gcal-m1')).id and accion = 'update'),
  1, 'sin auditoría extra');

-- Sin fin: conserva la duración que tenía (30 min)
select public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","inicio":"2026-10-15T09:00:00-05:00"}');
select results_eq($$select inicia_en, termina_en from pg_temp.cita('gcal-m1')$$,
  $$values ('2026-10-15 09:00-05'::timestamptz, '2026-10-15 09:30-05'::timestamptz)$$,
  'sin fin conserva la duración');

-- Fin antes del inicio → 22023 (la Edge Function responde 400)
select throws_ok($$select public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","inicio":"2026-10-15T10:00:00-05:00","fin":"2026-10-15T09:00:00-05:00"}')$$,
  '22023', null, 'fin antes del inicio → 22023');

-- Cita que el CRM no conoce: se crea como cita_reservada ligada al titular
select is(public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220002",
  "gcal_event_id":"gcal-m2","inicio":"2026-10-16T10:00:00-05:00"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'cita_movida desconocida → ok');
select results_eq(
  $$select c.inicia_en, c.termina_en, c.origen::text, c.sync, p.etapa::text, v.telefono
      from public.citas c join public.pacientes p on p.id = c.paciente_id
      join public.conversaciones v on v.id = p.conversacion_id
     where c.gcal_event_id = 'gcal-m2'$$,
  $$values ('2026-10-16 10:00-05'::timestamptz, '2026-10-16 11:00-05'::timestamptz, 'eli', 'ok', 'agendo', '593992220002')$$,
  'se crea como cita_reservada: titular nuevo, +1 h, origen eli, Agendó');

select throws_ok($$select public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220002",
  "gcal_event_id":"gcal-m9","inicio":"2026-10-16T10:00:00-05:00","fin":"2026-10-16T09:00:00-05:00"}')$$,
  '22023', null, 'cita desconocida con fin antes del inicio → 22023, no 23514');

-- Falta un campo obligatorio
select throws_ok($$select public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220001","gcal_event_id":"gcal-m1"}')$$,
  '22023', null, 'cita_movida sin inicio → 22023');

-- ── cita_cancelada ──
select is(public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"0992220001","gcal_event_id":"gcal-m1"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'cita_cancelada → ok');
select results_eq($$select estado::text, sync from pg_temp.cita('gcal-m1')$$,
  $$values ('cancelada', 'ok')$$, 'cita cancelada; sync = ok (Eli ya la borró en Calendar)');
select results_eq(
  $$select antes->>'estado', despues->>'estado', actor::text from public.auditoria
     where tabla = 'citas' and fila_id = (pg_temp.cita('gcal-m1')).id and accion = 'update'
       and antes->>'estado' is distinct from despues->>'estado'$$,
  $$values ('agendada', 'cancelada', 'eli')$$, 'la cancelación queda auditada con actor eli');
select is((select etapa::text from public.pacientes p join public.citas c on c.paciente_id = p.id
            where c.gcal_event_id = 'gcal-m1'), 'agendo', 'no cambia la etapa (igual que cancelar_cita)');

select is(public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"0992220001","gcal_event_id":"gcal-m1"}'),
  '{"ok":true,"duplicado":true}'::jsonb, 'cancelar dos veces → duplicado');

-- Cita que el CRM no conoce: no hace nada y responde ok
select is(public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"0992220003","gcal_event_id":"gcal-no-existe"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'cita_cancelada desconocida → ok');
select is((select count(*)::int from public.citas where gcal_event_id = 'gcal-no-existe'), 0, 'no crea la cita');
select is((select count(*)::int from public.conversaciones where telefono = '593992220003'), 0, 'ni el paciente');

-- Teléfono no válido → 22023 aunque no haya nada que cancelar
select throws_ok($$select public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"123","gcal_event_id":"gcal-x"}')$$,
  '22023', null, 'teléfono no válido → 22023');

-- Una cita ya atendida no se cancela ni se mueve
reset role;
update public.citas set estado = 'asistio' where gcal_event_id = 'gcal-m2';
set local role service_role;
select is(public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"0992220002","gcal_event_id":"gcal-m2"}'),
  '{"ok":true,"duplicado":true}'::jsonb, 'cita atendida: cancelar no hace nada');
select is((pg_temp.cita('gcal-m2')).estado::text, 'asistio', 'sigue atendida');
select is(public.registrar_evento_eli('{"tipo":"cita_movida","telefono":"0992220002",
  "gcal_event_id":"gcal-m2","inicio":"2026-10-20T10:00:00-05:00"}'),
  '{"ok":true,"duplicado":true}'::jsonb, 'cita atendida: mover no hace nada');

-- Sin contenido de mensajes en los eventos nuevos
select throws_ok($$select public.registrar_evento_eli('{"tipo":"cita_cancelada","telefono":"0992220001",
  "gcal_event_id":"gcal-m1","texto":"hola"}')$$, '22023', null, 'texto rechazado también aquí');
reset role;

select * from finish();
rollback;
