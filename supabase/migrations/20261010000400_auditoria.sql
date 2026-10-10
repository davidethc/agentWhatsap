-- TK-4 · Auditoría (quién cambió qué y cuándo) y consentimiento para datos clínicos.
-- Datos de salud: LOPDP Ecuador. Plan §4 «Auditoría».

-- ───────────────────────── Actor actual ─────────────────────────
-- Personal si hay sesión de usuario (auth.uid()); si no, lo que la integración puso en
-- set_config('app.actor', 'eli' | 'calendario' | 'sistema', true); por defecto 'sistema'.
-- Una sesión de usuario no puede hacerse pasar por Eli: con auth.uid() siempre es 'personal'.
create or replace function private.actor_actual()
returns public.actor
language sql
stable
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null then 'personal'::public.actor
    else coalesce(nullif(current_setting('app.actor', true), '')::public.actor, 'sistema'::public.actor)
  end;
$$;
revoke all on function private.actor_actual() from public, anon;
grant execute on function private.actor_actual() to authenticated, service_role;

-- ───────────────────────── auditoria ─────────────────────────
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  fila_id     bigint not null,
  accion      text not null check (accion in ('insert', 'update', 'delete')),
  antes       jsonb,
  despues     jsonb,
  actor       public.actor not null,
  personal_id uuid,
  en          timestamptz not null default now()
);
comment on table public.auditoria is
  'Registro inmutable de cambios en pacientes, datos_clinicos y citas. Solo inserta private.auditar().';
comment on column public.auditoria.personal_id is 'auth.uid() del personal. Sin FK: el registro no se pierde.';
create index if not exists auditoria_tabla_fila_en_idx on public.auditoria (tabla, fila_id, en);

alter table public.auditoria enable row level security;
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select to authenticated using ((select private.es_personal()));

-- Solo lectura para todos los roles de la API (incluida la clave de servicio).
revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate, references, trigger on public.auditoria
  from authenticated, service_role;

-- Ni el dueño de la tabla puede editarla o borrarla.
create or replace function private.auditoria_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La auditoría no se puede editar ni borrar';
end;
$$;

drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable
  before update or delete on public.auditoria
  for each row execute function private.auditoria_inmutable();
drop trigger if exists auditoria_sin_truncate on public.auditoria;
create trigger auditoria_sin_truncate
  before truncate on public.auditoria
  for each statement execute function private.auditoria_inmutable();

-- ───────────────────────── Trigger de auditoría ─────────────────────────
-- security definer: escribe en auditoria aunque quien edita no tenga permiso de insertar ahí.
create or replace function private.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes   jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila    jsonb := coalesce(v_despues, v_antes);
  v_actor   public.actor := private.actor_actual();
begin
  -- Un update que no cambia nada (salvo updated_at) no se registra.
  if tg_op = 'UPDATE' and (v_antes - 'updated_at') = (v_despues - 'updated_at') then
    return null;
  end if;

  insert into public.auditoria (tabla, fila_id, accion, antes, despues, actor, personal_id)
  values (
    tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'paciente_id')::bigint,
    lower(tg_op),
    v_antes,
    v_despues,
    v_actor,
    case when v_actor = 'personal' then (select auth.uid()) end
  );
  return null;
end;
$$;
revoke all on function private.auditar() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pacientes', 'datos_clinicos', 'citas'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function private.auditar()', t);
  end loop;
end $$;

-- ───────────────────────── Consentimiento ─────────────────────────
-- Sin «Consentimiento firmado» (con su fecha) no se guardan datos clínicos (HU-6, HU-14).
create or replace function private.exigir_consentimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pacientes
    where id = new.paciente_id and consentimiento_firmado_en is not null
  ) then
    raise exception 'Falta el consentimiento firmado del paciente'
      using hint = 'Marque «Consentimiento firmado» en la ficha antes de llenar los datos clínicos.';
  end if;
  return new;
end;
$$;
revoke all on function private.exigir_consentimiento() from public, anon, authenticated;

drop trigger if exists exigir_consentimiento on public.datos_clinicos;
create trigger exigir_consentimiento
  before insert or update on public.datos_clinicos
  for each row execute function private.exigir_consentimiento();
