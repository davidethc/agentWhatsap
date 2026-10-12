-- TK-9 · Tarea programada: Perdido (no respondió) a las 24 h. Spec HU-11.3, plan §4.
-- Titulares en Nuevo o Conversando, sin cita agendada futura y cuyo último mensaje entrante
-- tiene más de 24 h → Perdido (no_respondio), actor sistema.
-- Solo titulares con conversación: quien nunca escribió (ultimo_entrante_en null) y los
-- dependientes (los registra la doctora) no se mueven solos.

create or replace function private.perdidos_por_silencio(p_ahora timestamptz default now())
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_actor_previo text := current_setting('app.actor', true);
  v_id           bigint;
  v_movidos      integer := 0;
begin
  perform set_config('app.actor', 'sistema', true);

  for v_id in
    select p.id
      from public.pacientes p
      join public.conversaciones c on c.id = p.conversacion_id
     where p.responsable_id is null
       and p.etapa in ('nuevo', 'conversando')
       and c.ultimo_entrante_en < p_ahora - interval '24 hours'
       and not exists (
         select 1 from public.citas ci
          where ci.paciente_id = p.id
            and ci.estado = 'agendada'
            and ci.inicia_en > p_ahora
       )
     order by p.id
       for update of p skip locked  -- si Eli está escribiendo justo ahora, lo deja para la próxima vuelta
  loop
    perform private.cambiar_etapa(v_id, 'perdido', 'no_respondio');
    v_movidos := v_movidos + 1;
  end loop;

  perform set_config('app.actor', coalesce(v_actor_previo, ''), true);
  return v_movidos;
end;
$$;
comment on function private.perdidos_por_silencio(timestamptz) is
  'Cada 15 min (pg_cron): Nuevo/Conversando sin cita futura y 24 h sin escribir → Perdido (no_respondio).';
revoke all on function private.perdidos_por_silencio(timestamptz) from public, anon, authenticated, service_role;

-- Índice para el filtro por última actividad.
create index if not exists conversaciones_ultimo_entrante_en_idx
  on public.conversaciones (ultimo_entrante_en);

-- cron.schedule con el mismo nombre reemplaza el job: idempotente.
select cron.schedule(
  'perdidos-por-silencio',
  '*/15 * * * *',
  'select private.perdidos_por_silencio()'
);
