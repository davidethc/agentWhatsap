# crm/ · Eli Panel

Panel de la doctora de EliDental (Next.js 16, TypeScript estricto, Tailwind 4 y shadcn/ui) sobre Supabase.
Resumen del día, tablero de pacientes por etapa, ficha, nuevo paciente y citas.

- Cómo se usa: [docs/crm/guia-doctora.md](../docs/crm/guia-doctora.md)
- Cómo levantarlo y operarlo: [docs/crm/operacion.md](../docs/crm/operacion.md)
- Diseño y decisiones: [docs/crm/plan.md](../docs/crm/plan.md)

## Arrancar

```bash
supabase start                  # base local (desde la raíz del repo)
cp .env.example .env.local      # URL y clave PÚBLICA de `supabase status`
pnpm install
pnpm dev                        # http://localhost:3000
```

Cuenta de prueba (solo local): `doctora@ejemplo.test` / `eli-panel-local`.

## Comandos

| Comando | Para qué |
|---|---|
| `pnpm lint` | Revisar el código |
| `pnpm typecheck` | Revisar los tipos |
| `pnpm test` | Pruebas (Vitest) |
| `pnpm build` / `pnpm start` | Versión de producción |

Sin `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` el panel falla a propósito al construirse.
`ELI_DATOS=falso` en `.env.local` usa datos inventados en memoria, sin Supabase.

## Reglas del código

- El panel **lee** las tablas y **escribe** llamando a las funciones de la base (ahí viven las reglas del
  embudo); solo los datos básicos, el consentimiento y los datos clínicos van directo, con permiso por columna.
- Solo la URL y la clave pública llegan al navegador. **Nunca** una `service_role` ni un secreto.
- Los colores están en un solo archivo: `styles/tokens.css`.
- No se muestra ni se guarda el contenido de los mensajes ([ADR 0012](../docs/adr/0012-crm-sin-contenido-de-mensajes.md)).
