-- TK-11 · Datos de prueba del Eli Panel. TODO ES INVENTADO: nombres ficticios, teléfonos
-- 5939000000xx (no existen), cédulas 0000000xxx y correos @ejemplo.test.
-- Las fechas son relativas a HOY en America/Guayaquil: tras cada `supabase db reset` hay citas de
-- hoy y de la semana. Ojo: la tarea de las 24 h (pg_cron) pasa a Perdido a quien lleve más de 24 h
-- sin escribir; para volver a tener todas las etapas, otro `supabase db reset`.
--
-- Acceso local (SOLO LOCAL, nunca en el proyecto remoto):
--   correo: doctora@ejemplo.test · contraseña: EliPanel-local-2026

-- ───────────────────────── Doctora de prueba ─────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', 'd0c70000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'doctora@ejemplo.test',
  extensions.crypt('EliPanel-local-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"nombre":"Doctora Prueba"}', now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select 'd0c70000-0000-4000-8000-000000000001', 'd0c70000-0000-4000-8000-000000000001', 'email',
       jsonb_build_object('sub', 'd0c70000-0000-4000-8000-000000000001',
                          'email', 'doctora@ejemplo.test', 'email_verified', true),
       now(), now(), now()
where not exists (select 1 from auth.identities where user_id = 'd0c70000-0000-4000-8000-000000000001');

insert into public.personal (user_id, nombre, rol)
values ('d0c70000-0000-4000-8000-000000000001', 'Doctora Prueba', 'doctora')
on conflict (user_id) do nothing;

-- ───────────────────────── Pacientes, mensajes y citas ─────────────────────────
do $$
declare
  v_hoy   date := (now() at time zone 'America/Guayaquil')::date;
  v_ahora timestamptz := now();
  v_p     record;  -- (n, nombre, origen, etapa, motivo, con_whatsapp, creado hace (días), turnos)
  v_conv  bigint;
  v_pac   bigint;
  v_ids   bigint[] := '{}';
begin
  perform set_config('app.actor', 'sistema', true);

  for v_p in
    select * from (values
      ( 1, 'Ana Prueba',        'whatsapp',   'nuevo',       null,           true,   0, 1),
      ( 2, 'Bruno Ficticio',    'whatsapp',   'nuevo',       null,           true,   0, 1),
      ( 3, 'Carla Inventada',   'whatsapp',   'nuevo',       null,           true,   0, 1),
      ( 4, 'Diego Demo',        'llamada',    'nuevo',       null,           true,   1, 0),
      ( 5, 'Elena Ejemplo',     'whatsapp',   'conversando', null,           true,   1, 3),
      ( 6, 'Fabián Simulado',   'whatsapp',   'conversando', null,           true,   2, 2),
      ( 7, 'Gabriela Muestra',  'whatsapp',   'conversando', null,           true,   3, 4),
      ( 8, 'Hugo Ficticio',     'whatsapp',   'conversando', null,           true,   0, 2),
      ( 9, 'Irene Prueba',      'whatsapp',   'agendo',      null,           true,   4, 5),
      (10, 'Jorge Demo',        'llamada',    'agendo',      null,           true,   6, 0),
      (11, 'Karla Inventada',   'whatsapp',   'agendo',      null,           true,   2, 4),
      (12, 'Luis Ejemplo',      'presencial', 'agendo',      null,           false, 10, 0),
      (13, 'Mónica Simulada',   'whatsapp',   'asistio',     null,           true,  12, 3),
      (14, 'Nicolás Muestra',   'whatsapp',   'seguimiento', null,           true,  40, 6),
      (15, 'Olga Prueba',       'referido',   'seguimiento', null,           false, 200, 0),
      (16, 'Pablo Ficticio',    'llamada',    'seguimiento', null,           true,  30, 0),
      (17, 'Rosa Demo',         'whatsapp',   'perdido',     'no_respondio', true,   5, 1),
      (18, 'Sergio Ejemplo',    'whatsapp',   'perdido',     'indeciso',     true,   8, 3),
      (19, 'Teresa Inventada',  'llamada',    'perdido',     'no_asistio',   true,  15, 0),
      (20, 'Úrsula Muestra',    'presencial', 'nuevo',       null,           false,  0, 0)
    ) as t(n, nombre, origen, etapa, motivo, con_whatsapp, dias, turnos)
    order by n
  loop
    v_conv := null;
    if v_p.con_whatsapp then
      insert into public.conversaciones (telefono, nombre_whatsapp, turnos_entrantes, ultimo_entrante_en, created_at)
      values (
        '5939000000' || lpad(v_p.n::text, 2, '0'),
        case when v_p.origen = 'whatsapp' then split_part(v_p.nombre, ' ', 1) end,
        v_p.turnos,
        -- Nuevo/Conversando: escribió hace poco (menos de 24 h) para que la tarea de 24 h no los mueva.
        case when v_p.turnos = 0 then null
             when v_p.etapa in ('nuevo', 'conversando') then v_ahora - make_interval(hours => v_p.n)
             else v_ahora - make_interval(days => greatest(v_p.dias - 1, 1)) end,
        v_ahora - make_interval(days => v_p.dias)
      )
      on conflict (telefono) do nothing
      returning id into v_conv;
    end if;

    insert into public.pacientes (
      conversacion_id, nombre, cedula, fecha_nacimiento, correo, origen, etapa, motivo_perdido,
      created_at, etapa_cambiada_en
    ) values (
      v_conv, v_p.nombre,
      '0000000' || lpad(v_p.n::text, 3, '0'),
      -- Cumpleaños: Ana hoy, Gabriela el domingo de esta semana, Olga en 5 días; el resto, fechas varias.
      case v_p.n
        when 1  then (v_hoy - interval '29 years')::date
        when 7  then (date_trunc('week', v_hoy)::date + 6 - interval '35 years')::date
        when 15 then (v_hoy + 5 - interval '62 years')::date
        else make_date(1960 + v_p.n * 2, 1 + (v_p.n * 5) % 12, 1 + (v_p.n * 7) % 27)
      end,
      lower(split_part(v_p.nombre, ' ', 1)) || v_p.n || '@ejemplo.test',
      v_p.origen::public.origen_paciente, v_p.etapa::public.etapa, v_p.motivo::public.motivo_perdido,
      v_ahora - make_interval(days => v_p.dias),
      v_ahora - make_interval(days => least(v_p.dias, 1))
    )
    returning id into v_pac;
    v_ids := v_ids || v_pac;

    -- Conversación: mensajes alternados paciente / Eli (solo dirección y hora; el CRM no guarda
    -- el contenido). Hasta 12 por conversación.
    if v_conv is not null and v_p.turnos > 0 then
      insert into public.mensajes (conversacion_id, id_externo, direccion, enviado_en)
      select v_conv,
             case when i % 2 = 1 then 'wamid.seed.' || v_p.n || '.' || i else 'out:seed-' || v_p.n || '-' || i end,
             case when i % 2 = 1 then 'entrante' else 'saliente' end,
             -- Cada 3 min; el último entrante coincide con ultimo_entrante_en.
             (select ultimo_entrante_en from public.conversaciones where id = v_conv)
               - make_interval(mins => (2 * v_p.turnos - 1 - i) * 3)
        from generate_series(1, least(2 * v_p.turnos, 12)) i;
    end if;
  end loop;

  -- Dependiente: hijo de Irene (comparte su conversación).
  insert into public.pacientes (conversacion_id, responsable_id, nombre, fecha_nacimiento, origen, created_at)
  select conversacion_id, id, 'Tomás Prueba', (v_hoy - 40 - interval '7 years')::date, 'presencial', v_ahora - interval '3 days'
    from public.pacientes where id = v_ids[9];

  -- Consentimiento y datos clínicos (inventados) para dos pacientes.
  update public.pacientes set consentimiento_firmado_en = v_ahora - interval '40 days' where id in (v_ids[13], v_ids[14]);
  insert into public.datos_clinicos (paciente_id, alergias, enfermedades, embarazo, miedo) values
    (v_ids[13], 'Ninguna conocida', 'Ninguna', false, null),
    (v_ids[14], 'Penicilina (dato de prueba)', 'Hipertensión controlada (dato de prueba)', false, 'Agujas');

  -- Retornos: Nicolás hoy (siempre cae en esta semana), Olga vencido, Pablo en 5 meses.
  update public.pacientes set volver_el = v_hoy where id = v_ids[14];
  update public.pacientes set volver_el = v_hoy - 10 where id = v_ids[15];
  update public.pacientes set volver_el = v_hoy + 150 where id = v_ids[16];

  -- Citas (hora local de Guayaquil). Las de Eli ya están en Calendar (sync ok); las del panel, pendientes.
  insert into public.citas (paciente_id, gcal_event_id, inicia_en, termina_en, servicio, estado, origen, sync)
  select x.paciente_id, x.gcal, (x.dia + x.hora)::timestamp at time zone 'America/Guayaquil',
         (x.dia + x.hora + x.dur)::timestamp at time zone 'America/Guayaquil',
         x.servicio, x.estado::public.estado_cita, x.origen::public.origen_cita, x.sync
    from (values
      -- Hoy
      (v_ids[9],  'seed-gcal-01', v_hoy,      time '09:00', interval '1 hour',   'Limpieza',    'agendada',   'eli',        'ok'),
      (v_ids[10], null,           v_hoy,      time '11:00', interval '1 hour',   'Control',     'agendada',   'panel',      'pendiente'),
      (null,      'seed-gcal-02', v_hoy,      time '13:00', interval '30 min',   null,          'agendada',   'calendario', 'ok'),
      (v_ids[12], null,           v_hoy,      time '15:00', interval '1 hour',   'Ortodoncia',  'agendada',   'panel',      'pendiente'),
      (v_ids[18], 'seed-gcal-03', v_hoy,      time '16:00', interval '1 hour',   'Valoración',  'cancelada',  'eli',        'ok'),
      -- Semana
      (v_ids[11], 'seed-gcal-04', v_hoy + 1,  time '10:00', interval '1 hour',   'Blanqueamiento', 'agendada', 'eli',       'ok'),
      (v_ids[9],  'seed-gcal-05', v_hoy + 2,  time '09:30', interval '1 hour',   'Control',     'agendada',   'eli',        'ok'),
      (v_ids[13], 'seed-gcal-06', v_hoy - 1,  time '10:00', interval '1 hour',   'Limpieza',    'asistio',    'eli',        'ok'),
      (v_ids[19], null,           v_hoy - 2,  time '12:00', interval '1 hour',   'Extracción',  'no_asistio', 'panel',      'ok'),
      -- Historial
      (v_ids[14], 'seed-gcal-07', v_hoy - 40, time '10:00', interval '1 hour',   'Limpieza',    'asistio',    'eli',        'ok'),
      (v_ids[15], null,           v_hoy - 190, time '11:00', interval '1 hour',  'Resina',      'asistio',    'panel',      'ok'),
      (v_ids[16], null,           v_hoy - 30, time '09:00', interval '1 hour',   'Control',     'asistio',    'panel',      'ok')
    ) as x(paciente_id, gcal, dia, hora, dur, servicio, estado, origen, sync);
end $$;
