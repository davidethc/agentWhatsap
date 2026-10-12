-- Nombre completo desde cita_reservada (pedido del usuario, 12-oct-2026).
--
-- El titular se crea con el primer mensaje usando el nombre de WhatsApp (o «Sin nombre»). Cuando
-- Eli agenda, el evento cita_reservada trae el nombre completo que dio el paciente, pero
-- private.asegurar_titular solo lo usaba si el paciente no existía.
--
-- Ahora, si p_nombre viene con texto y el titular ya existe, se actualiza su nombre SOLO si sigue
-- siendo el automático: igual a conversaciones.nombre_whatsapp o 'Sin nombre'. Un nombre editado
-- a mano en el panel (o uno completo de una cita anterior) no se pisa.
-- Solo cita_reservada llama con p_nombre. registrar_evento_eli ya fija app.actor = 'eli', así que
-- el trigger de auditoría registra el cambio con actor 'eli'.
--
-- Migración nueva: 0700 y 0100, que ya están en la nube, no se editan. create or replace conserva
-- la firma y los permisos, que se repiten igual para que la migración se lea sola.
-- Prueba: supabase/tests/11_nombre_desde_cita.test.sql.

create or replace function private.asegurar_titular(
  p_telefono        text,
  p_nombre_whatsapp text default null,
  p_nombre          text default null
)
returns public.pacientes
language plpgsql
set search_path = ''
as $$
declare
  v_conversacion_id bigint;
  v_nombre_whatsapp text;
  v_nombre          text := nullif(btrim(p_nombre), '');
  v_titular         public.pacientes;
begin
  insert into public.conversaciones (telefono, nombre_whatsapp)
  values (p_telefono, nullif(btrim(p_nombre_whatsapp), ''))
  on conflict (telefono) do update
    set nombre_whatsapp = coalesce(excluded.nombre_whatsapp, public.conversaciones.nombre_whatsapp)
  returning id, nombre_whatsapp into v_conversacion_id, v_nombre_whatsapp;

  select * into v_titular from public.pacientes
   where conversacion_id = v_conversacion_id and responsable_id is null;

  if not found then
    insert into public.pacientes (conversacion_id, nombre, origen)
    values (
      v_conversacion_id,
      coalesce(v_nombre, nullif(btrim(p_nombre_whatsapp), ''), 'Sin nombre'),
      'whatsapp'
    )
    returning * into v_titular;

  -- Nombre completo (cita_reservada) sobre el nombre automático; nunca sobre uno editado a mano.
  elsif v_nombre is not null
        and v_titular.nombre is distinct from v_nombre
        and (v_titular.nombre = v_nombre_whatsapp or v_titular.nombre = 'Sin nombre') then
    update public.pacientes set nombre = v_nombre
     where id = v_titular.id
    returning * into v_titular;
  end if;

  return v_titular;
end;
$$;
comment on function private.asegurar_titular(text, text, text) is
  'Conversación y titular del teléfono (los crea si no existen). Con p_nombre (cita_reservada) reemplaza el nombre automático (WhatsApp o «Sin nombre»), nunca uno editado a mano.';
revoke all on function private.asegurar_titular(text, text, text) from public, anon, authenticated;
grant execute on function private.asegurar_titular(text, text, text) to service_role;
