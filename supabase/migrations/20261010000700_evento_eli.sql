-- TK-7 · registrar_evento_eli: contrato Eli → CRM (docs/crm/plan.md §5). Spec HU-11 y HU-12.
-- La llama solo la Edge Function «eli-evento» con la clave de servicio. Idempotente.
--
-- Entrada (jsonb plano, el campo «tipo» elige el evento):
--   {"tipo":"mensaje_entrante","telefono","nombre_whatsapp"?,"message_id","texto"?,"en"?}
--   {"tipo":"mensaje_saliente","telefono","texto"?,"execution_id","en"?}
--   {"tipo":"cita_reservada","telefono","gcal_event_id","inicio","fin"?,"servicio"?,"nombre"?}
-- Salida: {"ok": true, "duplicado": bool}. Error de datos → excepción 22023 (la Edge Function → 400).

-- ───────────────────────── Ayudantes ─────────────────────────
-- Campo de texto obligatorio del evento.
create or replace function private.campo_evento(p_evento jsonb, p_campo text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(btrim(p_evento ->> p_campo), '');
begin
  if v is null then
    raise exception 'Falta el campo %', p_campo using errcode = '22023';
  end if;
  return v;
end;
$$;
revoke all on function private.campo_evento(jsonb, text) from public, anon, authenticated;
grant execute on function private.campo_evento(jsonb, text) to service_role;

-- Conversación del teléfono (la crea si no existe) y su titular (lo crea en Nuevo, origen whatsapp).
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
  v_titular         public.pacientes;
begin
  insert into public.conversaciones (telefono, nombre_whatsapp)
  values (p_telefono, nullif(btrim(p_nombre_whatsapp), ''))
  on conflict (telefono) do update
    set nombre_whatsapp = coalesce(excluded.nombre_whatsapp, public.conversaciones.nombre_whatsapp)
  returning id into v_conversacion_id;

  select * into v_titular from public.pacientes
   where conversacion_id = v_conversacion_id and responsable_id is null;
  if not found then
    insert into public.pacientes (conversacion_id, nombre, origen)
    values (
      v_conversacion_id,
      coalesce(nullif(btrim(p_nombre), ''), nullif(btrim(p_nombre_whatsapp), ''), 'Sin nombre'),
      'whatsapp'
    )
    returning * into v_titular;
  end if;
  return v_titular;
end;
$$;
revoke all on function private.asegurar_titular(text, text, text) from public, anon, authenticated;
grant execute on function private.asegurar_titular(text, text, text) to service_role;

-- ───────────────────────── registrar_evento_eli ─────────────────────────
create or replace function public.registrar_evento_eli(p_evento jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tipo       text := private.campo_evento(p_evento, 'tipo');
  v_telefono   text;
  v_id_externo text;
  v_en         timestamptz := coalesce(nullif(p_evento ->> 'en', '')::timestamptz, now());
  v_titular    public.pacientes;
  v_mensaje_id bigint;
  v_turnos     integer;
  v_inicio     timestamptz;
  v_insertada  boolean;
begin
  -- Todo lo que cambie esta llamada queda con actor = eli (auditoría y cambios_etapa).
  perform set_config('app.actor', 'eli', true);

  if v_tipo not in ('mensaje_entrante', 'mensaje_saliente', 'cita_reservada') then
    raise exception 'Evento desconocido: %', v_tipo using errcode = '22023';
  end if;

  v_telefono := private.normalizar_telefono(private.campo_evento(p_evento, 'telefono'));

  -- ── mensaje_entrante ──
  if v_tipo = 'mensaje_entrante' then
    v_id_externo := private.campo_evento(p_evento, 'message_id');
    if exists (select 1 from public.mensajes where id_externo = v_id_externo) then
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;

    v_titular := private.asegurar_titular(v_telefono, p_evento ->> 'nombre_whatsapp');

    insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
    values (v_titular.conversacion_id, v_id_externo, 'entrante', coalesce(p_evento ->> 'texto', ''), v_en)
    on conflict (id_externo) do nothing
    returning id into v_mensaje_id;
    if v_mensaje_id is null then  -- llegó a la vez por otra vía
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;

    update public.conversaciones
       set turnos_entrantes   = turnos_entrantes + 1,
           ultimo_entrante_en = greatest(ultimo_entrante_en, v_en)
     where id = v_titular.conversacion_id
    returning turnos_entrantes into v_turnos;

    -- Nuevo → Conversando al 2.º turno; Perdido → Conversando si vuelve a escribir.
    if v_titular.etapa = 'perdido' or (v_titular.etapa = 'nuevo' and v_turnos >= 2) then
      perform private.cambiar_etapa(v_titular.id, 'conversando');
    end if;
    return jsonb_build_object('ok', true, 'duplicado', false);

  -- ── mensaje_saliente ──
  elsif v_tipo = 'mensaje_saliente' then
    v_id_externo := 'out:' || private.campo_evento(p_evento, 'execution_id');
    if exists (select 1 from public.mensajes where id_externo = v_id_externo) then
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;

    v_titular := private.asegurar_titular(v_telefono);
    insert into public.mensajes (conversacion_id, id_externo, direccion, texto, enviado_en)
    values (v_titular.conversacion_id, v_id_externo, 'saliente', coalesce(p_evento ->> 'texto', ''), v_en)
    on conflict (id_externo) do nothing
    returning id into v_mensaje_id;
    return jsonb_build_object('ok', true, 'duplicado', v_mensaje_id is null);

  -- ── cita_reservada ──
  else
    v_inicio := private.campo_evento(p_evento, 'inicio')::timestamptz;
    v_titular := private.asegurar_titular(v_telefono, null, p_evento ->> 'nombre');

    insert into public.citas (paciente_id, gcal_event_id, inicia_en, termina_en, servicio, origen, sync)
    values (
      v_titular.id,
      private.campo_evento(p_evento, 'gcal_event_id'),
      v_inicio,
      coalesce(nullif(p_evento ->> 'fin', '')::timestamptz, v_inicio + interval '1 hour'),
      nullif(btrim(p_evento ->> 'servicio'), ''),
      'eli',
      'ok'  -- ya existe en Google Calendar: lo creó Eli
    )
    on conflict (gcal_event_id) do update
      set inicia_en   = excluded.inicia_en,
          termina_en  = excluded.termina_en,
          servicio    = coalesce(excluded.servicio, public.citas.servicio),
          paciente_id = coalesce(public.citas.paciente_id, excluded.paciente_id)
    returning (xmax = 0) into v_insertada;

    if v_insertada and v_titular.etapa <> 'agendo' then
      perform private.cambiar_etapa(v_titular.id, 'agendo');
    end if;
    return jsonb_build_object('ok', true, 'duplicado', not v_insertada);
  end if;
end;
$$;
comment on function public.registrar_evento_eli(jsonb) is
  'Contrato Eli → CRM (mensaje_entrante, mensaje_saliente, cita_reservada). Idempotente. Solo service_role.';
revoke all on function public.registrar_evento_eli(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento_eli(jsonb) to service_role;

-- ───────────────────────── Higiene ─────────────────────────
-- Funciones que solo usan los triggers: nadie las llama directo.
revoke all on function private.poner_updated_at() from public, anon, authenticated;
revoke all on function private.poner_etapa_cambiada_en() from public, anon, authenticated;
revoke all on function private.auditoria_inmutable() from public, anon, authenticated;
