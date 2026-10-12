-- cita_reservada trae el nombre completo que dio el paciente: reemplaza al de WhatsApp (o «Sin
-- nombre»), pero nunca pisa un nombre editado a mano en el panel. Datos inventados.
begin;
-- Aislar del seed.sql: se vacía dentro de la transacción (el rollback final lo deja como estaba).
delete from auth.users where email like '%@ejemplo.test';
delete from public.personal;
truncate public.mensajes, public.citas, public.cambios_etapa, public.datos_clinicos,
         public.pacientes, public.conversaciones, public.errores_integracion, public.sync_calendario;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'doctora@ejemplo.test');
insert into public.personal (user_id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000d1', 'Doctora Prueba', 'doctora');

create function pg_temp.nombre(p_tel text) returns text language sql as $$
  select p.nombre from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
   where c.telefono = p_tel and p.responsable_id is null $$;
create function pg_temp.id(p_tel text) returns bigint language sql as $$
  select p.id from public.pacientes p join public.conversaciones c on c.id = p.conversacion_id
   where c.telefono = p_tel and p.responsable_id is null $$;

-- Las funciones nuevas no son ejecutables por defecto (migración 0300): grant explícito.
grant execute on function pg_temp.nombre(text), pg_temp.id(text) to service_role, authenticated;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 1. Nombre de WhatsApp → nombre completo de la cita
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0991110001",
  "nombre_whatsapp":"Pepe 🔥","message_id":"wamid.N1","en":"2026-10-12T09:00:00-05:00"}');
select is(pg_temp.nombre('593991110001'), 'Pepe 🔥', 'primer mensaje: nombre de WhatsApp');
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0991110001",
  "nombre":"José Pérez","gcal_event_id":"gcal-n1","inicio":"2026-10-13T10:00:00-05:00"}');
select is(pg_temp.nombre('593991110001'), 'José Pérez', 'cita_reservada: pasa al nombre completo');
select results_eq(
  $$select antes->>'nombre', despues->>'nombre', actor::text from public.auditoria
     where tabla = 'pacientes' and fila_id = pg_temp.id('593991110001') and accion = 'update'
       and antes->>'nombre' is distinct from despues->>'nombre'$$,
  $$values ('Pepe 🔥', 'José Pérez', 'eli')$$, 'el cambio de nombre queda auditado con actor eli');

-- Una segunda cita con otro nombre ya no lo cambia (ya no es el de WhatsApp)
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0991110001",
  "nombre":"Pepito","gcal_event_id":"gcal-n1b","inicio":"2026-10-20T10:00:00-05:00"}');
select is(pg_temp.nombre('593991110001'), 'José Pérez', 'segunda cita no reemplaza un nombre completo');

-- Nombre vacío o en blanco: no cambia nada
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0991110002",
  "nombre_whatsapp":"Rita","message_id":"wamid.N2"}');
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0991110002",
  "nombre":"   ","gcal_event_id":"gcal-n2","inicio":"2026-10-13T11:00:00-05:00"}');
select is(pg_temp.nombre('593991110002'), 'Rita', 'nombre en blanco no cambia el nombre');

-- «Sin nombre» (sin nombre de WhatsApp) → nombre de la cita
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0991110003","message_id":"wamid.N3"}');
select is(pg_temp.nombre('593991110003'), 'Sin nombre', 'sin nombre de WhatsApp → Sin nombre');
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0991110003",
  "nombre":"Ana Ruiz","gcal_event_id":"gcal-n3","inicio":"2026-10-13T12:00:00-05:00"}');
select is(pg_temp.nombre('593991110003'), 'Ana Ruiz', 'Sin nombre → nombre de la cita');

-- 2. El personal editó el nombre a mano: la cita no lo pisa
select public.registrar_evento_eli('{"tipo":"mensaje_entrante","telefono":"0991110004",
  "nombre_whatsapp":"Lulú","message_id":"wamid.N4"}');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
update public.pacientes set nombre = 'Lucía Gómez' where id = pg_temp.id('593991110004');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(pg_temp.nombre('593991110004'), 'Lucía Gómez', 'la doctora editó el nombre');
select public.registrar_evento_eli('{"tipo":"cita_reservada","telefono":"0991110004",
  "nombre":"Lulu Gomez","gcal_event_id":"gcal-n4","inicio":"2026-10-13T15:00:00-05:00"}');
select is(pg_temp.nombre('593991110004'), 'Lucía Gómez', 'la cita no pisa un nombre editado en el panel');
select is((select count(*)::int from public.citas where gcal_event_id = 'gcal-n4'), 1, 'la cita sí se guarda');
reset role;

select * from finish();
rollback;
