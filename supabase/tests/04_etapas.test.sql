-- TK-5 · mover_etapa y marcar_asistencia; historial en cambios_etapa. Datos inventados.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');
insert into public.pacientes (id, nombre, origen, etapa_cambiada_en) overriding system value values
  (900001, 'Ana Inventada', 'llamada', '2026-01-01'),
  (900002, 'Beto Inventado', 'presencial', '2026-01-01'),
  (900003, 'Caro Inventada', 'referido', '2026-01-01'),
  (900004, 'Dani Inventado', 'llamada', '2026-01-01');
insert into public.citas (id, paciente_id, inicia_en, termina_en, origen) overriding system value values
  (900001, 900002, '2026-10-12 10:00-05', '2026-10-12 11:00-05', 'panel'),
  (900002, 900003, '2026-10-12 11:00-05', '2026-10-12 12:00-05', 'panel'),
  (900003, 900004, '2026-10-12 12:00-05', '2026-10-12 13:00-05', 'panel'),
  (900004, 900001, '2026-10-12 14:00-05', '2026-10-12 15:00-05', 'panel'),
  (900005, null,   '2026-10-12 16:00-05', '2026-10-12 17:00-05', 'calendario');

select has_function('public', 'mover_etapa', 'existe mover_etapa');
select has_function('public', 'marcar_asistencia', 'existe marcar_asistencia');
select results_eq($$select de::text, a::text from public.cambios_etapa where paciente_id = 900001$$,
  $$values (null::text, 'nuevo')$$, 'crear un paciente deja su primera etapa en el historial');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

-- mover_etapa
select throws_ok($$select public.mover_etapa(900001, 'perdido')$$, '22023',
  'Para mover a Perdido hace falta el motivo', 'Perdido sin motivo falla');
select is((select etapa::text from public.mover_etapa(900001, 'conversando')), 'conversando',
  'mover a Conversando');
select results_eq(
  $$select de::text, a::text, actor::text, personal_id::text from public.cambios_etapa
     where paciente_id = 900001 and de is not null order by id$$,
  $$values ('nuevo', 'conversando', 'personal', '00000000-0000-0000-0000-0000000000d1')$$,
  'el cambio queda con actor personal y quién');
select is((select etapa_cambiada_en from public.pacientes where id = 900001), now(),
  'etapa_cambiada_en se actualiza');
select results_eq($$select etapa::text, motivo_perdido::text from public.mover_etapa(900001, 'perdido', 'indeciso')$$,
  $$values ('perdido', 'indeciso')$$, 'Perdido con motivo');
select is((select motivo_perdido::text from public.cambios_etapa where paciente_id = 900001 order by id desc limit 1),
  'indeciso', 'el motivo queda en el historial');
select results_eq($$select etapa::text, motivo_perdido::text from public.mover_etapa(900001, 'conversando', 'indeciso')$$,
  $$values ('conversando', null::text)$$, 'al salir de Perdido se borra el motivo');
select is((select count(*)::int from public.cambios_etapa where paciente_id = 900001), 4,
  'historial: nuevo, conversando, perdido, conversando');
select lives_ok($$select public.mover_etapa(900001, 'conversando')$$, 'mover a la misma etapa no falla');
select is((select count(*)::int from public.cambios_etapa where paciente_id = 900001), 4,
  'mover a la misma etapa no ensucia el historial');
select throws_ok($$select public.mover_etapa(999999, 'agendo')$$, 'P0002', 'Paciente no encontrado',
  'paciente inexistente');

-- marcar_asistencia
select is((select estado::text from public.marcar_asistencia(900001, true)), 'asistio', 'cita → asistio');
select results_eq($$select etapa::text, volver_el from public.pacientes where id = 900002$$,
  $$select 'seguimiento', ((now() at time zone 'America/Guayaquil')::date + interval '6 months')::date$$,
  'Asistió → Seguimiento y volver_el = hoy + 6 meses');
select lives_ok($$select public.marcar_asistencia(900002, true, '2027-01-15')$$, 'Asistió con fecha de retorno');
select is((select volver_el from public.pacientes where id = 900003), '2027-01-15'::date, 'volver_el = fecha dada');
select lives_ok($$select public.marcar_asistencia(900003, true, null)$$, 'Asistió sin retorno');
select is((select volver_el from public.pacientes where id = 900004), null, 'volver_el vacío (sin retorno)');
select is((select estado::text from public.marcar_asistencia(900004, false)), 'no_asistio', 'cita → no_asistio');
select results_eq($$select etapa::text, motivo_perdido::text from public.pacientes where id = 900001$$,
  $$values ('perdido', 'no_asistio')$$, 'No asistió → Perdido (no_asistio)');
select throws_ok($$select public.marcar_asistencia(900005, true)$$, '22023',
  'La cita no está vinculada a un paciente', 'cita sin vincular falla');

-- Ajeno y anon no pueden
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.mover_etapa(900001, 'agendo')$$, '42501', null, 'ajeno no mueve etapas');
select throws_ok($$select public.marcar_asistencia(900001, true)$$, '42501', null, 'ajeno no marca asistencia');
reset role;
set local role anon;
select throws_ok($$select public.mover_etapa(900001, 'agendo')$$, '42501', null, 'anon no puede ejecutar');
reset role;

select * from finish();
rollback;
