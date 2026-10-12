-- TK-10 · resumen_del_dia(fecha). Fecha de prueba: miércoles 2026-10-14; semana lun 12 – dom 18.
-- Hora de Guayaquil (-05). Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

insert into public.pacientes (id, nombre, origen, created_at, fecha_nacimiento, volver_el) overriding system value values
  (900001, 'Ana Uno',    'whatsapp',   '2026-10-14 10:00-05', '1990-10-14', null),         -- nueva hoy, cumple hoy
  (900002, 'Beto Dos',   'llamada',    '2026-10-12 09:00-05', '1985-10-17', '2026-10-10'), -- cumple en la semana, retorno vencido
  (900003, 'Caro Tres',  'whatsapp',   '2026-10-13 23:30-05', null,         '2026-10-18'), -- 23:30 local = 14 en UTC; retorno el domingo
  (900004, 'Dani Cuatro','referido',   '2026-10-05 09:00-05', '2000-02-29', '2026-10-15'), -- retorno pero con cita futura
  (900005, 'Eva Cinco',  'presencial', '2026-10-19 00:30-05', '1970-10-19', '2026-10-25'); -- semana siguiente
insert into public.citas (id, paciente_id, inicia_en, termina_en, servicio, estado, origen) overriding system value values
  (900001, 900004, '2026-10-14 11:00-05', '2026-10-14 12:00-05', 'Control',  'agendada',   'panel'),
  (900002, 900002, '2026-10-14 09:00-05', '2026-10-14 10:00-05', 'Limpieza', 'asistio',    'eli'),
  (900003, 900001, '2026-10-14 15:00-05', '2026-10-14 16:00-05', 'Limpieza', 'cancelada',  'eli'),
  (900004, null,   '2026-10-14 10:00-05', '2026-10-14 11:00-05', null,       'agendada',   'calendario'),
  (900005, 900003, '2026-10-16 10:00-05', '2026-10-16 11:00-05', 'Blanqueo', 'no_asistio', 'eli'),
  (900006, 900004, '2026-10-20 10:00-05', '2026-10-20 11:00-05', 'Control',  'agendada',   'panel'),
  (900007, 900002, '2026-10-11 10:00-05', '2026-10-11 11:00-05', 'Control',  'no_asistio', 'panel');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
create temp table r as select public.resumen_del_dia('2026-10-14') as j;

select is((select j->'semana' from r), '{"desde":"2026-10-12","hasta":"2026-10-18"}'::jsonb, 'semana lunes a domingo');
select is((select jsonb_agg(c->'id') from r, jsonb_array_elements(j->'citas_hoy') c),
  '[900002, 900004, 900001, 900003]'::jsonb, 'citas de hoy ordenadas por hora');
select is((select ((j->'citas_hoy'->0) - 'inicia_en') - 'termina_en' from r),
  '{"id":900002,"estado":"asistio","origen":"eli","servicio":"Limpieza","paciente_id":900002,"paciente_nombre":"Beto Dos"}'::jsonb,
  'cada cita trae paciente, servicio y estado');
select is((select (j->'citas_hoy'->0->>'inicia_en')::timestamptz from r), '2026-10-14 09:00-05'::timestamptz, 'con su hora');
select is((select j->'citas_hoy'->1->'paciente_id' from r), 'null'::jsonb, 'la cita sin vincular también sale');
select is((select j->'numeros' from r),
  '{"citas_hoy":3,"nuevos_hoy":1,"nuevos_semana":3,"agendadas_semana":4,"inasistencias_semana":1}'::jsonb,
  'números: citas de hoy sin canceladas, nuevos, agendadas e inasistencias de la semana');
select is((select j->'canales' from r),
  '[{"origen":"whatsapp","nuevos":2,"agendadas":1,"inasistencias":1},
    {"origen":"llamada","nuevos":1,"agendadas":1,"inasistencias":0},
    {"origen":"presencial","nuevos":0,"agendadas":0,"inasistencias":0},
    {"origen":"referido","nuevos":0,"agendadas":1,"inasistencias":0}]'::jsonb,
  'por canal (origen del paciente)');
select is((select jsonb_agg(d->'nuevos') from r, jsonb_array_elements(j->'nuevos_por_dia') d),
  '[1,1,1,0,0,0,0]'::jsonb, 'nuevos por día (hora local: 23:30 del 13 cuenta el 13)');
select is((select jsonb_agg(c->'id') from r, jsonb_array_elements(j->'cumpleanos_hoy') c),
  '[900001]'::jsonb, 'cumpleaños de hoy');
select is((select jsonb_agg(c->'id') from r, jsonb_array_elements(j->'cumpleanos_semana') c),
  '[900001, 900002]'::jsonb, 'cumpleaños de la semana (incluye hoy)');
select is((select j->'cumpleanos_semana'->1->>'cumple' from r), '2026-10-17', 'con el día que cumple');
select is((select jsonb_agg(c->'id') from r, jsonb_array_elements(j->'retornos') c),
  '[900002, 900003]'::jsonb, 'retornos vencidos o de esta semana sin cita futura');

-- 29 de febrero en año no bisiesto → se celebra el 28
select is((select jsonb_agg(c->'id') from jsonb_array_elements(public.resumen_del_dia('2027-02-28')->'cumpleanos_hoy') c),
  '[900004]'::jsonb, '29-feb cumple el 28-feb en año no bisiesto');
-- Día sin nada: listas vacías, no null
select is((select public.resumen_del_dia('2030-01-01')->'citas_hoy'), '[]'::jsonb, 'sin citas → lista vacía');
select is((select public.resumen_del_dia('2030-01-01')->'numeros'->'citas_hoy'), '0'::jsonb, 'sin citas → 0');
-- Sin fecha: hoy en Guayaquil
select is((select public.resumen_del_dia()->>'fecha'), ((now() at time zone 'America/Guayaquil')::date)::text,
  'por defecto, hoy en Guayaquil');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.resumen_del_dia('2026-10-14')$$, '42501', null, 'ajeno no ve el resumen');
reset role;

select * from finish();
rollback;
