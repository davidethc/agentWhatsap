-- TK-4 · Auditoría por trigger y consentimiento para datos clínicos. Datos inventados.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');
insert into public.pacientes (id, nombre, origen, consentimiento_firmado_en)
  overriding system value values (900001, 'Ana Inventada', 'llamada', now());
insert into public.pacientes (id, nombre, origen)
  overriding system value values (900002, 'Beto Sinfirma', 'presencial');
insert into public.citas (id, paciente_id, inicia_en, termina_en, origen)
  overriding system value values (900001, 900001, '2026-10-12 10:00-05', '2026-10-12 11:00-05', 'panel');

select has_table('public', 'auditoria', 'existe auditoria');

-- La doctora edita: queda auditado con antes, después y actor
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

update public.pacientes set cedula = '1111111111' where id = 900001;
select results_eq(
  $$select accion, antes->>'cedula', despues->>'cedula', actor::text, personal_id::text
      from public.auditoria where tabla = 'pacientes' and fila_id = 900001 and accion = 'update'$$,
  $$values ('update', null::text, '1111111111', 'personal', '00000000-0000-0000-0000-0000000000d1')$$,
  'editar paciente deja antes, después y actor');

update public.citas set servicio = 'Limpieza' where id = 900001;
select results_eq(
  $$select antes->>'servicio', despues->>'servicio', actor::text
      from public.auditoria where tabla = 'citas' and fila_id = 900001 and accion = 'update'$$,
  $$values (null::text, 'Limpieza', 'personal')$$,
  'editar cita deja antes, después y actor');

insert into public.datos_clinicos (paciente_id, alergias) values (900001, 'penicilina');
update public.datos_clinicos set alergias = 'ninguna' where paciente_id = 900001;
select results_eq(
  $$select antes->>'alergias', despues->>'alergias', actor::text
      from public.auditoria where tabla = 'datos_clinicos' and fila_id = 900001 and accion = 'update'$$,
  $$values ('penicilina', 'ninguna', 'personal')$$,
  'editar datos clínicos deja antes, después y actor');
select is((select count(*)::int from public.auditoria
            where tabla = 'datos_clinicos' and accion = 'insert'), 1, 'la creación también se audita');

-- Un update sin cambios reales no ensucia la auditoría
update public.pacientes set cedula = '1111111111' where id = 900001;
select is((select count(*)::int from public.auditoria where tabla = 'pacientes' and accion = 'update'),
  1, 'update sin cambios no se audita');

-- Consentimiento
select throws_ok($$insert into public.datos_clinicos (paciente_id, alergias) values (900002, 'polen')$$,
  'P0001', 'Falta el consentimiento firmado del paciente', 'sin consentimiento no se guardan datos clínicos');
select throws_ok($$update public.datos_clinicos set paciente_id = 900002 where paciente_id = 900001$$,
  'P0001', 'Falta el consentimiento firmado del paciente', 'tampoco moviéndolos a otro paciente');

-- Nadie edita ni borra la auditoría
select throws_ok($$update public.auditoria set actor = 'eli'$$, '42501', null, 'personal no edita auditoria');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'personal no borra auditoria');
select throws_ok($$insert into public.auditoria (tabla, fila_id, accion, actor) values ('pacientes', 1, 'update', 'eli')$$,
  '42501', null, 'personal no inserta en auditoria');
select ok((select count(*) from public.auditoria) > 0, 'personal lee auditoria');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select is((select count(*)::int from public.auditoria), 0, 'ajeno: 0 filas de auditoria');
reset role;

set local role service_role;
select throws_ok($$update public.auditoria set actor = 'eli'$$, '42501', null, 'service_role no edita auditoria');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'service_role no borra auditoria');
reset role;

-- Ni siquiera el dueño (postgres): el trigger lo impide
select throws_ok($$update public.auditoria set actor = 'eli'$$, 'P0001',
  'La auditoría no se puede editar ni borrar', 'postgres no edita auditoria');
select throws_ok($$delete from public.auditoria$$, 'P0001',
  'La auditoría no se puede editar ni borrar', 'postgres no borra auditoria');
select throws_ok($$truncate public.auditoria$$, 'P0001',
  'La auditoría no se puede editar ni borrar', 'postgres no trunca auditoria');

-- Integraciones: el actor viene de app.actor (sin sesión de usuario)
select set_config('request.jwt.claims', '', true);
select set_config('app.actor', 'eli', true);
update public.pacientes set correo = 'ana@ejemplo.test' where id = 900001;
select is((select actor::text from public.auditoria
            where tabla = 'pacientes' and despues->>'correo' = 'ana@ejemplo.test'), 'eli',
  'actor = eli cuando escribe la integración');
select set_config('app.actor', '', true);
update public.pacientes set correo = 'ana2@ejemplo.test' where id = 900001;
select is((select actor::text from public.auditoria
            where tabla = 'pacientes' and despues->>'correo' = 'ana2@ejemplo.test'), 'sistema',
  'sin sesión ni app.actor, actor = sistema');

select * from finish();
rollback;
