-- TK-2 · Tipos, personal, conversaciones, pacientes y datos_clinicos, con RLS.
-- Modelo: docs/crm/plan.md §4. Glosario: paciente, conversación, titular, responsable, etapa.

-- ───────────────────────── Tipos (enum) ─────────────────────────
-- Idempotentes: se crean solo si no existen.
do $$
begin
  if to_regtype('public.etapa') is null then
    create type public.etapa as enum
      ('nuevo', 'conversando', 'agendo', 'asistio', 'seguimiento', 'perdido');
  end if;
  if to_regtype('public.motivo_perdido') is null then
    create type public.motivo_perdido as enum ('no_respondio', 'indeciso', 'no_asistio');
  end if;
  if to_regtype('public.estado_cita') is null then
    create type public.estado_cita as enum ('agendada', 'asistio', 'no_asistio', 'cancelada');
  end if;
  if to_regtype('public.origen_paciente') is null then
    create type public.origen_paciente as enum ('whatsapp', 'llamada', 'presencial', 'referido');
  end if;
  if to_regtype('public.origen_cita') is null then
    create type public.origen_cita as enum ('eli', 'panel', 'calendario');
  end if;
  if to_regtype('public.rol_personal') is null then
    create type public.rol_personal as enum ('doctora', 'admin');
  end if;
  if to_regtype('public.actor') is null then
    create type public.actor as enum ('personal', 'eli', 'sistema', 'calendario');
  end if;
end $$;

-- ───────────────────────── Ayudante: updated_at ─────────────────────────
create or replace function private.poner_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── personal ─────────────────────────
-- Quien puede entrar al panel (doctora o admin). La llena el admin; no hay registro público.
create table if not exists public.personal (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null check (length(btrim(nombre)) > 0),
  rol        public.rol_personal not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.personal is 'Personal del consultorio con acceso al panel. Solo la llena el admin.';

-- ¿La sesión actual es de alguien del personal? Base de todas las políticas RLS.
-- security definer: lee personal sin pasar por su propia RLS (evita recursión).
create or replace function private.es_personal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personal where user_id = (select auth.uid())
  );
$$;
revoke all on function private.es_personal() from public, anon;
grant execute on function private.es_personal() to authenticated, service_role;

-- ───────────────────────── conversaciones ─────────────────────────
-- El chat de un número de WhatsApp con Eli. Varios pacientes pueden compartirla.
create table if not exists public.conversaciones (
  id                 bigint generated always as identity primary key,
  telefono           text not null unique check (telefono ~ '^593[0-9]{8,9}$'),
  nombre_whatsapp    text,
  turnos_entrantes   integer not null default 0 check (turnos_entrantes >= 0),
  ultimo_entrante_en timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on column public.conversaciones.telefono is 'Normalizado: 593 + 8 o 9 dígitos, sin +.';
comment on column public.conversaciones.turnos_entrantes is 'Mensajes entrantes contados (2.º → Conversando).';

-- ───────────────────────── pacientes ─────────────────────────
create table if not exists public.pacientes (
  id                        bigint generated always as identity primary key,
  conversacion_id           bigint references public.conversaciones (id) on delete restrict,
  responsable_id            bigint references public.pacientes (id) on delete restrict,
  nombre                    text not null check (length(btrim(nombre)) > 0),
  cedula                    text,
  fecha_nacimiento          date,
  correo                    text,
  origen                    public.origen_paciente not null,
  etapa                     public.etapa not null default 'nuevo',
  motivo_perdido            public.motivo_perdido,
  volver_el                 date,
  consentimiento_firmado_en timestamptz,
  etapa_cambiada_en         timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- El motivo existe si y solo si la etapa es Perdido.
  constraint pacientes_motivo_solo_perdido check (
    (etapa = 'perdido') = (motivo_perdido is not null)
  ),
  constraint pacientes_no_es_su_responsable check (responsable_id <> id)
);
comment on column public.pacientes.conversacion_id is 'Null si no tiene teléfono. Los dependientes comparten la de su responsable.';
comment on column public.pacientes.responsable_id is 'Paciente a cargo (p. ej. la mamá). Null = titular o sin teléfono.';
comment on column public.pacientes.volver_el is 'Retorno: cuándo la doctora quiere volver a verlo.';

create index if not exists pacientes_conversacion_id_idx on public.pacientes (conversacion_id);
create index if not exists pacientes_responsable_id_idx on public.pacientes (responsable_id);
create index if not exists pacientes_etapa_idx on public.pacientes (etapa);
create index if not exists pacientes_volver_el_idx on public.pacientes (volver_el) where volver_el is not null;
create index if not exists pacientes_nombre_trgm_idx on public.pacientes
  using gin (nombre extensions.gin_trgm_ops);
-- Un solo titular por conversación.
create unique index if not exists pacientes_un_titular_por_conversacion
  on public.pacientes (conversacion_id) where responsable_id is null;

-- ───────────────────────── datos_clinicos ─────────────────────────
-- 1:1 con el paciente. Solo se guarda con consentimiento firmado (trigger en TK-4).
create table if not exists public.datos_clinicos (
  paciente_id  bigint primary key references public.pacientes (id) on delete cascade,
  alergias     text,
  enfermedades text,
  embarazo     boolean,
  miedo        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── updated_at ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['personal', 'conversaciones', 'pacientes', 'datos_clinicos'] loop
    execute format('drop trigger if exists poner_updated_at on public.%I', t);
    execute format(
      'create trigger poner_updated_at before update on public.%I
         for each row execute function private.poner_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── RLS ─────────────────────────
-- Solo el personal autenticado. anon no tiene políticas (ve 0 filas).
alter table public.personal       enable row level security;
alter table public.conversaciones enable row level security;
alter table public.pacientes      enable row level security;
alter table public.datos_clinicos enable row level security;

-- personal: solo lectura desde el panel (el admin la llena con la clave de servicio o SQL).
drop policy if exists personal_select on public.personal;
create policy personal_select on public.personal
  for select to authenticated using ((select private.es_personal()));

do $$
declare t text;
begin
  foreach t in array array['conversaciones', 'pacientes', 'datos_clinicos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated
                      using ((select private.es_personal()))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated
                      with check ((select private.es_personal()))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated
                      using ((select private.es_personal()))
                      with check ((select private.es_personal()))', t || '_update', t);
  end loop;
end $$;

-- Privilegios: anon solo puede intentar leer (y RLS le da 0 filas). Nadie de la API trunca.
revoke insert, update, delete, truncate, references, trigger
  on public.personal, public.conversaciones, public.pacientes, public.datos_clinicos from anon;
revoke truncate, references, trigger
  on public.personal, public.conversaciones, public.pacientes, public.datos_clinicos from authenticated;
-- El personal no borra (no hay política de delete); se revoca para que el error sea claro.
revoke delete
  on public.personal, public.conversaciones, public.pacientes, public.datos_clinicos from authenticated;
revoke insert, update on public.personal from authenticated;
