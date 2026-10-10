-- TK-1 · Extensiones y esquema privado del Eli Panel.
-- Idempotente: se puede aplicar varias veces.

-- pg_cron: tareas programadas (Perdido a las 24 h, sincronización con Calendar).
-- Supabase recomienda instalarla en pg_catalog.
create extension if not exists pg_cron with schema pg_catalog;

-- pg_net: llamadas HTTP desde la base (disparar la función «calendario»).
create extension if not exists pg_net with schema extensions;

-- pg_trgm: búsqueda por nombre aproximado en el kanban.
create extension if not exists pg_trgm with schema extensions;

-- pgtap: pruebas de la base (supabase test db).
create extension if not exists pgtap with schema extensions;

-- Esquema privado: funciones security definer y ayudantes de RLS.
-- No se expone por la API (no está en [api].schemas).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

comment on schema private is
  'Funciones internas del Eli Panel (RLS, auditoría, reglas del embudo). No expuesto por la API.';
