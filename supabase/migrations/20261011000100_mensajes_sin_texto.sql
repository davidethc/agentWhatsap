-- TK-41 · El CRM no guarda el contenido de los mensajes (decisión del usuario, 11-oct-2026).
-- mensajes se queda con dirección y hora: alcanza para la conversación de la ficha, los turnos y
-- el embudo, y evita guardar datos de salud que el paciente escriba por WhatsApp.
--
-- Orden seguro en un solo despliegue (nada en producción usa la columna todavía):
--   1. registrar_evento_eli deja de escribirla y rechaza «texto» (22023 → 400 en eli-evento),
--   2. se borra la columna.

-- ───────────────────────── registrar_evento_eli sin texto ─────────────────────────
-- Entrada (jsonb plano, el campo «tipo» elige el evento):
--   {"tipo":"mensaje_entrante","telefono","nombre_whatsapp"?,"message_id","en"?}
--   {"tipo":"mensaje_saliente","telefono","execution_id","en"?}
--   {"tipo":"cita_reservada","telefono","gcal_event_id","inicio","fin"?,"servicio"?,"nombre"?}
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
begin
  -- Todo lo que cambie esta llamada queda con actor = eli (auditoría y cambios_etapa).
  perform set_config('app.actor', 'eli', true);

  if v_tipo not in ('mensaje_entrante', 'mensaje_saliente', 'cita_reservada') then
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
  'Contrato Eli → CRM (mensaje_entrante, mensaje_saliente, cita_reservada). Idempotente. Sin contenido de mensajes. Solo service_role.';
-- create or replace conserva los permisos; se repiten para que la migración se lea sola.
revoke all on function public.registrar_evento_eli(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento_eli(jsonb) to service_role;

-- ───────────────────────── mensajes sin texto ─────────────────────────
alter table public.mensajes drop column if exists texto;
comment on table public.mensajes is
  'Conversación con Eli: solo dirección y hora, nunca el contenido (TK-41). La escribe registrar_evento_eli.';
