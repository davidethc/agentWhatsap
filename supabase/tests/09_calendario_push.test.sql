-- TK-15 · Funciones de base para el push a Google Calendar. Datos inventados.
begin;
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(25);

select has_function('public', 'calendario_citas_pendientes', array['integer'], 'existe calendario_citas_pendientes');
select has_function('public', 'calendario_marcar_push', array['bigint', 'text', 'text', 'text'], 'existe calendario_marcar_push');
select has_function('public', 'calendario_registrar_error', array['jsonb', 'integer'], 'existe calendario_registrar_error');

-- Solo la clave de servicio (la Edge Function) puede llamarlas.
select ok(not has_function_privilege('authenticated', 'public.calendario_citas_pendientes(integer)', 'execute'),
  'authenticated no puede leer pendientes');
select ok(not has_function_privilege('authenticated', 'public.calendario_marcar_push(bigint, text, text, text)', 'execute'),
  'authenticated no puede marcar el push');
select ok(not has_function_privilege('authenticated', 'public.calendario_registrar_error(jsonb, integer)', 'execute'),
  'authenticated no puede registrar errores');
select ok(not has_function_privilege('anon', 'public.calendario_citas_pendientes(integer)', 'execute'),
  'anon no puede leer pendientes');
select ok(has_function_privilege('service_role', 'public.calendario_citas_pendientes(integer)', 'execute'),
  'service_role lee pendientes');
select ok(has_function_privilege('service_role', 'public.calendario_marcar_push(bigint, text, text, text)', 'execute'),
  'service_role marca el push');
select ok(has_function_privilege('service_role', 'public.calendario_registrar_error(jsonb, integer)', 'execute'),
  'service_role registra errores');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Un paciente con teléfono y una cita pendiente (sync por defecto = pendiente).
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0990000001",
  "nombre_whatsapp":"Ana Inventada","message_id":"wamid.cal1"}');
create temp table ana as
  select p.id from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
   where c.telefono = '593990000001';
insert into public.citas (paciente_id, inicia_en, termina_en, servicio, origen)
values ((select id from ana), '2026-10-20 10:00-05', '2026-10-20 11:00-05', 'Limpieza', 'panel');
create temp table cita as select id from public.citas;

select is(jsonb_array_length(public.calendario_citas_pendientes()), 1, 'una cita pendiente');
select results_eq(
  $$select p->>'nombre', p->>'telefono', p->>'servicio', p->>'estado', (p->>'gcal_event_id') is null
      from jsonb_array_elements(public.calendario_citas_pendientes()) p$$,
  $$values ('Ana Inventada', '593990000001', 'Limpieza', 'agendada', true)$$,
  'trae nombre, teléfono y servicio para el evento');

-- Una cita ya sincronizada no sale.
insert into public.citas (paciente_id, inicia_en, termina_en, origen, sync, gcal_event_id)
values ((select id from ana), '2026-10-21 10:00-05', '2026-10-21 11:00-05', 'eli', 'ok', 'evento-de-eli');
select is(jsonb_array_length(public.calendario_citas_pendientes()), 1, 'las citas con sync = ok no salen');
select is(jsonb_array_length(public.calendario_citas_pendientes(0)), 1, 'un límite de 0 se trata como 1');

-- Push correcto → sync ok con los ids de Google.
select public.calendario_marcar_push((select id from cita), 'crm00000001', '"etag-1"', null);
select results_eq(
  $$select sync, sync_error, gcal_event_id, gcal_etag from public.citas where id = (select id from cita)$$,
  $$values ('ok', null::text, 'crm00000001', '"etag-1"')$$, 'push ok: sync ok, id y etag guardados');
select is(jsonb_array_length(public.calendario_citas_pendientes()), 0, 'ya no queda pendiente');
select is((select actor::text from public.auditoria
            where tabla = 'citas' and fila_id = (select id from cita) and accion = 'update'
            order by id desc limit 1), 'calendario', 'la auditoría lo anota como actor calendario');

-- Push fallido → sync error con el detalle, y se vuelve a ofrecer para el reintento.
select public.calendario_marcar_push((select id from cita), null, null, 'Google respondió 503: caído');
select results_eq(
  $$select sync, sync_error, gcal_event_id from public.citas where id = (select id from cita)$$,
  $$values ('error', 'Google respondió 503: caído', 'crm00000001')$$,
  'push fallido: sync error con el detalle y conserva el id de Google');
select is(jsonb_array_length(public.calendario_citas_pendientes()), 1, 'el error se reintenta');
select public.calendario_marcar_push((select id from cita), null, null, repeat('x', 600));
select is((select length(sync_error) from public.citas where id = (select id from cita)), 500, 'el detalle se recorta a 500');

-- Cita cancelada: tras borrar el evento no queda etag.
update public.citas set estado = 'cancelada' where id = (select id from cita);
select public.calendario_marcar_push((select id from cita), null, '"etag-viejo"', null);
select results_eq(
  $$select sync, gcal_etag from public.citas where id = (select id from cita)$$,
  $$values ('ok', null::text)$$, 'cancelada: sync ok y sin etag');

-- Errores de integración: origen calendario, con deduplicación opcional.
select public.calendario_registrar_error('{"tipo":"sin_configurar","faltan":["GOOGLE_SA_JSON"]}');
select is((select count(*)::int from public.errores_integracion where origen = 'calendario'), 1, 'error anotado con origen calendario');
select public.calendario_registrar_error('{"tipo":"sin_configurar"}', 60);
select is((select count(*)::int from public.errores_integracion), 1, 'el mismo tipo dentro de la ventana no se repite');
select public.calendario_registrar_error('{"tipo":"push"}', 60);
select is((select count(*)::int from public.errores_integracion), 2, 'otro tipo sí se anota');
select public.calendario_registrar_error('{"tipo":"push"}');
select is((select count(*)::int from public.errores_integracion), 3, 'sin ventana siempre anota');

select * from finish();
rollback;
