-- TK-6 · crear_paciente (duplicado y responsable), guardar_cita y cancelar_cita.
-- Spec HU-8 y HU-9. Zona horaria del consultorio: America/Guayaquil.

-- ───────────────────────── Teléfono 593… ─────────────────────────
-- Acepta 09…, 9…, +593…, 00593… y fijos 0X…; devuelve 593 + 8 o 9 dígitos, o null si viene vacío.
create or replace function private.normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
begin
  if v = '' then
    return null;
  end if;
  if v like '00%' then
    v := substr(v, 3);
  end if;
  if v ~ '^0[0-9]{8,9}$' then
    v := '593' || substr(v, 2);
  elsif v ~ '^9[0-9]{8}$' then
    v := '593' || v;
  end if;
  if v !~ '^593[0-9]{8,9}$' then
    -- Sin el número en el mensaje: es un dato personal.
    raise exception 'Teléfono no válido' using errcode = '22023',
      hint = 'Use un número de Ecuador: 09…, 0X… o +593….';
  end if;
  return v;
end;
$$;
revoke all on function private.normalizar_telefono(text) from public, anon;
grant execute on function private.normalizar_telefono(text) to authenticated, service_role;

-- ───────────────────────── crear_paciente (HU-8) ─────────────────────────
-- Devuelve {"duplicado": bool, "paciente": {fila de pacientes}}.
--  · Con responsable: crea un dependiente en la conversación del responsable (p_telefono se ignora).
--  · Con teléfono ya registrado y sin responsable: no crea nada y devuelve al titular (duplicado).
--  · Sin teléfono: paciente sin conversación.
create or replace function public.crear_paciente(
  p_nombre           text,
  p_origen           public.origen_paciente,
  p_telefono         text default null,
  p_cedula           text default null,
  p_fecha_nacimiento date default null,
  p_correo           text default null,
  p_responsable_id   bigint default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_telefono        text;
  v_conversacion_id bigint;
  v_responsable     public.pacientes;
  v_paciente        public.pacientes;
begin
  perform private.exigir_personal();

  if p_responsable_id is not null then
    select * into v_responsable from public.pacientes where id = p_responsable_id;
    if not found then
      raise exception 'Responsable no encontrado' using errcode = 'P0002';
    end if;
    v_conversacion_id := v_responsable.conversacion_id;
  else
    v_telefono := private.normalizar_telefono(p_telefono);
    if v_telefono is not null then
      insert into public.conversaciones (telefono) values (v_telefono)
      on conflict (telefono) do nothing
      returning id into v_conversacion_id;

      if v_conversacion_id is null then
        select id into v_conversacion_id from public.conversaciones where telefono = v_telefono;
        select * into v_paciente from public.pacientes
         where conversacion_id = v_conversacion_id and responsable_id is null;
        if found then
          return jsonb_build_object('duplicado', true, 'paciente', to_jsonb(v_paciente));
        end if;
      end if;
    end if;
  end if;

  insert into public.pacientes
    (conversacion_id, responsable_id, nombre, cedula, fecha_nacimiento, correo, origen)
  values
    (v_conversacion_id, p_responsable_id, btrim(p_nombre), nullif(btrim(p_cedula), ''),
     p_fecha_nacimiento, nullif(btrim(p_correo), ''), p_origen)
  returning * into v_paciente;

  return jsonb_build_object('duplicado', false, 'paciente', to_jsonb(v_paciente));
end;
$$;
comment on function public.crear_paciente(text, public.origen_paciente, text, text, date, text, bigint) is
  'Nuevo paciente en Nuevo. Teléfono ya registrado → {duplicado: true, paciente: titular}; '
  'con p_responsable_id → dependiente en la misma conversación.';
revoke all on function public.crear_paciente(text, public.origen_paciente, text, text, date, text, bigint)
  from public, anon;
grant execute on function public.crear_paciente(text, public.origen_paciente, text, text, date, text, bigint)
  to authenticated, service_role;

-- ───────────────────────── Validaciones de agenda ─────────────────────────
-- Dentro del horario del consultorio (tabla horario), el mismo día, en hora de Guayaquil.
create or replace function private.validar_horario(p_inicia_en timestamptz, p_termina_en timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ini timestamp := p_inicia_en at time zone 'America/Guayaquil';
  v_fin timestamp := p_termina_en at time zone 'America/Guayaquil';
begin
  if p_termina_en <= p_inicia_en then
    raise exception 'La cita debe terminar después de empezar' using errcode = '22023';
  end if;
  if v_ini::date <> v_fin::date or not exists (
    select 1 from public.horario h
     where h.dia_semana = extract(isodow from v_ini)
       and v_ini::time >= h.abre
       and v_fin::time <= h.cierra
  ) then
    raise exception 'La cita está fuera del horario del consultorio' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.validar_horario(timestamptz, timestamptz) from public, anon;
grant execute on function private.validar_horario(timestamptz, timestamptz) to authenticated, service_role;

-- Sin choque con otra cita no cancelada. Serializa con un candado de transacción para que dos
-- guardados simultáneos no se metan en el mismo hueco.
create or replace function private.validar_sin_choque(
  p_inicia_en timestamptz, p_termina_en timestamptz, p_excluir_cita_id bigint default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('eli-crm:agenda', 0));
  if exists (
    select 1 from public.citas c
     where c.estado <> 'cancelada'
       and c.id is distinct from p_excluir_cita_id
       and c.inicia_en < p_termina_en
       and c.termina_en > p_inicia_en
  ) then
    raise exception 'Ya hay otra cita en ese horario' using errcode = '23P01';
  end if;
end;
$$;
revoke all on function private.validar_sin_choque(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function private.validar_sin_choque(timestamptz, timestamptz, bigint)
  to authenticated, service_role;

-- ───────────────────────── guardar_cita (HU-9) ─────────────────────────
-- Sin p_cita_id crea (origen panel) y el paciente pasa a Agendó.
-- Con p_cita_id edita una cita agendada (mover, cambiar servicio o vincular un paciente); si cambia
-- el paciente, el nuevo pasa a Agendó. Siempre deja sync = pendiente para Google Calendar.
create or replace function public.guardar_cita(
  p_paciente_id bigint,
  p_inicia_en   timestamptz,
  p_termina_en  timestamptz default null,
  p_servicio    text default null,
  p_cita_id     bigint default null
)
returns public.citas
language plpgsql
set search_path = ''
as $$
declare
  v_termina_en timestamptz := coalesce(p_termina_en, p_inicia_en + interval '1 hour');
  v_cita       public.citas;
  v_antes      public.citas;
begin
  perform private.exigir_personal();

  if not exists (select 1 from public.pacientes where id = p_paciente_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;

  if p_cita_id is not null then
    select * into v_antes from public.citas where id = p_cita_id for update;
    if not found then
      raise exception 'Cita no encontrada' using errcode = 'P0002';
    end if;
    if v_antes.estado <> 'agendada' then
      raise exception 'Solo se puede editar una cita agendada' using errcode = '22023';
    end if;
  end if;

  perform private.validar_horario(p_inicia_en, v_termina_en);
  perform private.validar_sin_choque(p_inicia_en, v_termina_en, p_cita_id);

  if p_cita_id is null then
    insert into public.citas (paciente_id, inicia_en, termina_en, servicio, origen, sync)
    values (p_paciente_id, p_inicia_en, v_termina_en, nullif(btrim(p_servicio), ''), 'panel', 'pendiente')
    returning * into v_cita;
  else
    update public.citas
       set paciente_id = p_paciente_id,
           inicia_en   = p_inicia_en,
           termina_en  = v_termina_en,
           servicio    = nullif(btrim(p_servicio), ''),
           sync        = 'pendiente',
           sync_error  = null
     where id = p_cita_id
    returning * into v_cita;
  end if;

  if p_cita_id is null or v_antes.paciente_id is distinct from p_paciente_id then
    perform private.cambiar_etapa(p_paciente_id, 'agendo');
  end if;

  return v_cita;
end;
$$;
comment on function public.guardar_cita(bigint, timestamptz, timestamptz, text, bigint) is
  'Crea (sin p_cita_id) o edita una cita agendada. 1 h por defecto, dentro del horario y sin choque. '
  'Paciente → Agendó. sync = pendiente.';
revoke all on function public.guardar_cita(bigint, timestamptz, timestamptz, text, bigint) from public, anon;
grant execute on function public.guardar_cita(bigint, timestamptz, timestamptz, text, bigint)
  to authenticated, service_role;

-- ───────────────────────── cancelar_cita (HU-9) ─────────────────────────
-- Cancela una cita agendada (sync = pendiente para borrarla en Calendar). Repetir no falla.
-- No cambia la etapa del paciente (la Spec no lo pide).
create or replace function public.cancelar_cita(p_cita_id bigint)
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
  if v_cita.estado = 'cancelada' then
    return v_cita;
  end if;
  if v_cita.estado <> 'agendada' then
    raise exception 'Solo se puede cancelar una cita agendada' using errcode = '22023';
  end if;

  update public.citas
     set estado = 'cancelada', sync = 'pendiente', sync_error = null
   where id = p_cita_id
  returning * into v_cita;
  return v_cita;
end;
$$;
revoke all on function public.cancelar_cita(bigint) from public, anon;
grant execute on function public.cancelar_cita(bigint) to authenticated, service_role;
