-- TK-9 · private.perdidos_por_silencio(): sin cita futura y 24 h sin escribir → Perdido (no_respondio).
-- Fechas simuladas con p_ahora = 2026-10-12 12:00 (-05). Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(12);

insert into public.conversaciones (id, telefono, ultimo_entrante_en, turnos_entrantes) overriding system value values
  (900001, '593900000001', '2026-10-11 11:00-05', 1),  -- 25 h: nuevo → perdido
  (900002, '593900000002', '2026-10-11 10:00-05', 3),  -- 26 h: conversando → perdido
  (900003, '593900000003', '2026-10-11 13:00-05', 2),  -- 23 h: no cambia
  (900004, '593900000004', '2026-10-10 09:00-05', 2),  -- viejo pero con cita futura: no cambia
  (900005, '593900000005', '2026-10-10 09:00-05', 2),  -- viejo, en agendo: no cambia
  (900006, '593900000006', '2026-10-10 09:00-05', 2),  -- cita pasada o cancelada: → perdido
  (900007, '593900000007', null, 0);                   -- creado a mano, nunca escribió: no cambia
insert into public.pacientes (id, conversacion_id, responsable_id, nombre, origen, etapa) overriding system value values
  (900001, 900001, null, 'Paciente Uno', 'whatsapp', 'nuevo'),
  (900002, 900002, null, 'Paciente Dos', 'whatsapp', 'conversando'),
  (900003, 900003, null, 'Paciente Tres', 'whatsapp', 'conversando'),
  (900004, 900004, null, 'Paciente Cuatro', 'whatsapp', 'conversando'),
  (900005, 900005, null, 'Paciente Cinco', 'whatsapp', 'agendo'),
  (900006, 900006, null, 'Paciente Seis', 'whatsapp', 'conversando'),
  (900007, 900007, null, 'Paciente Siete', 'llamada', 'nuevo'),
  (900008, 900001, 900001, 'Dependiente Uno', 'presencial', 'nuevo'); -- dependiente: no lo mueve
insert into public.citas (paciente_id, inicia_en, termina_en, origen, estado) values
  (900004, '2026-10-20 10:00-05', '2026-10-20 11:00-05', 'eli', 'agendada'),
  (900006, '2026-10-11 10:00-05', '2026-10-11 11:00-05', 'eli', 'agendada'),
  (900006, '2026-10-14 10:00-05', '2026-10-14 11:00-05', 'eli', 'cancelada');

select is(private.perdidos_por_silencio('2026-10-12 12:00-05'), 3, 'mueve 3 pacientes');
select results_eq($$select id, etapa::text, motivo_perdido::text from public.pacientes order by id$$,
  $$values (900001::bigint, 'perdido', 'no_respondio'),
           (900002::bigint, 'perdido', 'no_respondio'),
           (900003::bigint, 'conversando', null),
           (900004::bigint, 'conversando', null),
           (900005::bigint, 'agendo', null),
           (900006::bigint, 'perdido', 'no_respondio'),
           (900007::bigint, 'nuevo', null),
           (900008::bigint, 'nuevo', null)$$,
  'solo Nuevo/Conversando titulares, sin cita futura y con más de 24 h');
select is((select count(*)::int from public.cambios_etapa
            where a = 'perdido' and motivo_perdido = 'no_respondio' and actor = 'sistema'), 3,
  'historial con actor sistema y motivo no_respondio');
select is((select actor::text from public.auditoria
            where tabla = 'pacientes' and fila_id = 900001 and accion = 'update'), 'sistema',
  'auditoría con actor sistema');
select is(private.perdidos_por_silencio('2026-10-12 12:00-05'), 0, 'repetir no mueve a nadie más');

-- Aunque la sesión traiga otro app.actor, la tarea queda como sistema
select set_config('app.actor', 'eli', true);
update public.pacientes set etapa = 'conversando', motivo_perdido = null where id = 900003;
select is(private.perdidos_por_silencio('2026-10-13 14:00-05'), 1, 'un día después cae el de 23 h');
select is((select actor::text from public.cambios_etapa where paciente_id = 900003 order by id desc limit 1),
  'sistema', 'actor sistema aunque app.actor diga otra cosa');

-- Volver a escribir lo saca de Perdido (regla de TK-7, se comprueba junto)
set local role service_role;
select is(public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"593900000001","message_id":"wamid.v1"}')->>'ok',
  'true', 'vuelve a escribir');
reset role;
select is((select etapa::text from public.pacientes where id = 900001), 'conversando', 'Perdido → Conversando');

-- Permisos y programación
select is(has_function_privilege('authenticated', 'private.perdidos_por_silencio(timestamptz)', 'execute'), false,
  'la API no puede ejecutarla');
select results_eq($$select schedule, command from cron.job where jobname = 'perdidos-por-silencio'$$,
  $$values ('*/15 * * * *'::text, 'select private.perdidos_por_silencio()'::text)$$,
  'cron.job cada 15 min');
select is((select count(*)::int from cron.job where jobname = 'perdidos-por-silencio'), 1, 'un solo job');

select * from finish();
rollback;
