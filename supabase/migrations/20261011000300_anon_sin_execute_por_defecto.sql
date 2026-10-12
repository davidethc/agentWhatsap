-- Revisión de seguridad (apoyo a TK-39 de QA) · anon no ejecuta funciones FUTURAS.
--
-- Hallazgo: con los privilegios por defecto del rol postgres (el que aplica las migraciones), toda
-- función nueva de public recibe EXECUTE para anon (entrada de Supabase en pg_default_acl) y toda
-- función nueva de cualquier otro esquema, como private, lo recibe para PUBLIC (valor de Postgres).
-- Hoy ninguna función es ejecutable por anon (cada migración hace revoke explícito), pero una
-- función nueva que olvide el revoke quedaría abierta por la API (/rest/v1/rpc) sin sesión.
-- La 0200 ya cerró tablas y secuencias; esto cierra funciones.
--
-- Un «in schema» no puede quitar un privilegio global, así que el de PUBLIC se revoca global
-- (solo afecta a objetos que cree postgres). authenticated y service_role conservan su EXECUTE por
-- defecto en public; cada migración sigue dando EXECUTE explícito a quien corresponda.
--
-- Idempotente: revocar algo que no existe no falla. No cambia funciones que ya existen.
-- Prueba: supabase/tests/10_seguridad.test.sql.

-- Global (todos los esquemas): PUBLIC y anon sin EXECUTE en funciones nuevas de postgres.
alter default privileges for role postgres
  revoke execute on functions from public, anon;

-- public: quitar el EXECUTE para anon que agrega Supabase en este esquema.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
