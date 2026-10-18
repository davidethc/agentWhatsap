-- Read-only helpers for the WhatsApp booking agent (n8n). They only expose what the
-- public booking wizard already shows and reuse its slot logic.
-- Requires the barberia-reservas schema (businesses, services, business_hours, barbers,
-- appointments) and its functions public_bookable_barbers / public_available_slots.

create or replace function public.public_bot_info(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object('nombre', b.name, 'telefono', b.phone, 'direccion', b.address),
    'servicios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'service_id', s.id, 'nombre', s.name, 'descripcion', s.description,
               'duracion_min', s.duration_minutes, 'precio', s.price)
             order by s.sort_order, s.name)
      from public.services s
      where s.business_id = b.id and s.is_active = true), '[]'::jsonb),
    'horario', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', (array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[h.day_of_week + 1],
               'abierto', coalesce(h.is_open, false),
               'abre', to_char(h.open_time, 'HH24:MI'),
               'cierra', to_char(h.close_time, 'HH24:MI'))
             order by h.day_of_week)
      from public.business_hours h
      where h.business_id = b.id), '[]'::jsonb),
    'barberos', coalesce((
      select jsonb_agg(jsonb_build_object('barber_id', x.id, 'nombre', x.name) order by x.name)
      from public.public_bookable_barbers(b.id) x), '[]'::jsonb)
  )
  from public.businesses b
  where b.id = p_business_id;
$$;

create or replace function public.public_bot_slots(p_business_id uuid, p_date date, p_service_id uuid)
returns table (barber_id uuid, barbero text, turnos_libres text[])
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  -- Mirrors v_lead_minutes in create_public_appointment.
  v_lead_minutes constant integer := 15;
  v_duration integer;
  v_today date := (now() at time zone 'America/Guayaquil')::date;
  v_min_start text;
begin
  select s.duration_minutes into v_duration
  from public.services s
  where s.id = p_service_id and s.business_id = p_business_id and s.is_active = true;

  if v_duration is null or p_date is null or p_date < v_today or p_date > v_today + 90 then
    return;
  end if;

  if p_date = v_today then
    v_min_start := to_char((now() at time zone 'America/Guayaquil') + make_interval(mins => v_lead_minutes), 'HH24:MI');
  end if;

  return query
  select bb.id, bb.name,
         coalesce(array(
           select slot
           from public.public_available_slots(bb.id, p_date, v_duration) slot
           where v_min_start is null or slot >= v_min_start
           order by slot), '{}'::text[])
  from public.public_bookable_barbers(p_business_id) bb;
end;
$$;

revoke all on function public.public_bot_info(uuid) from public;
revoke all on function public.public_bot_slots(uuid, date, uuid) from public;
grant execute on function public.public_bot_info(uuid) to anon, authenticated, service_role;
grant execute on function public.public_bot_slots(uuid, date, uuid) to anon, authenticated, service_role;
