-- TK-6 · crear_paciente, guardar_cita y cancelar_cita. Datos inventados.
-- Fechas: lunes 2026-10-12, domingo 2026-10-11, sábado 2026-10-17 (hora de Guayaquil, -05).
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(37);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'ajeno@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

-- Normalización del teléfono
select is(private.normalizar_telefono('0991234567'), '593991234567', '09… → 5939…');
select is(private.normalizar_telefono('+593 99 123 4567'), '593991234567', '+593 con espacios');
select is(private.normalizar_telefono('991234567'), '593991234567', 'móvil sin 0');
select is(private.normalizar_telefono('00593991234567'), '593991234567', 'prefijo 00593');
select is(private.normalizar_telefono('02 234 5678'), '59322345678', 'fijo 02…');
select is(private.normalizar_telefono('  '), null, 'vacío → null');
select throws_ok($$select private.normalizar_telefono('12345')$$, '22023', 'Teléfono no válido', 'teléfono inválido');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

-- crear_paciente
create temp table r as
  select public.crear_paciente(p_nombre => 'Ana Inventada', p_origen => 'llamada',
                               p_telefono => '0991234567', p_cedula => '0000000001') as j;
select is((select (j->>'duplicado')::boolean from r), false, 'paciente nuevo: duplicado = false');
select results_eq(
  $$select c.telefono, p.etapa::text, p.origen::text, p.responsable_id
      from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
     where p.id = (select (j->'paciente'->>'id')::bigint from r)$$,
  $$values ('593991234567', 'nuevo', 'llamada', null::bigint)$$,
  '09… se guarda como 5939…, en Nuevo, como titular');

select results_eq(
  $$select (j->>'duplicado')::boolean, (j->'paciente'->>'id')::bigint
      from (select public.crear_paciente(p_nombre => 'Otra Persona', p_origen => 'presencial',
                                         p_telefono => '+593 99 123 4567') as j) x$$,
  $$select true, (j->'paciente'->>'id')::bigint from r$$,
  'teléfono duplicado devuelve la ficha existente');
select is((select count(*)::int from public.pacientes), 1, 'el duplicado no crea otra ficha');

select results_eq(
  $$select (j->>'duplicado')::boolean, (j->'paciente'->>'responsable_id')::bigint,
           (j->'paciente'->>'conversacion_id')::bigint
      from (select public.crear_paciente(p_nombre => 'Niño Inventado', p_origen => 'presencial',
              p_telefono => '0991234567',
              p_responsable_id => (select (j->'paciente'->>'id')::bigint from r)) as j) x$$,
  $$select false, (j->'paciente'->>'id')::bigint, (j->'paciente'->>'conversacion_id')::bigint from r$$,
  'con responsable se crea el dependiente en la misma conversación');

select is((select (public.crear_paciente(p_nombre => 'Sin Teléfono', p_origen => 'referido')
                  ->'paciente'->>'conversacion_id')), null, 'sin teléfono: sin conversación');
select throws_ok($$select public.crear_paciente(p_nombre => 'X', p_origen => 'llamada', p_telefono => '123')$$,
  '22023', 'Teléfono no válido', 'teléfono inválido no crea paciente');
select throws_ok($$select public.crear_paciente(p_nombre => 'X', p_origen => 'llamada', p_responsable_id => 999999)$$,
  'P0002', 'Responsable no encontrado', 'responsable inexistente');

-- guardar_cita
create temp table pa as select (j->'paciente'->>'id')::bigint as id from r;
create temp table c1 as
  select * from public.guardar_cita(p_paciente_id => (select id from pa),
                                    p_inicia_en => '2026-10-12 10:00-05', p_servicio => 'Limpieza');
select is((select termina_en from c1), '2026-10-12 11:00-05'::timestamptz, '1 h por defecto');
select results_eq($$select estado::text, origen::text, sync from c1$$,
  $$values ('agendada', 'panel', 'pendiente')$$, 'cita nueva: agendada, panel, sync pendiente');
select is((select etapa::text from public.pacientes where id = (select id from pa)), 'agendo',
  'cita nueva → paciente Agendó');
select is((select actor::text from public.cambios_etapa where paciente_id = (select id from pa) order by id desc limit 1),
  'personal', 'el paso a Agendó queda en el historial');

select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-12 10:30-05')$$,
  '23P01', 'Ya hay otra cita en ese horario', 'choque con otra cita falla');
select lives_ok($$select public.guardar_cita(p_paciente_id => (select id from pa),
  p_inicia_en => '2026-10-12 11:00-05', p_termina_en => '2026-10-12 11:30-05')$$,
  'cita pegada a otra (sin solaparse) y con duración propia');
select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-11 10:00-05')$$,
  '22023', 'La cita está fuera del horario del consultorio', 'domingo: fuera de horario');
select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-12 08:00-05')$$,
  '22023', 'La cita está fuera del horario del consultorio', 'antes de abrir');
select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-12 17:30-05')$$,
  '22023', 'La cita está fuera del horario del consultorio', 'termina después de cerrar');
select lives_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-17 14:00-05')$$,
  'sábado 14:00–15:00 dentro de horario');
select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-17 14:30-05')$$,
  '22023', 'La cita está fuera del horario del consultorio', 'sábado después de las 15:00');
select throws_ok($$select public.guardar_cita(p_paciente_id => (select id from pa),
  p_inicia_en => '2026-10-12 12:00-05', p_termina_en => '2026-10-12 12:00-05')$$,
  '22023', 'La cita debe terminar después de empezar', 'duración cero');

-- Mover una cita
reset role;
update public.citas set sync = 'ok' where id = (select id from c1);
set local role authenticated;
select results_eq(
  $$select inicia_en, termina_en, sync from public.guardar_cita(p_cita_id => (select id from c1),
      p_paciente_id => (select id from pa), p_inicia_en => '2026-10-12 15:00-05', p_servicio => 'Limpieza')$$,
  $$values ('2026-10-12 15:00-05'::timestamptz, '2026-10-12 16:00-05'::timestamptz, 'pendiente')$$,
  'mover la cita: nueva hora y sync pendiente');
select lives_ok($$select public.guardar_cita(p_cita_id => (select id from c1), p_paciente_id => (select id from pa),
  p_inicia_en => '2026-10-12 15:30-05')$$, 'moverla encima de sí misma no es choque');
select throws_ok($$select public.guardar_cita(p_cita_id => 999999, p_paciente_id => (select id from pa),
  p_inicia_en => '2026-10-12 16:00-05')$$, 'P0002', 'Cita no encontrada', 'mover cita inexistente');

-- cancelar_cita
select results_eq($$select estado::text, sync from public.cancelar_cita((select id from c1))$$,
  $$values ('cancelada', 'pendiente')$$, 'cancelar → cancelada + sync pendiente');
select lives_ok($$select public.guardar_cita(p_paciente_id => (select id from pa), p_inicia_en => '2026-10-12 15:00-05')$$,
  'una cita cancelada no choca');
select lives_ok($$select public.cancelar_cita((select id from c1))$$, 'cancelar dos veces no falla');
select throws_ok($$select public.guardar_cita(p_cita_id => (select id from c1), p_paciente_id => (select id from pa),
  p_inicia_en => '2026-10-13 10:00-05')$$, '22023', 'Solo se puede editar una cita agendada', 'no se mueve una cancelada');

-- Ajeno
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.crear_paciente(p_nombre => 'Intruso', p_origen => 'llamada')$$,
  '42501', null, 'ajeno no crea pacientes');
select throws_ok($$select public.guardar_cita(p_paciente_id => 1, p_inicia_en => '2026-10-13 10:00-05')$$,
  '42501', null, 'ajeno no guarda citas');
select throws_ok($$select public.cancelar_cita(1)$$, '42501', null, 'ajeno no cancela citas');
reset role;

select * from finish();
rollback;
