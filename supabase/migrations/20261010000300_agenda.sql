-- TK-3 · mensajes, citas, cambios_etapa, horario, errores_integracion y sync_calendario,
-- con RLS y Realtime. Modelo: docs/crm/plan.md §4.

-- ───────────────────────── mensajes ─────────────────────────
-- Conversación con Eli. Solo la escribe registrar_evento_eli (clave de servicio).
create table if not exists public.mensajes (
  id              bigint generated always as identity primary key,
  conversacion_id bigint not null references public.conversaciones (id) on delete cascade,
  id_externo      text not null unique,
  direccion       text not null check (direccion in ('entrante', 'saliente')),
  texto           text not null,
  enviado_en      timestamptz not null,
  created_at      timestamptz not null default now()
);
comment on column public.mensajes.id_externo is
  'Idempotencia: message_id de WhatsApp (entrante) u out:<execution_id> de n8n (saliente).';
-- También cubre la FK conversacion_id.
create index if not exists mensajes_conversacion_enviado_idx
  on public.mensajes (conversacion_id, enviado_en);

-- ───────────────────────── citas ─────────────────────────
create table if not exists public.citas (
  id            bigint generated always as identity primary key,
  paciente_id   bigint references public.pacientes (id) on delete set null,
  gcal_event_id text unique,
  gcal_etag     text,
  inicia_en     timestamptz not null,
  termina_en    timestamptz not null,
  servicio      text,
  estado        public.estado_cita not null default 'agendada',
  origen        public.origen_cita not null,
  sync          text not null default 'pendiente' check (sync in ('ok', 'pendiente', 'error')),
  sync_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint citas_termina_despues check (termina_en > inicia_en)
);
comment on column public.citas.paciente_id is 'Null = cita sin vincular (creada en Google Calendar).';
comment on column public.citas.sync is 'Estado frente a Google Calendar: ok, pendiente (por enviar) o error.';

create index if not exists citas_inicia_en_idx on public.citas (inicia_en);
create index if not exists citas_paciente_id_idx on public.citas (paciente_id);
create index if not exists citas_sync_pendiente_idx on public.citas (id) where sync <> 'ok';

-- ───────────────────────── cambios_etapa ─────────────────────────
-- Historial del embudo. Lo escribe un trigger de pacientes (TK-5); nadie lo edita a mano.
create table if not exists public.cambios_etapa (
  id             bigint generated always as identity primary key,
  paciente_id    bigint not null references public.pacientes (id) on delete cascade,
  de             public.etapa,
  a              public.etapa not null,
  motivo_perdido public.motivo_perdido,
  actor          public.actor not null,
  personal_id    uuid,
  en             timestamptz not null default now()
);
comment on column public.cambios_etapa.de is 'Null en la creación del paciente.';
comment on column public.cambios_etapa.personal_id is
  'auth.uid() cuando actor = personal. Sin FK: el historial se conserva aunque se borre la cuenta.';
create index if not exists cambios_etapa_paciente_en_idx on public.cambios_etapa (paciente_id, en);

-- ───────────────────────── horario ─────────────────────────
-- Horario del consultorio (ISO: 1 = lunes … 7 = domingo). Sin fila = cerrado.
-- OJO: también vive en el nodo «Validar pedido» de n8n; si cambia, cambiar los dos.
create table if not exists public.horario (
  dia_semana smallint primary key check (dia_semana between 1 and 7),
  abre       time not null,
  cierra     time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horario_cierra_despues check (cierra > abre)
);
insert into public.horario (dia_semana, abre, cierra) values
  (1, '09:00', '18:00'), (2, '09:00', '18:00'), (3, '09:00', '18:00'),
  (4, '09:00', '18:00'), (5, '09:00', '18:00'), (6, '09:00', '15:00')
on conflict (dia_semana) do nothing;

-- ───────────────────────── errores_integracion ─────────────────────────
create table if not exists public.errores_integracion (
  id      bigint generated always as identity primary key,
  origen  text not null check (origen in ('eli', 'calendario')),
  detalle jsonb not null,
  en      timestamptz not null default now()
);
create index if not exists errores_integracion_en_idx on public.errores_integracion (en);

-- ───────────────────────── sync_calendario ─────────────────────────
-- Estado de la sincronización incremental. Solo la usa la función «calendario».
create table if not exists public.sync_calendario (
  calendario_id  text primary key,
  sync_token     text,
  ultima_sync_en timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ───────────────────────── updated_at ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['citas', 'horario', 'sync_calendario'] loop
    execute format('drop trigger if exists poner_updated_at on public.%I', t);
    execute format(
      'create trigger poner_updated_at before update on public.%I
         for each row execute function private.poner_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.mensajes            enable row level security;
alter table public.citas               enable row level security;
alter table public.cambios_etapa       enable row level security;
alter table public.horario             enable row level security;
alter table public.errores_integracion enable row level security;
alter table public.sync_calendario     enable row level security;

do $$
declare t text;
begin
  -- Lectura para el personal en las 6 tablas.
  foreach t in array array['mensajes', 'citas', 'cambios_etapa', 'horario',
                           'errores_integracion', 'sync_calendario'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated
                      using ((select private.es_personal()))', t || '_select', t);
  end loop;
  -- Escritura del personal solo en citas y horario.
  foreach t in array array['citas', 'horario'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated
                      with check ((select private.es_personal()))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated
                      using ((select private.es_personal()))
                      with check ((select private.es_personal()))', t || '_update', t);
  end loop;
end $$;

-- Privilegios: anon solo puede intentar leer (RLS: 0 filas); nadie de la API borra ni trunca.
revoke insert, update, delete, truncate, references, trigger
  on public.mensajes, public.citas, public.cambios_etapa, public.horario,
     public.errores_integracion, public.sync_calendario from anon;
revoke delete, truncate, references, trigger
  on public.mensajes, public.citas, public.cambios_etapa, public.horario,
     public.errores_integracion, public.sync_calendario from authenticated;
-- Tablas de solo lectura para el panel.
revoke insert, update
  on public.mensajes, public.cambios_etapa, public.errores_integracion, public.sync_calendario
  from authenticated;

-- ───────────────────────── Realtime ─────────────────────────
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['pacientes', 'citas', 'mensajes'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
