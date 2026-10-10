-- TK-2 · personal, conversaciones, pacientes y datos_clinicos: RLS y restricciones.
-- Datos inventados. Usuarios: doctora (en personal) y ajeno (autenticado, fuera de personal).
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

insert into public.conversaciones (id, telefono, nombre_whatsapp)
  overriding system value values (900001, '593990000001', 'Ana Inventada');
insert into public.pacientes (id, conversacion_id, nombre, origen, consentimiento_firmado_en)
  overriding system value values (900001, 900001, 'Ana Inventada', 'whatsapp', now());
insert into public.datos_clinicos (paciente_id, alergias) values (900001, 'ninguna');

-- Estructura
select has_table('public', t, 'existe ' || t)
  from unnest(array['personal','conversaciones','pacientes','datos_clinicos']) t;
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('personal','conversaciones','pacientes','datos_clinicos')
      and c.relrowsecurity),
  4, 'RLS activado en las 4 tablas');
select enum_has_labels('public', 'etapa',
  array['nuevo','conversando','agendo','asistio','seguimiento','perdido'], 'enum etapa');

-- Toda FK tiene índice que empieza por esa columna
select is_empty($$
  select c.conrelid::regclass::text || '.' || a.attname
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
$$, 'todas las FK de public tienen índice');

-- Restricciones
select throws_ok($$insert into public.conversaciones (telefono) values ('0990000002')$$,
  '23514', null, 'teléfono que no empieza con 593 falla');
select throws_ok($$insert into public.conversaciones (telefono) values ('5939900')$$,
  '23514', null, 'teléfono 593 demasiado corto falla');
select lives_ok($$insert into public.conversaciones (telefono) values ('593990000003')$$,
  'teléfono 593 + 9 dígitos se guarda');
select throws_ok($$insert into public.conversaciones (telefono) values ('593990000001')$$,
  '23505', null, 'teléfono duplicado falla');
select throws_ok(
  $$insert into public.pacientes (conversacion_id, nombre, origen) values (900001, 'Otro Titular', 'whatsapp')$$,
  '23505', null, 'un solo titular por conversación');
select lives_ok(
  $$insert into public.pacientes (conversacion_id, responsable_id, nombre, origen)
    values (900001, 900001, 'Niño Inventado', 'whatsapp')$$,
  'un dependiente sí comparte la conversación');
select throws_ok(
  $$insert into public.pacientes (nombre, origen, etapa) values ('Sin Motivo', 'llamada', 'perdido')$$,
  '23514', null, 'perdido sin motivo falla');
select throws_ok(
  $$insert into public.pacientes (nombre, origen, motivo_perdido) values ('Motivo Sobra', 'llamada', 'indeciso')$$,
  '23514', null, 'motivo sin perdido falla');

-- Doctora (personal): lee y escribe
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select ok((select count(*) from public.pacientes) >= 1, 'personal lee pacientes');
select ok((select count(*) from public.conversaciones) >= 1, 'personal lee conversaciones');
select is((select count(*)::int from public.datos_clinicos), 1, 'personal lee datos_clinicos');
select is((select count(*)::int from public.personal), 1, 'personal lee personal');
select lives_ok($$insert into public.pacientes (nombre, origen) values ('Beto Inventado', 'llamada')$$,
  'personal inserta pacientes');
with u as (update public.pacientes set cedula = '0000000000' where id = 900001 returning 1)
select is((select count(*)::int from u), 1, 'personal actualiza pacientes');
with u as (update public.datos_clinicos set miedo = 'agujas' where paciente_id = 900001 returning 1)
select is((select count(*)::int from u), 1, 'personal actualiza datos_clinicos');

-- Autenticado ajeno: 0 filas y no escribe
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select is((select count(*)::int from public.pacientes), 0, 'ajeno ve 0 pacientes');
select is((select count(*)::int from public.conversaciones), 0, 'ajeno ve 0 conversaciones');
select is((select count(*)::int from public.datos_clinicos), 0, 'ajeno ve 0 datos_clinicos');
select throws_ok($$insert into public.pacientes (nombre, origen) values ('Intruso', 'llamada')$$,
  '42501', null, 'ajeno no inserta pacientes');

-- anon: 0 filas
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pacientes), 0, 'anon ve 0 pacientes');
select is((select count(*)::int from public.datos_clinicos), 0, 'anon ve 0 datos_clinicos');
reset role;

select * from finish();
rollback;
