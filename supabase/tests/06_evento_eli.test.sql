-- TK-7 · registrar_evento_eli: contrato Eli → CRM (plan §5). TK-41: sin contenido de mensajes.
-- Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
-- auditoria no se puede vaciar: las pruebas la filtran por fila.
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(32);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

select has_function('public', 'registrar_evento_eli', array['jsonb'], 'existe registrar_evento_eli(jsonb)');

-- Llama la Edge Function con la clave de servicio.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Número nuevo → titular en Nuevo con su mensaje
select is(public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0998887777",
  "nombre_whatsapp":"Eva Inventada","message_id":"wamid.A1",
  "en":"2026-10-12T09:00:00-05:00"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'mensaje_entrante nuevo → ok, no duplicado');
create temp table eva as
  select p.* from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
   where c.telefono = '593998887777';
select results_eq($$select nombre, etapa::text, origen::text, responsable_id from eva$$,
  $$values ('Eva Inventada', 'nuevo', 'whatsapp', null::bigint)$$, 'número nuevo → titular en Nuevo');
select results_eq(
  $$select m.direccion, m.enviado_en from public.mensajes m
     join public.conversaciones c on c.id = m.conversacion_id where c.telefono = '593998887777'$$,
  $$values ('entrante', '2026-10-12 09:00-05'::timestamptz)$$,
  'con su mensaje');
select results_eq($$select turnos_entrantes, ultimo_entrante_en from public.conversaciones where telefono = '593998887777'$$,
  $$values (1, '2026-10-12 09:00-05'::timestamptz)$$, 'cuenta 1 turno');
select results_eq($$select de::text, a::text, actor::text from public.cambios_etapa where paciente_id = (select id from eva)$$,
  $$values (null::text, 'nuevo', 'eli')$$, 'historial: creado por eli');
select is((select actor::text from public.auditoria where tabla = 'pacientes' and fila_id = (select id from eva) and accion = 'insert'),
  'eli', 'auditoría con actor eli');

-- Mismo message_id dos veces → 1 mensaje, sin turno extra
select is(public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0998887777",
  "message_id":"wamid.A1"}'),
  '{"ok":true,"duplicado":true}'::jsonb, 'mismo message_id → duplicado');
select is((select count(*)::int from public.mensajes where id_externo = 'wamid.A1'), 1, 'un solo mensaje');
select is((select turnos_entrantes from public.conversaciones where telefono = '593998887777'), 1, 'sin turno extra');
select is((select etapa::text from public.pacientes where id = (select id from eva)), 'nuevo', 'sigue en Nuevo');

-- 2.º turno → Conversando
select lives_ok($$select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"+593998887777",
  "message_id":"wamid.A2","en":"2026-10-12T09:05:00-05:00"}')$$, '2.º mensaje');
select is((select etapa::text from public.pacientes where id = (select id from eva)), 'conversando', '2.º turno → Conversando');
select results_eq($$select de::text, a::text, actor::text from public.cambios_etapa
                    where paciente_id = (select id from eva) order by id desc limit 1$$,
  $$values ('nuevo', 'conversando', 'eli')$$, 'el cambio queda con actor eli');

-- Mensaje saliente de Eli
select is(public.registrar_evento_eli('{"tipo":"mensaje_saliente","telefono":"593998887777",
  "execution_id":"9001","en":"2026-10-12T09:05:30-05:00"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'mensaje_saliente');
select results_eq($$select direccion from public.mensajes where id_externo = 'out:9001'$$,
  $$values ('saliente')$$, 'saliente guardado con id out:execution_id');
select is(public.registrar_evento_eli('{"tipo":"mensaje_saliente","telefono":"593998887777",
  "execution_id":"9001"}')->>'duplicado', 'true', 'saliente repetido → duplicado');
select is((select turnos_entrantes from public.conversaciones where telefono = '593998887777'), 2,
  'el saliente no cuenta turnos');

-- Perdido + mensaje → Conversando
reset role;
select lives_ok($$select private.cambiar_etapa((select id from eva), 'perdido', 'no_respondio')$$, 'estaba en Perdido');
set local role service_role;
select lives_ok($$select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0998887777",
  "message_id":"wamid.A3"}')$$, 'vuelve a escribir');
select results_eq($$select etapa::text, motivo_perdido::text from public.pacientes where id = (select id from eva)$$,
  $$values ('conversando', null::text)$$, 'Perdido + mensaje → Conversando');

-- cita_reservada → cita ligada al titular y Agendó
select is(public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0998887777",
  "gcal_event_id":"gcal-eli-1","inicio":"2026-10-13T10:00:00-05:00","fin":"2026-10-13T11:00:00-05:00",
  "servicio":"Limpieza","nombre":"Eva Inventada"}'),
  '{"ok":true,"duplicado":false}'::jsonb, 'cita_reservada');
select results_eq($$select paciente_id, inicia_en, termina_en, servicio, estado::text, origen::text, sync
                    from public.citas where gcal_event_id = 'gcal-eli-1'$$,
  $$select (select id from eva), '2026-10-13 10:00-05'::timestamptz, '2026-10-13 11:00-05'::timestamptz,
           'Limpieza', 'agendada', 'eli', 'ok'$$, 'cita ligada al titular, origen eli, ya sincronizada');
select results_eq($$select p.etapa::text, (select actor::text from public.cambios_etapa
                      where paciente_id = p.id order by id desc limit 1)
                    from public.pacientes p where p.id = (select id from eva)$$,
  $$values ('agendo', 'eli')$$, 'paciente → Agendó con actor eli');
select is(public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0998887777",
  "gcal_event_id":"gcal-eli-1","inicio":"2026-10-13T10:00:00-05:00","fin":"2026-10-13T11:00:00-05:00"}')->>'duplicado',
  'true', 'cita repetida → duplicado');
select is((select count(*)::int from public.citas where gcal_event_id = 'gcal-eli-1'), 1, 'una sola cita');

-- cita_reservada de un número que nunca escribió (el CRM estuvo caído): crea al titular
select lives_ok($$select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0997776666",
  "gcal_event_id":"gcal-eli-2","inicio":"2026-10-14T10:00:00-05:00","fin":"2026-10-14T11:00:00-05:00",
  "nombre":"Fabio Inventado"}')$$, 'cita de número desconocido');
select results_eq($$select p.nombre, p.etapa::text from public.pacientes p
                    join public.citas c on c.paciente_id = p.id where c.gcal_event_id = 'gcal-eli-2'$$,
  $$values ('Fabio Inventado', 'agendo')$$, 'crea al titular con el nombre de la reserva y en Agendó');

-- Validación
select throws_ok($$select public.registrar_evento_eli('{"tipo":"otro"}')$$, '22023',
  'Evento desconocido: otro', 'tipo desconocido');
select throws_ok($$select public.registrar_evento_eli('{"tipo":"mensaje_entrante","message_id":"x"}')$$, '22023',
  'Falta el campo telefono', 'falta un campo obligatorio');
select throws_ok($$select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0998887777",
  "message_id":"wamid.A9","texto":"Hola"}')$$, '22023',
  'texto ya no se acepta: el CRM no guarda el contenido de los mensajes', 'texto se rechaza (TK-41)');
reset role;

-- Solo la clave de servicio
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0991112222","message_id":"z"}')$$,
  '42501', null, 'el personal no puede llamarla (solo n8n vía Edge Function)');
reset role;

select * from finish();
rollback;
