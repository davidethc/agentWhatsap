-- TK-16 · Funciones de base para el pull incremental de Google Calendar (Plan §6).
-- Las llama solo la Edge Function «calendario» con la clave de servicio.

-- ───────────────────────── syncToken ─────────────────────────
create or replace function public.calendario_leer_token(p_calendario_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select sync_token from public.sync_calendario where calendario_id = p_calendario_id;
$$;

-- Con p_token null se borra el token (Google respondió 410: hay que resincronizar) sin tocar la fecha
-- de la última sincronización.
create or replace function public.calendario_guardar_token(p_calendario_id text, p_token text)
returns void
language sql
set search_path = ''
as $$
  insert into public.sync_calendario (calendario_id, sync_token, ultima_sync_en)
  values (p_calendario_id, p_token, case when p_token is null then null else now() end)
  on conflict (calendario_id) do update
    set sync_token     = excluded.sync_token,
        ultima_sync_en = case when excluded.sync_token is null
                              then public.sync_calendario.ultima_sync_en else now() end;
$$;

-- ───────────────────────── aplicar_evento_calendario ─────────────────────────
-- Un evento de Calendar (ya normalizado por la función) → la cita que corresponde.
--   {"gcal_event_id","etag","estado":"activo"|"cancelado","inicio","fin","resumen","descripcion","crm_cita_id"?}
-- Devuelve {"ok":true,"accion": creada_ligada | creada_sin_vincular | actualizada | cancelada |
--                                conflicto | igual | ignorada}.
-- Reglas:
--  · evento conocido (gcal_event_id) → actualiza hora y duración; si fue borrado → cita Cancelada;
--  · evento nuevo con «Tel: 593…» de una conversación conocida → lo liga al titular (y lo pasa a Agendó);
--  · evento nuevo sin paciente → cita sin vincular (origen calendario);
--  · si la cita tenía un cambio del panel sin enviar y Calendar también cambió, GANA CALENDAR: se
--    aplica lo de Calendar y queda una fila en errores_integracion (y la auditoría de citas).
create or replace function public.aplicar_evento_calendario(p_evento jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id        text := nullif(btrim(p_evento ->> 'gcal_event_id'), '');
  v_etag      text := nullif(p_evento ->> 'etag', '');
  v_cancelado boolean := coalesce(p_evento ->> 'estado', 'activo') = 'cancelado';
  v_inicio    timestamptz;
  v_fin       timestamptz;
  v_resumen   text := nullif(btrim(p_evento ->> 'resumen'), '');
  v_desc      text := p_evento ->> 'descripcion';
  v_cita      public.citas;
  v_cita_crm  bigint;
  v_tel       text;
  v_conv_id   bigint;
  v_titular   public.pacientes;
  v_servicio  text;
  v_diferente boolean;
  v_nueva_id  bigint;
begin
  if v_id is null then
    raise exception 'Falta gcal_event_id' using errcode = '22023';
  end if;
  -- Todo lo que cambie queda con actor = calendario (auditoría) y el trigger de TK-17 no lo reenvía.
  perform set_config('app.actor', 'calendario', true);

  select * into v_cita from public.citas where gcal_event_id = v_id;

  -- Evento creado por nuestro push cuya respuesta no alcanzó a guardarse: se adopta por crm_cita_id.
  if not found and nullif(p_evento ->> 'crm_cita_id', '') ~ '^[0-9]+$' then
    v_cita_crm := (p_evento ->> 'crm_cita_id')::bigint;
    select * into v_cita from public.citas where id = v_cita_crm and gcal_event_id is null;
    if found then
      update public.citas set gcal_event_id = v_id where id = v_cita.id returning * into v_cita;
    end if;
  end if;

  -- ── Evento borrado en Calendar ──
  if v_cancelado then
    if v_cita.id is null or v_cita.estado = 'cancelada' then
      return jsonb_build_object('ok', true, 'accion', case when v_cita.id is null then 'ignorada' else 'igual' end);
    end if;
    if v_cita.sync <> 'ok' then  -- el panel tenía algo sin enviar: gana Calendar
      insert into public.errores_integracion (origen, detalle) values ('calendario', jsonb_build_object(
        'tipo', 'conflicto', 'cita_id', v_cita.id, 'gcal_event_id', v_id,
        'panel', jsonb_build_object('estado', v_cita.estado, 'inicia_en', v_cita.inicia_en, 'termina_en', v_cita.termina_en),
        'calendar', jsonb_build_object('estado', 'cancelado'), 'ganador', 'calendario'));
    end if;
    update public.citas set estado = 'cancelada', sync = 'ok', sync_error = null, gcal_etag = null
     where id = v_cita.id;
    return jsonb_build_object('ok', true, 'accion', case when v_cita.sync <> 'ok' then 'conflicto' else 'cancelada' end);
  end if;

  -- ── Evento activo: necesita hora de inicio y fin ──
  v_inicio := nullif(p_evento ->> 'inicio', '')::timestamptz;
  v_fin    := nullif(p_evento ->> 'fin', '')::timestamptz;
  if v_inicio is null or v_fin is null or v_fin <= v_inicio then
    return jsonb_build_object('ok', true, 'accion', 'ignorada');
  end if;

  -- ── Evento que ya conocemos ──
  if v_cita.id is not null then
    if v_cita.estado = 'cancelada' then  -- el panel la canceló; el borrado del evento va por el push
      return jsonb_build_object('ok', true, 'accion', 'ignorada');
    end if;
    v_diferente := v_cita.inicia_en <> v_inicio or v_cita.termina_en <> v_fin;

    if v_etag is not null and v_etag = v_cita.gcal_etag then
      return jsonb_build_object('ok', true, 'accion', 'igual');  -- eco de nuestro propio push
    end if;

    if v_cita.sync <> 'ok' and v_diferente then  -- cambio del panel sin enviar + cambio en Calendar
      insert into public.errores_integracion (origen, detalle) values ('calendario', jsonb_build_object(
        'tipo', 'conflicto', 'cita_id', v_cita.id, 'gcal_event_id', v_id,
        'panel', jsonb_build_object('inicia_en', v_cita.inicia_en, 'termina_en', v_cita.termina_en),
        'calendar', jsonb_build_object('inicia_en', v_inicio, 'termina_en', v_fin), 'ganador', 'calendario'));
      update public.citas
         set inicia_en = v_inicio, termina_en = v_fin, gcal_etag = v_etag, sync = 'ok', sync_error = null
       where id = v_cita.id;
      return jsonb_build_object('ok', true, 'accion', 'conflicto');
    end if;

    update public.citas
       set inicia_en = v_inicio, termina_en = v_fin, gcal_etag = v_etag, sync = 'ok', sync_error = null
     where id = v_cita.id;
    return jsonb_build_object('ok', true, 'accion', case when v_diferente then 'actualizada' else 'igual' end);
  end if;

  -- ── Evento nuevo ──
  -- ¿Es de Eli? Su descripción lleva «Tel: 593…».
  begin
    v_tel := private.normalizar_telefono(substring(v_desc from 'Tel:\s*([+0-9][0-9 ]{7,14})'));
  exception when others then
    v_tel := null;
  end;
  if v_tel is not null then
    select id into v_conv_id from public.conversaciones where telefono = v_tel;
    if found then
      select * into v_titular from public.pacientes where conversacion_id = v_conv_id and responsable_id is null;
    end if;
  end if;

  if v_titular.id is not null then
    v_servicio := nullif(btrim(split_part(regexp_replace(coalesce(v_resumen, ''), '^[^[:alnum:]]+', ''), ' - ', 1)), '');
    insert into public.citas (paciente_id, gcal_event_id, gcal_etag, inicia_en, termina_en, servicio, origen, sync)
    values (v_titular.id, v_id, v_etag, v_inicio, v_fin, v_servicio, 'eli', 'ok')
    on conflict (gcal_event_id) do nothing
    returning id into v_nueva_id;
    if v_nueva_id is not null and v_titular.etapa <> 'agendo' then
      perform private.cambiar_etapa(v_titular.id, 'agendo');
    end if;
    return jsonb_build_object('ok', true, 'accion', case when v_nueva_id is null then 'igual' else 'creada_ligada' end);
  end if;

  -- Sin paciente: cita sin vincular; el título del evento queda en «servicio» para que la doctora la reconozca.
  v_servicio := left(nullif(btrim(regexp_replace(coalesce(v_resumen, ''), '^[^[:alnum:]]+', '')), ''), 120);
  insert into public.citas (paciente_id, gcal_event_id, gcal_etag, inicia_en, termina_en, servicio, origen, sync)
  values (null, v_id, v_etag, v_inicio, v_fin, v_servicio, 'calendario', 'ok')
  on conflict (gcal_event_id) do nothing
  returning id into v_nueva_id;
  return jsonb_build_object('ok', true, 'accion', case when v_nueva_id is null then 'igual' else 'creada_sin_vincular' end);
end;
$$;
comment on function public.aplicar_evento_calendario(jsonb) is
  'Calendar → Panel: aplica un evento a la cita que le corresponde. Gana Calendar en conflicto. Solo service_role.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.calendario_leer_token(text)',
    'public.calendario_guardar_token(text, text)',
    'public.aplicar_evento_calendario(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
