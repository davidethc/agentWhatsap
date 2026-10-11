-- TK-39 · Permisos por columna: el personal edita solo los datos básicos del paciente; etapas,
-- citas y conversaciones cambian solo por funciones. anon sin privilegios en public. Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');
insert into public.conversaciones (id, telefono) overriding system value values (900001, '593990000001');
insert into public.pacientes (id, conversacion_id, nombre, origen)
  overriding system value values (900001, 900001, 'Ana Inventada', 'whatsapp');

-- ── anon: ningún privilegio de tabla en public ──
select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee = 'anon'), 0, 'anon sin privilegios de tabla en public');

-- ── Funciones del panel: security definer con search_path fijo ──
select is((select count(*)::int from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('mover_etapa','marcar_asistencia','crear_paciente','guardar_cita','cancelar_cita')
              and p.prosecdef and p.proconfig @> array['search_path=""']), 5,
  'las 5 funciones del panel son security definer con search_path vacío');

-- ── Doctora ──
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

-- Datos básicos y consentimiento: sí
select lives_ok($$update public.pacientes set nombre = 'Ana María Inventada', cedula = '0000000001',
  fecha_nacimiento = '1990-01-01', correo = 'ana@ejemplo.test' where id = 900001$$, 'edita datos básicos');
select lives_ok($$update public.pacientes set consentimiento_firmado_en = now() where id = 900001$$,
  'marca el consentimiento firmado');
select is((select actor::text || '/' || (personal_id is not null)::text from public.auditoria
            where tabla = 'pacientes' and fila_id = 900001 and accion = 'update' order by id desc limit 1),
  'personal/true', 'la edición queda auditada con la doctora');

-- Lo demás de pacientes: no
select throws_ok($$update public.pacientes set etapa = 'perdido', motivo_perdido = 'indeciso' where id = 900001$$,
  '42501', null, 'no cambia la etapa sin mover_etapa');
select throws_ok($$update public.pacientes set responsable_id = null where id = 900001$$,
  '42501', null, 'no cambia responsable_id');
select throws_ok($$update public.pacientes set conversacion_id = null where id = 900001$$,
  '42501', null, 'no cambia conversacion_id');
select throws_ok($$update public.pacientes set volver_el = '2027-01-01' where id = 900001$$,
  '42501', null, 'no cambia volver_el sin marcar_asistencia');
select throws_ok($$update public.pacientes set created_at = now() where id = 900001$$,
  '42501', null, 'no cambia created_at');
select throws_ok($$insert into public.pacientes (nombre, origen) values ('Directo', 'presencial')$$,
  '42501', null, 'no inserta pacientes sin crear_paciente');
select throws_ok($$delete from public.pacientes where id = 900001$$, '42501', null, 'no borra pacientes');

-- Por funciones: sí
select lives_ok($$select public.mover_etapa(900001, 'conversando')$$, 'mover_etapa funciona');
select results_eq($$select etapa::text from public.pacientes where id = 900001$$,
  $$values ('conversando')$$, 'etapa cambiada por mover_etapa');
select results_eq($$select a::text, actor::text, (personal_id is not null) from public.cambios_etapa
                    where paciente_id = 900001 order by id desc limit 1$$,
  $$values ('conversando', 'personal', true)$$, 'el historial guarda a la doctora como actor');
select is((public.crear_paciente('Beto Inventado', 'presencial')->>'duplicado'), 'false', 'crear_paciente funciona');

-- conversaciones: solo por funciones
select throws_ok($$insert into public.conversaciones (telefono) values ('593990000002')$$,
  '42501', null, 'no inserta conversaciones');
select throws_ok($$update public.conversaciones set turnos_entrantes = 99 where id = 900001$$,
  '42501', null, 'no edita conversaciones');

-- citas: solo por funciones
select throws_ok($$insert into public.citas (paciente_id, inicia_en, termina_en, origen)
  values (900001, '2026-11-16 10:00-05', '2026-11-16 11:00-05', 'panel')$$, '42501', null, 'no inserta citas directo');
select lives_ok($$select public.guardar_cita(900001, '2026-11-16 10:00-05')$$, 'guardar_cita funciona');
select throws_ok($$update public.citas set estado = 'cancelada'$$, '42501', null, 'no edita citas directo');
select lives_ok($$select public.cancelar_cita((select id from public.citas where paciente_id = 900001 limit 1))$$,
  'cancelar_cita funciona');

-- datos_clinicos: el panel los llena directo (con consentimiento), pero no cambia de paciente
select lives_ok($$insert into public.datos_clinicos (paciente_id, alergias) values (900001, 'Ninguna inventada')$$,
  'llena datos clínicos');
select lives_ok($$update public.datos_clinicos set miedo = 'Leve' where paciente_id = 900001$$, 'edita datos clínicos');
select throws_ok($$update public.datos_clinicos set paciente_id = 900002 where paciente_id = 900001$$,
  '42501', null, 'no mueve datos clínicos a otro paciente');

-- horario: solo apertura y cierre
select lives_ok($$update public.horario set cierra = '17:00' where dia_semana = 5$$, 'edita el horario');
select throws_ok($$update public.horario set created_at = now() where dia_semana = 5$$,
  '42501', null, 'no toca created_at del horario');

-- ── Ajeno: las funciones siguen cerradas aunque sean security definer ──
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.mover_etapa(900001, 'perdido', 'indeciso')$$, '42501', null, 'ajeno: no mueve etapas');
select throws_ok($$select public.crear_paciente('Intruso', 'presencial')$$, '42501', null, 'ajeno: no crea pacientes');
select throws_ok($$select public.guardar_cita(900001, '2026-11-17 10:00-05')$$, '42501', null, 'ajeno: no guarda citas');
reset role;

select * from finish();
rollback;
