-- Eli → CRM sincronizado (pedido del usuario, 12-oct-2026):
--   1. Nombre completo desde cita_reservada.
--   2. Eventos nuevos cita_movida y cita_cancelada.
--
-- ───────────────────────── 1. Nombre completo ─────────────────────────
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
-- Pruebas: supabase/tests/11_nombre_desde_cita.test.sql y 12_cita_movida_cancelada.test.sql.

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

-- ───────────────────────── 2. cita_movida y cita_cancelada ─────────────────────────
-- Mismo cuerpo que la 0100 (sin texto) más dos ramas. Ambas son idempotentes: un reintento
-- responde duplicado = true sin escribir. El trigger de auditoría registra los cambios con actor
-- eli (app.actor). sync = ok porque el cambio ya está en Google Calendar: lo hizo Eli.
-- Entrada (jsonb plano, el campo «tipo» elige el evento):
--   {"tipo":"mensaje_entrante","telefono","nombre_whatsapp"?,"message_id","en"?}
--   {"tipo":"mensaje_saliente","telefono","execution_id","en"?}
--   {"tipo":"cita_reservada","telefono","gcal_event_id","inicio","fin"?,"servicio"?,"nombre"?}
--   {"tipo":"cita_movida","telefono","gcal_event_id","inicio","fin"?}
--   {"tipo":"cita_cancelada","telefono","gcal_event_id"}
-- Salida: {"ok": true, "duplicado": bool}. Error de datos → excepción 22023 (la Edge Function → 400).
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
  v_fin        timestamptz;
  v_cita       public.citas;
begin
  -- Todo lo que cambie esta llamada queda con actor = eli (auditoría y cambios_etapa).
  perform set_config('app.actor', 'eli', true);

  if v_tipo not in ('mensaje_entrante', 'mensaje_saliente', 'cita_reservada', 'cita_movida', 'cita_cancelada') then
    raise exception 'Evento desconocido: %', v_tipo using errcode = '22023';
  end if;
  -- Que nadie lo mande creyendo que se guarda.
  if p_evento ? 'texto' then
    raise exception 'texto ya no se acepta: el CRM no guarda el contenido de los mensajes'
      using errcode = '22023';
  end if;

  v_telefono := private.normalizar_telefono(private.campo_evento(p_evento, 'telefono'));

  -- ── mensaje_entrante ──
  if v_tipo = 'mensaje_entrante' then
    v_id_externo := private.campo_evento(p_evento, 'message_id');
    if exists (select 1 from public.mensajes where id_externo = v_id_externo) then
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;

    v_titular := private.asegurar_titular(v_telefono, p_evento ->> 'nombre_whatsapp');

    insert into public.mensajes (conversacion_id, id_externo, direccion, enviado_en)
    values (v_titular.conversacion_id, v_id_externo, 'entrante', v_en)
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
    insert into public.mensajes (conversacion_id, id_externo, direccion, enviado_en)
    values (v_titular.conversacion_id, v_id_externo, 'saliente', v_en)
    on conflict (id_externo) do nothing
    returning id into v_mensaje_id;
    return jsonb_build_object('ok', true, 'duplicado', v_mensaje_id is null);

  -- ── cita_reservada ──
  elsif v_tipo = 'cita_reservada' then
    v_inicio := private.campo_evento(p_evento, 'inicio')::timestamptz;
    -- 22023 (→ 400) en vez del 23514 del check de la tabla (→ 500).
    if nullif(p_evento ->> 'fin', '')::timestamptz <= v_inicio then
      raise exception 'fin debe ser posterior a inicio' using errcode = '22023';
    end if;
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

  -- ── cita_movida ──
  -- Eli cambió la hora en Google Calendar. Si el CRM no conocía la cita (se perdió el
  -- cita_reservada), se registra como cita_reservada ligada al titular del teléfono.
  elsif v_tipo = 'cita_movida' then
    v_inicio := private.campo_evento(p_evento, 'inicio')::timestamptz;
    if nullif(p_evento ->> 'fin', '')::timestamptz <= v_inicio then
      raise exception 'fin debe ser posterior a inicio' using errcode = '22023';
    end if;
    select * into v_cita from public.citas
     where gcal_event_id = private.campo_evento(p_evento, 'gcal_event_id')
       for update;
    if not found then
      return public.registrar_evento_eli(jsonb_set(p_evento, '{tipo}', '"cita_reservada"'));
    end if;
    -- Una cita atendida, no asistida o cancelada ya no se mueve.
    if v_cita.estado <> 'agendada' then
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;
    -- Sin fin: conserva la duración que tenía.
    v_fin := coalesce(nullif(p_evento ->> 'fin', '')::timestamptz,
                      v_inicio + (v_cita.termina_en - v_cita.inicia_en));
    if v_fin <= v_inicio then
      raise exception 'fin debe ser posterior a inicio' using errcode = '22023';
    end if;
    if v_cita.inicia_en = v_inicio and v_cita.termina_en = v_fin then
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;
    update public.citas
       set inicia_en = v_inicio, termina_en = v_fin,
           sync = 'ok', sync_error = null  -- Calendar ya tiene la hora nueva: la movió Eli
     where id = v_cita.id;
    return jsonb_build_object('ok', true, 'duplicado', false);

  -- ── cita_cancelada ──
  -- Eli canceló la cita en Google Calendar. Si el CRM no la conoce, no hace nada.
  -- Igual que cancelar_cita, no cambia la etapa del paciente.
  else
    select * into v_cita from public.citas
     where gcal_event_id = private.campo_evento(p_evento, 'gcal_event_id')
       for update;
    if not found then
      return jsonb_build_object('ok', true, 'duplicado', false);
    end if;
    if v_cita.estado <> 'agendada' then  -- ya cancelada (reintento) o ya atendida
      return jsonb_build_object('ok', true, 'duplicado', true);
    end if;
    update public.citas
       set estado = 'cancelada',
           sync = 'ok', sync_error = null  -- ya no está en Calendar: la borró Eli
     where id = v_cita.id;
    return jsonb_build_object('ok', true, 'duplicado', false);
  end if;
end;
$$;
comment on function public.registrar_evento_eli(jsonb) is
  'Contrato Eli → CRM (mensaje_entrante, mensaje_saliente, cita_reservada, cita_movida, cita_cancelada). Idempotente. Sin contenido de mensajes. Solo service_role.';
-- create or replace conserva los permisos; se repiten para que la migración se lea sola.
revoke all on function public.registrar_evento_eli(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento_eli(jsonb) to service_role;
