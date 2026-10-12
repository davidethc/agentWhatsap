-- TK-1 · Extensiones y esquema privado.
begin;
select plan(5);

select has_extension('pg_cron', 'pg_cron instalada');
select has_extension('pg_net', 'pg_net instalada');
select has_extension('pg_trgm', 'pg_trgm instalada');
select has_extension('pgtap', 'pgtap instalada');
select has_schema('private', 'existe el esquema private');

select * from finish();
rollback;
