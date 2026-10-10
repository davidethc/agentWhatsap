-- TK-5 · Reglas del embudo: historial de etapas, mover_etapa y marcar_asistencia.
-- ADR 0011: las reglas viven en la base. Spec HU-2 y HU-5.

-- ───────────────────────── etapa_cambiada_en ─────────────────────────
create or replace function private.poner_etapa_cambiada_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_cambiada_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists poner_etapa_cambiada_en on public.pacientes;
create trigger poner_etapa_cambiada_en
  before update of etapa on public.pacientes
  for each row execute function private.poner_etapa_cambiada_en();

-- ───────────────────────── Historial (cambios_etapa) ─────────────────────────
-- Un trigger, no las funciones, escribe el historial: así queda registrado aunque la etapa
-- cambie por otra vía (panel, Eli, Calendar o la tarea de las 24 h).
create or replace function private.registrar_cambio_etapa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.actor := private.actor_actual();
begin
  if tg_op = 'UPDATE'
     and new.etapa is not distinct from old.etapa
     and new.motivo_perdido is not distinct from old.motivo_perdido then
    return null;
  end if;

  insert into public.cambios_etapa (paciente_id, de, a, motivo_perdido, actor, personal_id)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.etapa end,
    new.etapa,
    new.motivo_perdido,
    v_actor,
    case when v_actor = 'personal' then (select auth.uid()) end
  );
  return null;
end;
$$;
revoke all on function private.registrar_cambio_etapa() from public, anon, authenticated;

drop trigger if exists registrar_cambio_etapa on public.pacientes;
create trigger registrar_cambio_etapa
  after insert or update of etapa, motivo_perdido on public.pacientes
  for each row execute function private.registrar_cambio_etapa();

-- ───────────────────────── Núcleo: cambiar_etapa ─────────────────────────
-- Lo usan mover_etapa, marcar_asistencia, guardar_cita, registrar_evento_eli y la tarea de 24 h.
-- security invoker: respeta la RLS de quien llama.
create or replace function private.cambiar_etapa(
  p_paciente_id bigint,
  p_etapa       public.etapa,
  p_motivo      public.motivo_perdido default null
)
returns public.pacientes
language plpgsql
set search_path = ''
as $$
declare
  v_paciente public.pacientes;
begin
  if p_etapa = 'perdido' and p_motivo is null then
    raise exception 'Para mover a Perdido hace falta el motivo'
      using errcode = '22023', hint = 'Motivos: no_respondio, indeciso, no_asistio.';
  end if;

  update public.pacientes
     set etapa = p_etapa,
         motivo_perdido = case when p_etapa = 'perdido' then p_motivo end
   where id = p_paciente_id
  returning * into v_paciente;

  if not found then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  return v_paciente;
end;
$$;
revoke all on function private.cambiar_etapa(bigint, public.etapa, public.motivo_perdido) from public, anon;
grant execute on function private.cambiar_etapa(bigint, public.etapa, public.motivo_perdido)
  to authenticated, service_role;

-- Corta con 42501 si quien llama no es del personal.
create or replace function private.exigir_personal()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.es_personal()) then
    raise exception 'Solo el personal del consultorio puede hacer esto' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.exigir_personal() from public, anon;
grant execute on function private.exigir_personal() to authenticated, service_role;

-- ───────────────────────── mover_etapa (panel, HU-5) ─────────────────────────
create or replace function public.mover_etapa(
  p_paciente_id bigint,
  p_etapa       public.etapa,
  p_motivo      public.motivo_perdido default null
)
returns public.pacientes
language plpgsql
set search_path = ''
as $$
begin
  perform private.exigir_personal();
  return private.cambiar_etapa(p_paciente_id, p_etapa, p_motivo);
end;
$$;
comment on function public.mover_etapa(bigint, public.etapa, public.motivo_perdido) is
  'Cambio manual de etapa (kanban). Perdido exige motivo. Queda en cambios_etapa con el actor.';
revoke all on function public.mover_etapa(bigint, public.etapa, public.motivo_perdido) from public, anon;
grant execute on function public.mover_etapa(bigint, public.etapa, public.motivo_perdido)
  to authenticated, service_role;

-- ───────────────────────── marcar_asistencia (resumen, HU-2) ─────────────────────────
-- p_volver_el: por defecto hoy (Guayaquil) + 6 meses; una fecha; o null = sin retorno.
create or replace function public.marcar_asistencia(
  p_cita_id   bigint,
  p_asistio   boolean,
  p_volver_el date default ((now() at time zone 'America/Guayaquil')::date + interval '6 months')::date
)
returns public.citas
language plpgsql
set search_path = ''
as $$
declare
  v_cita public.citas;
begin
  perform private.exigir_personal();

  select * into v_cita from public.citas where id = p_cita_id for update;
  if not found then
    raise exception 'Cita no encontrada' using errcode = 'P0002';
  end if;
  if v_cita.paciente_id is null then
    raise exception 'La cita no está vinculada a un paciente' using errcode = '22023';
  end if;
  if v_cita.estado = 'cancelada' then
    raise exception 'La cita está cancelada' using errcode = '22023';
  end if;

  update public.citas
     set estado = case when p_asistio then 'asistio' else 'no_asistio' end::public.estado_cita
   where id = p_cita_id
  returning * into v_cita;

  if p_asistio then
    perform private.cambiar_etapa(v_cita.paciente_id, 'seguimiento');
    update public.pacientes set volver_el = p_volver_el where id = v_cita.paciente_id;
  else
    perform private.cambiar_etapa(v_cita.paciente_id, 'perdido', 'no_asistio');
  end if;

  return v_cita;
end;
$$;
comment on function public.marcar_asistencia(bigint, boolean, date) is
  'Asistió → cita asistio, paciente Seguimiento y volver_el (hoy + 6 meses por defecto, fecha dada o null). '
  'No asistió → cita no_asistio y paciente Perdido (no_asistio).';
revoke all on function public.marcar_asistencia(bigint, boolean, date) from public, anon;
grant execute on function public.marcar_asistencia(bigint, boolean, date) to authenticated, service_role;
