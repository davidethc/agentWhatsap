-- TK-16 · Calendar → Panel: aplicar_evento_calendario y syncToken. Datos inventados.
begin;
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(50);

select has_function('public', 'aplicar_evento_calendario', array['jsonb'], 'existe aplicar_evento_calendario');
select has_function('public', 'calendario_leer_token', array['text'], 'existe calendario_leer_token');
select has_function('public', 'calendario_guardar_token', array['text', 'text'], 'existe calendario_guardar_token');
select ok(not has_function_privilege('authenticated', 'public.aplicar_evento_calendario(jsonb)', 'execute'),
  'authenticated no puede aplicar eventos');
select ok(not has_function_privilege('anon', 'public.aplicar_evento_calendario(jsonb)', 'execute'),
  'anon no puede aplicar eventos');
select ok(not has_function_privilege('authenticated', 'public.calendario_guardar_token(text, text)', 'execute'),
  'authenticated no puede guardar el token');
select ok(has_function_privilege('service_role', 'public.aplicar_evento_calendario(jsonb)', 'execute'),
  'service_role aplica eventos');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- ───────── syncToken ─────────
select is(public.calendario_leer_token('cal@prueba'), null, 'sin token al principio');
select public.calendario_guardar_token('cal@prueba', 'st-1');
select is(public.calendario_leer_token('cal@prueba'), 'st-1', 'token guardado');
select ok((select ultima_sync_en is not null from public.sync_calendario where calendario_id = 'cal@prueba'),
  'guarda la fecha de la última sincronización');
select public.calendario_guardar_token('cal@prueba', 'st-2');
select is(public.calendario_leer_token('cal@prueba'), 'st-2', 'el token se reemplaza (una sola fila)');
select public.calendario_guardar_token('cal@prueba', null);
select is(public.calendario_leer_token('cal@prueba'), null, 'token borrado (410)');
select ok((select ultima_sync_en is not null from public.sync_calendario where calendario_id = 'cal@prueba'),
  'borrar el token conserva la última sincronización');

-- ───────── Datos: Beto con una cita ya sincronizada ─────────
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0990000002",
  "nombre_whatsapp":"Beto Inventado","message_id":"wamid.pull1"}');
create temp table beto as
  select p.id from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
   where c.telefono = '593990000002';
insert into public.citas (paciente_id, gcal_event_id, gcal_etag, inicia_en, termina_en, servicio, origen, sync)
values ((select id from beto), 'ev-a', '"1"', '2026-10-20 10:00-05', '2026-10-20 11:00-05', 'Limpieza', 'panel', 'ok');

-- ───────── Evento conocido ─────────
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","etag":"\"2\"","estado":"activo",
  "inicio":"2026-10-20T11:00:00-05:00","fin":"2026-10-20T12:30:00-05:00"}')->>'accion', 'actualizada',
  'evento movido → actualizada');
select results_eq(
  $$select inicia_en, termina_en, gcal_etag, sync from public.citas where gcal_event_id = 'ev-a'$$,
  $$values ('2026-10-20 11:00-05'::timestamptz, '2026-10-20 12:30-05'::timestamptz, '"2"', 'ok')$$,
  'hora y duración nuevas, etag guardado');
select is((select actor::text from public.auditoria where tabla = 'citas'
            and fila_id = (select id from public.citas where gcal_event_id = 'ev-a') and accion = 'update'
            order by id desc limit 1), 'calendario', 'auditoría con actor calendario');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","etag":"\"2\"","estado":"activo",
  "inicio":"2026-10-20T11:00:00-05:00","fin":"2026-10-20T12:30:00-05:00"}')->>'accion', 'igual',
  'mismo etag (eco de nuestro push) → igual');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","etag":"\"3\"","estado":"activo",
  "inicio":"2026-10-20T11:00:00-05:00","fin":"2026-10-20T12:30:00-05:00"}')->>'accion', 'igual',
  'otro etag con la misma hora → igual (solo guarda el etag)');
select is((select gcal_etag from public.citas where gcal_event_id = 'ev-a'), '"3"', 'el etag nuevo queda guardado');
select is((select count(*)::int from public.errores_integracion), 0, 'nada de esto es un error');

-- Evento borrado
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","estado":"cancelado"}')->>'accion', 'cancelada',
  'evento borrado → cancelada');
select results_eq($$select estado::text, sync, gcal_etag from public.citas where gcal_event_id = 'ev-a'$$,
  $$values ('cancelada', 'ok', null::text)$$, 'la cita queda Cancelada y sincronizada');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","estado":"cancelado"}')->>'accion', 'igual',
  'borrado repetido → igual');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-desconocido","estado":"cancelado"}')->>'accion', 'ignorada',
  'borrado de un evento que nunca conocimos → ignorada');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-a","etag":"\"4\"","estado":"activo",
  "inicio":"2026-10-21T10:00:00-05:00","fin":"2026-10-21T11:00:00-05:00"}')->>'accion', 'ignorada',
  'cita cancelada en el panel: no se reactiva desde Calendar');

-- ───────── Evento nuevo ─────────
-- De Eli: «Tel: 593…» de una conversación conocida → ligado al titular, que pasa a Agendó.
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-eli","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-22T09:00:00-05:00","fin":"2026-10-22T10:00:00-05:00",
  "resumen":"🦷 Control - Beto Inventado",
  "descripcion":"Paciente: Beto Inventado\nTel: 593990000002\nServicio: Control\nAgendado por WhatsApp (Eli)"}')->>'accion',
  'creada_ligada', 'evento de Eli → creada_ligada');
select results_eq(
  $$select paciente_id = (select id from beto), origen::text, servicio, sync from public.citas where gcal_event_id = 'ev-eli'$$,
  $$values (true, 'eli', 'Control', 'ok')$$, 'ligado al titular, origen eli, servicio sin emoji ni nombre');
select is((select etapa::text from public.pacientes where id = (select id from beto)), 'agendo', 'el titular pasa a Agendó');
select is((select actor::text from public.cambios_etapa where paciente_id = (select id from beto) order by id desc limit 1),
  'calendario', 'el cambio de etapa queda con actor calendario');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-eli","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-22T09:00:00-05:00","fin":"2026-10-22T10:00:00-05:00"}')->>'accion', 'igual',
  'el mismo evento otra vez → igual, sin duplicar');
select is((select count(*)::int from public.citas where gcal_event_id = 'ev-eli'), 1, 'una sola cita');

-- Con «Tel:» pero de un número que no es de ninguna conversación → sin vincular.
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-tel-raro","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-22T11:00:00-05:00","fin":"2026-10-22T12:00:00-05:00","resumen":"🦷 Limpieza - Otro",
  "descripcion":"Tel: 593990000099"}')->>'accion', 'creada_sin_vincular', 'Tel desconocido → sin vincular');
-- Manual, sin paciente.
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-manual","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-22T15:00:00-05:00","fin":"2026-10-22T16:00:00-05:00","resumen":"Reunión proveedor"}')->>'accion',
  'creada_sin_vincular', 'evento manual → creada_sin_vincular');
select results_eq(
  $$select paciente_id, origen::text, servicio, sync from public.citas where gcal_event_id = 'ev-manual'$$,
  $$values (null::bigint, 'calendario', 'Reunión proveedor', 'ok')$$, 'sin paciente, origen calendario, con su título');
select is((select count(*)::int from public.cambios_etapa where actor = 'calendario'), 1,
  'un evento sin vincular no mueve a nadie de etapa');
-- Un teléfono mal escrito en la descripción no rompe nada.
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-tel-malo","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-23T09:00:00-05:00","fin":"2026-10-23T10:00:00-05:00","resumen":"Algo","descripcion":"Tel: 12345678"}')->>'accion',
  'creada_sin_vincular', 'teléfono inválido → sin vincular, sin error');

-- ───────── Se ignoran ─────────
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-dia","etag":"\"1\"","estado":"activo","resumen":"Feriado"}')->>'accion',
  'ignorada', 'sin hora (día entero) → ignorada');
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-malo","etag":"\"1\"","estado":"activo",
  "inicio":"2026-10-23T11:00:00-05:00","fin":"2026-10-23T10:00:00-05:00"}')->>'accion', 'ignorada', 'fin antes del inicio → ignorada');
select is((select count(*)::int from public.citas where gcal_event_id in ('ev-dia', 'ev-malo')), 0, 'no se crea nada');
select throws_ok($$select public.aplicar_evento_calendario('{"estado":"activo"}')$$, '22023', 'Falta gcal_event_id',
  'sin id de evento → error de datos');

-- ───────── Adopción de un evento propio cuyo id no alcanzó a guardarse ─────────
insert into public.citas (paciente_id, inicia_en, termina_en, servicio, origen, sync)
values ((select id from beto), '2026-10-24 10:00-05', '2026-10-24 11:00-05', 'Control', 'panel', 'pendiente');
create temp table adoptada as select id from public.citas where inicia_en = '2026-10-24 10:00-05';
select is(public.aplicar_evento_calendario(jsonb_build_object('gcal_event_id', 'crm-adoptado', 'etag', '"1"', 'estado', 'activo',
  'inicio', '2026-10-24T10:00:00-05:00', 'fin', '2026-10-24T11:00:00-05:00', 'crm_cita_id', (select id from adoptada)))->>'accion',
  'igual', 'evento propio con crm_cita_id → se adopta');
select results_eq($$select gcal_event_id, sync from public.citas where id = (select id from adoptada)$$,
  $$values ('crm-adoptado', 'ok')$$, 'la cita recibe su id de Google y queda ok');

-- ───────── Conflicto: gana Calendar ─────────
insert into public.citas (paciente_id, gcal_event_id, gcal_etag, inicia_en, termina_en, servicio, origen, sync)
values ((select id from beto), 'ev-conflicto', '"1"', '2026-10-25 10:00-05', '2026-10-25 11:00-05', 'Limpieza', 'panel', 'ok');
-- La doctora mueve la cita en el panel (queda pendiente de enviar)…
update public.citas set inicia_en = '2026-10-25 14:00-05', termina_en = '2026-10-25 15:00-05', sync = 'pendiente'
 where gcal_event_id = 'ev-conflicto';
-- …y a la vez alguien la movió en Calendar.
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-conflicto","etag":"\"2\"","estado":"activo",
  "inicio":"2026-10-25T16:00:00-05:00","fin":"2026-10-25T17:00:00-05:00"}')->>'accion', 'conflicto', 'cambio en panel y en Calendar → conflicto');
select results_eq($$select inicia_en, termina_en, gcal_etag, sync from public.citas where gcal_event_id = 'ev-conflicto'$$,
  $$values ('2026-10-25 16:00-05'::timestamptz, '2026-10-25 17:00-05'::timestamptz, '"2"', 'ok')$$,
  'gana Calendar: queda su hora y la cita en ok');
select results_eq(
  $$select detalle->>'tipo', detalle->>'ganador', (detalle->>'cita_id')::bigint = (select id from public.citas where gcal_event_id = 'ev-conflicto'),
            detalle->'panel'->>'inicia_en' is not null, detalle->'calendar'->>'inicia_en' is not null
      from public.errores_integracion where origen = 'calendario'$$,
  $$values ('conflicto', 'calendario', true, true, true)$$, 'queda una fila en errores_integracion con lo de cada lado');
select is((select actor::text from public.auditoria where tabla = 'citas'
            and fila_id = (select id from public.citas where gcal_event_id = 'ev-conflicto') and accion = 'update'
            order by id desc limit 1), 'calendario', 'y la auditoría registra el cambio de Calendar');

-- Pendiente en el panel pero Calendar con la misma hora (solo cambió el etag): no es conflicto.
update public.citas set servicio = 'Control', sync = 'pendiente' where gcal_event_id = 'ev-conflicto';
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-conflicto","etag":"\"3\"","estado":"activo",
  "inicio":"2026-10-25T16:00:00-05:00","fin":"2026-10-25T17:00:00-05:00"}')->>'accion', 'igual', 'misma hora → no es conflicto');
select is((select count(*)::int from public.errores_integracion where detalle->>'tipo' = 'conflicto'), 1, 'sigue habiendo un solo conflicto');

-- Borrado en Calendar con un cambio del panel sin enviar → gana Calendar (se cancela) y se anota.
update public.citas set inicia_en = '2026-10-25 18:00-05', termina_en = '2026-10-25 19:00-05', sync = 'pendiente'
 where gcal_event_id = 'ev-conflicto';
select is(public.aplicar_evento_calendario('{"gcal_event_id":"ev-conflicto","estado":"cancelado"}')->>'accion', 'conflicto',
  'borrado en Calendar con cambio pendiente → conflicto');
select results_eq($$select estado::text, sync from public.citas where gcal_event_id = 'ev-conflicto'$$,
  $$values ('cancelada', 'ok')$$, 'la cita queda Cancelada');

select * from finish();
rollback;
