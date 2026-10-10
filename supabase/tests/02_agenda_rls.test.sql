-- TK-3 · mensajes, citas, cambios_etapa, horario, errores_integracion y sync_calendario.
-- Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(40);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

insert into public.conversaciones (id, telefono) overriding system value values (900001, '593990000001');
insert into public.pacientes (id, conversacion_id, nombre, origen)
  overriding system value values (900001, 900001, 'Ana Inventada', 'whatsapp');
insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
  values (900001, 'wamid.prueba1', 'entrante', 'Hola', now());
insert into public.citas (paciente_id, gcal_event_id, inicia_en, termina_en, origen, sync)
  values (900001, 'gcal-prueba-1', '2026-10-12 10:00-05', '2026-10-12 11:00-05', 'eli', 'ok');
insert into public.cambios_etapa (paciente_id, de, a, actor) values (900001, null, 'nuevo', 'eli');
insert into public.errores_integracion (origen, detalle) values ('eli', '{"error":"prueba"}');
insert into public.sync_calendario (calendario_id, sync_token) values ('cal-prueba', 'tok');

-- Estructura y RLS
select has_table('public', t, 'existe ' || t) from unnest(array[
  'mensajes','citas','cambios_etapa','horario','errores_integracion','sync_calendario']) t;
select is(
  (select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS activado en todas las tablas de public');

-- Únicos e integridad
select throws_ok($$insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
  values (900001, 'wamid.prueba1', 'entrante', 'Hola otra vez', now())$$,
  '23505', null, 'unique(id_externo)');
select throws_ok($$insert into public.citas (gcal_event_id, inicia_en, termina_en, origen)
  values ('gcal-prueba-1', '2026-10-13 10:00-05', '2026-10-13 11:00-05', 'calendario')$$,
  '23505', null, 'unique(gcal_event_id)');
select throws_ok($$insert into public.citas (inicia_en, termina_en, origen)
  values ('2026-10-13 11:00-05', '2026-10-13 10:00-05', 'panel')$$,
  '23514', null, 'termina_en > inicia_en');
select throws_ok($$insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
  values (900001, 'x', 'lateral', 'a', now())$$, '23514', null, 'dirección entrante/saliente');
select throws_ok($$insert into public.citas (inicia_en, termina_en, origen, sync)
  values ('2026-10-13 10:00-05', '2026-10-13 11:00-05', 'panel', 'quizas')$$,
  '23514', null, 'sync ok/pendiente/error');
select lives_ok($$insert into public.citas (inicia_en, termina_en, origen)
  values ('2026-10-13 10:00-05', '2026-10-13 11:00-05', 'calendario')$$,
  'cita sin vincular (sin paciente ni gcal_event_id) se puede guardar');

-- Horario semilla: L–V 09–18, sábado 09–15, domingo cerrado
select results_eq(
  $$select dia_semana::int, abre::text, cierra::text from public.horario order by dia_semana$$,
  $$values (1,'09:00:00','18:00:00'),(2,'09:00:00','18:00:00'),(3,'09:00:00','18:00:00'),
           (4,'09:00:00','18:00:00'),(5,'09:00:00','18:00:00'),(6,'09:00:00','15:00:00')$$,
  'horario semilla');

-- Realtime
select bag_eq(
  $$select tablename::text from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'$$,
  array['pacientes','citas','mensajes'],
  'pacientes, citas y mensajes en Realtime');

-- Doctora: lee las 6 tablas
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select ok((select count(*) from public.mensajes) = 1, 'personal lee mensajes');
select ok((select count(*) from public.citas) = 2, 'personal lee citas');
select ok((select count(*) from public.cambios_etapa) >= 1, 'personal lee cambios_etapa');
select ok((select count(*) from public.horario) = 6, 'personal lee horario');
select ok((select count(*) from public.errores_integracion) = 1, 'personal lee errores_integracion');
select ok((select count(*) from public.sync_calendario) = 1, 'personal lee sync_calendario');
-- Escribe citas y horario
select lives_ok($$insert into public.citas (paciente_id, inicia_en, termina_en, origen)
  values (900001, '2026-10-14 10:00-05', '2026-10-14 11:00-05', 'panel')$$, 'personal inserta citas');
with u as (update public.citas set servicio = 'Limpieza' where gcal_event_id = 'gcal-prueba-1' returning 1)
select is((select count(*)::int from u), 1, 'personal actualiza citas');
with u as (update public.horario set cierra = '17:00' where dia_semana = 5 returning 1)
select is((select count(*)::int from u), 1, 'personal actualiza horario');
-- Solo lectura: mensajes, cambios_etapa, errores_integracion, sync_calendario
select throws_ok($$insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
  values (900001, 'falso', 'saliente', 'x', now())$$, '42501', null, 'personal no escribe mensajes');
select throws_ok($$insert into public.cambios_etapa (paciente_id, a, actor) values (900001, 'perdido', 'eli')$$,
  '42501', null, 'personal no inventa cambios_etapa');
select throws_ok($$insert into public.errores_integracion (origen, detalle) values ('eli', '{}')$$,
  '42501', null, 'personal no escribe errores_integracion');
select throws_ok($$update public.sync_calendario set sync_token = 'otro'$$,
  '42501', null, 'personal no escribe sync_calendario');

-- Ajeno: 0 filas en las 6 tablas
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select is((select count(*)::int from public.mensajes), 0, 'ajeno: 0 mensajes');
select is((select count(*)::int from public.citas), 0, 'ajeno: 0 citas');
select is((select count(*)::int from public.cambios_etapa), 0, 'ajeno: 0 cambios_etapa');
select is((select count(*)::int from public.horario), 0, 'ajeno: 0 horario');
select is((select count(*)::int from public.errores_integracion), 0, 'ajeno: 0 errores_integracion');
select is((select count(*)::int from public.sync_calendario), 0, 'ajeno: 0 sync_calendario');

-- anon: 0 filas en las 6 tablas
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.mensajes), 0, 'anon: 0 mensajes');
select is((select count(*)::int from public.citas), 0, 'anon: 0 citas');
select is((select count(*)::int from public.cambios_etapa), 0, 'anon: 0 cambios_etapa');
select is((select count(*)::int from public.horario), 0, 'anon: 0 horario');
select is((select count(*)::int from public.errores_integracion), 0, 'anon: 0 errores_integracion');
select is((select count(*)::int from public.sync_calendario), 0, 'anon: 0 sync_calendario');
reset role;

select * from finish();
rollback;
