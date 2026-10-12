-- Revisión de seguridad y datos de salud (apoyo a TK-39 de QA).
-- Invariantes globales: si una migración futura los rompe, esta prueba falla.
begin;
select plan(13);

-- 1. RLS activado en todas las tablas de public y private
select is_empty($$
  select n.nspname || '.' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'todas las tablas de public y private tienen RLS');

-- 2. Las vistas saltan RLS salvo security_invoker: ninguna sin él
select is_empty($$
  select c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
     and not coalesce(c.reloptions @> array['security_invoker=true'], false)
$$, 'ninguna vista de public salta RLS');

-- 3. anon sin privilegios de tabla, columna ni secuencia en public
select is_empty($$
  select table_name || ':' || privilege_type from information_schema.role_table_grants
   where grantee in ('anon', 'PUBLIC') and table_schema in ('public', 'private')
$$, 'anon y PUBLIC sin privilegios de tabla');
select is_empty($$
  select table_name || '.' || column_name from information_schema.column_privileges
   where grantee in ('anon', 'PUBLIC') and table_schema in ('public', 'private')
$$, 'anon y PUBLIC sin privilegios de columna');
select is_empty($$
  select c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
     and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'select'))
$$, 'anon sin privilegios de secuencia');

-- 4. Ninguna función de public/private ejecutable por anon
select is_empty($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta funciones de public ni private');

-- 5. security definer siempre con search_path fijo
select is_empty($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
$$, 'toda función security definer fija search_path');

-- 6. El esquema private no es accesible para anon
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon sin usage en private');

-- 7. Objetos FUTUROS creados por postgres (las migraciones) no dan nada a anon
create table public.tmp_seguridad (id int);
create function public.tmp_seguridad_fn() returns int language sql as 'select 1';
select ok(not has_table_privilege('anon', 'public.tmp_seguridad', 'select'),
  'tabla nueva: anon sin select (default privileges)');
select ok(not has_function_privilege('anon', 'public.tmp_seguridad_fn()', 'execute'),
  'función nueva en public: anon sin execute (default privileges)');
select ok(has_function_privilege('authenticated', 'public.tmp_seguridad_fn()', 'execute'),
  'función nueva en public: authenticated conserva execute');
create function private.tmp_seguridad_fn() returns int language sql as 'select 1';
select ok(not has_function_privilege('anon', 'private.tmp_seguridad_fn()', 'execute'),
  'función nueva en private: anon sin execute (ni por PUBLIC)');

-- 8. Storage: ningún bucket público (datos de salud)
select is_empty($$select id from storage.buckets where public$$, 'ningún bucket de storage es público');

select * from finish();
rollback;
