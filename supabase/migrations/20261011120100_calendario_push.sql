-- TK-15 · Funciones de base para la Edge Function «calendario» (push de citas a Google Calendar).
-- Plan §6. Las llama solo la función con la clave de servicio; ni anon ni authenticated.

-- Citas que faltan por enviar (sync pendiente o con error, para el reintento), con los datos que van
-- al evento: nombre, teléfono y servicio. Nada clínico.
create or replace function public.calendario_citas_pendientes(p_limite integer default 25)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
  from (
    select c.id, c.paciente_id, c.gcal_event_id, c.gcal_etag, c.inicia_en, c.termina_en,
           c.servicio, c.estado, p.nombre, cv.telefono
      from public.citas c
      left join public.pacientes p on p.id = c.paciente_id
      left join public.conversaciones cv on cv.id = p.conversacion_id
     where c.sync <> 'ok'
     order by c.id
     limit greatest(coalesce(p_limite, 25), 1)
  ) x;
$$;
comment on function public.calendario_citas_pendientes(integer) is
  'Citas con sync <> ok para la función calendario. Solo service_role.';

-- Resultado del push de una cita: sync = ok (con los ids de Google) o sync = error (con el detalle).
-- Corre como actor «calendario» para que el trigger de TK-17 no la vuelva a marcar pendiente.
create or replace function public.calendario_marcar_push(
  p_cita_id       bigint,
  p_gcal_event_id text default null,
  p_gcal_etag     text default null,
  p_error         text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.actor', 'calendario', true);
  if p_error is null then
    update public.citas
       set sync          = 'ok',
           sync_error    = null,
           gcal_event_id = coalesce(p_gcal_event_id, gcal_event_id),
           gcal_etag     = case when estado = 'cancelada' then null else coalesce(p_gcal_etag, gcal_etag) end
     where id = p_cita_id;
  else
    update public.citas
       set sync = 'error', sync_error = left(p_error, 500)
     where id = p_cita_id;
  end if;
end;
$$;
comment on function public.calendario_marcar_push(bigint, text, text, text) is
  'Resultado del push de una cita a Google Calendar. Solo service_role.';

-- errores_integracion (origen calendario). Con p_dedupe_min > 0 no repite el mismo «tipo» de error
-- dentro de esa ventana (p. ej. «sin configurar» cada 2 min no debe llenar la tabla).
create or replace function public.calendario_registrar_error(
  p_detalle     jsonb,
  p_dedupe_min  integer default 0
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_dedupe_min > 0 and exists (
    select 1 from public.errores_integracion
     where origen = 'calendario'
       and detalle ->> 'tipo' = p_detalle ->> 'tipo'
       and en > now() - make_interval(mins => p_dedupe_min)
  ) then
    return;
  end if;
  insert into public.errores_integracion (origen, detalle) values ('calendario', p_detalle);
end;
$$;
comment on function public.calendario_registrar_error(jsonb, integer) is
  'Anota un fallo de la sincronización con Calendar (sin datos del paciente). Solo service_role.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.calendario_citas_pendientes(integer)',
    'public.calendario_marcar_push(bigint, text, text, text)',
    'public.calendario_registrar_error(jsonb, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
