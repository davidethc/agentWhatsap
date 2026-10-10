-- TK-10 · resumen_del_dia(fecha): pantalla de inicio del panel. Spec HU-2, HU-3 y HU-4.
-- Todo en hora de America/Guayaquil. La semana va de lunes a domingo e incluye la fecha.
--
-- Devuelve:
-- {
--   "fecha": "2026-10-14",
--   "semana": {"desde": "2026-10-12", "hasta": "2026-10-18"},
--   "citas_hoy": [{id, inicia_en, termina_en, servicio, estado, origen, paciente_id, paciente_nombre}],  -- por hora, incluye canceladas
--   "numeros": {citas_hoy (sin canceladas), nuevos_hoy, nuevos_semana, agendadas_semana, inasistencias_semana},
--   "nuevos_por_dia": [{dia, nuevos}] × 7,
--   "canales": [{origen, nuevos, agendadas, inasistencias}] × 4 (origen del paciente),
--   "cumpleanos_hoy": [{id, nombre, fecha_nacimiento, cumple}],
--   "cumpleanos_semana": [...],   -- incluye los de hoy
--   "retornos": [{id, nombre, etapa, volver_el}]  -- volver_el ≤ domingo y sin cita agendada desde hoy
-- }
-- Definiciones: «nuevos» = pacientes creados ese día/semana; «agendadas» = citas no canceladas cuya
-- hora cae en la semana; «inasistencias» = citas no_asistio de la semana.

-- ¿Cuándo celebra el cumpleaños en el año de p_dia? (29-feb → 28-feb en año no bisiesto)
create or replace function private.cumple_en(p_nacimiento date, p_dia date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extract(month from p_nacimiento) = extract(month from p_dia)
     and (
       extract(day from p_nacimiento) = extract(day from p_dia)
       or (extract(month from p_dia) = 2 and extract(day from p_nacimiento) = 29
           and extract(day from p_dia) = 28
           and extract(day from (make_date(extract(year from p_dia)::int, 3, 1) - 1)) = 28)
     );
$$;
revoke all on function private.cumple_en(date, date) from public, anon;
grant execute on function private.cumple_en(date, date) to authenticated, service_role;

create or replace function public.resumen_del_dia(
  p_fecha date default (now() at time zone 'America/Guayaquil')::date
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_desde      date := date_trunc('week', p_fecha)::date;  -- lunes
  v_hasta      date := v_desde + 6;                        -- domingo
  v_hoy_ini    timestamptz := p_fecha::timestamp at time zone 'America/Guayaquil';
  v_hoy_fin    timestamptz := (p_fecha + 1)::timestamp at time zone 'America/Guayaquil';
  v_sem_ini    timestamptz := v_desde::timestamp at time zone 'America/Guayaquil';
  v_sem_fin    timestamptz := (v_hasta + 1)::timestamp at time zone 'America/Guayaquil';
  v_resultado  jsonb;
begin
  perform private.exigir_personal();

  with
  citas_hoy as (
    select c.id, c.inicia_en, c.termina_en, c.servicio, c.estado, c.origen, c.paciente_id,
           p.nombre as paciente_nombre
      from public.citas c
      left join public.pacientes p on p.id = c.paciente_id
     where c.inicia_en >= v_hoy_ini and c.inicia_en < v_hoy_fin
  ),
  nuevos as (
    select p.id, p.origen, (p.created_at at time zone 'America/Guayaquil')::date as dia
      from public.pacientes p
     where p.created_at >= v_sem_ini and p.created_at < v_sem_fin
  ),
  citas_semana as (
    select c.estado, p.origen
      from public.citas c
      left join public.pacientes p on p.id = c.paciente_id
     where c.inicia_en >= v_sem_ini and c.inicia_en < v_sem_fin
       and c.estado <> 'cancelada'
  ),
  cumples as (
    select p.id, p.nombre, p.fecha_nacimiento, d::date as cumple
      from public.pacientes p
      join generate_series(v_desde, v_hasta, interval '1 day') d
        on private.cumple_en(p.fecha_nacimiento, d::date)
     where p.fecha_nacimiento is not null
  ),
  retornos as (
    select p.id, p.nombre, p.etapa, p.volver_el
      from public.pacientes p
     where p.volver_el <= v_hasta
       and not exists (
         select 1 from public.citas c
          where c.paciente_id = p.id and c.estado = 'agendada' and c.inicia_en >= v_hoy_ini
       )
  )
  select jsonb_build_object(
    'fecha', p_fecha,
    'semana', jsonb_build_object('desde', v_desde, 'hasta', v_hasta),
    'citas_hoy', coalesce((select jsonb_agg(to_jsonb(ch) order by ch.inicia_en, ch.id) from citas_hoy ch), '[]'),
    'numeros', jsonb_build_object(
      'citas_hoy',            (select count(*) from citas_hoy where estado <> 'cancelada'),
      'nuevos_hoy',           (select count(*) from nuevos where dia = p_fecha),
      'nuevos_semana',        (select count(*) from nuevos),
      'agendadas_semana',     (select count(*) from citas_semana),
      'inasistencias_semana', (select count(*) from citas_semana where estado = 'no_asistio')
    ),
    'nuevos_por_dia', (
      select jsonb_agg(jsonb_build_object('dia', d::date,
                         'nuevos', (select count(*) from nuevos n where n.dia = d::date)) order by d)
        from generate_series(v_desde, v_hasta, interval '1 day') d
    ),
    'canales', (
      select jsonb_agg(jsonb_build_object(
               'origen',        o,
               'nuevos',        (select count(*) from nuevos n where n.origen = o),
               'agendadas',     (select count(*) from citas_semana cs where cs.origen = o),
               'inasistencias', (select count(*) from citas_semana cs where cs.origen = o and cs.estado = 'no_asistio')
             ) order by o)
        from unnest(enum_range(null::public.origen_paciente)) o
    ),
    'cumpleanos_hoy', coalesce((
      select jsonb_agg(to_jsonb(cu) order by cu.nombre, cu.id) from cumples cu where cu.cumple = p_fecha), '[]'),
    'cumpleanos_semana', coalesce((
      select jsonb_agg(to_jsonb(cu) order by cu.cumple, cu.nombre, cu.id) from cumples cu), '[]'),
    'retornos', coalesce((
      select jsonb_agg(to_jsonb(re) order by re.volver_el, re.id) from retornos re), '[]')
  ) into v_resultado;

  return v_resultado;
end;
$$;
comment on function public.resumen_del_dia(date) is
  'Resumen del día (Guayaquil): citas de hoy, números de la semana por canal, cumpleaños y retornos.';
revoke all on function public.resumen_del_dia(date) from public, anon;
grant execute on function public.resumen_del_dia(date) to authenticated, service_role;
