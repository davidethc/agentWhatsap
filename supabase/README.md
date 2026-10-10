# supabase/ · Base de datos del Eli Panel

Base del CRM (proyecto `eli-crm`). Modelo y reglas: [docs/crm/plan.md](../docs/crm/plan.md) §4–5.

## Levantar en local

```bash
supabase start          # primera vez baja imágenes (lento)
supabase db reset       # aplica migrations/ + seed.sql desde cero
supabase test db        # pruebas pgTAP de tests/
```

- Puertos **5532x** (API 55321, Postgres 55322, Studio 55323, correo 55324) para no chocar con otros
  proyectos de Supabase ni con el Postgres de n8n.
- `analytics` está apagado: con 4 GB en Docker no arrancaba junto a n8n.
- Sin registro público (`enable_signup = false`): las cuentas las crea el admin y se agregan a la
  tabla `personal`.
- Solo local. El proyecto remoto `eli-crm` se crea en TK-12, con aprobación del usuario.

## Carpetas

| Ruta | Qué hay |
|---|---|
| `migrations/` | SQL versionado, pequeño e idempotente, en orden de fecha |
| `tests/` | Pruebas pgTAP (RLS, auditoría, reglas del embudo) |
| `seed.sql` | **Solo datos inventados** |

## Reglas

Nombres en español y minúsculas · `bigint identity` · `timestamptz` · FK con índice · RLS en todas
las tablas con `(select private.es_personal())` · funciones internas en `private` con
`search_path = ''` · zona `America/Guayaquil`.
