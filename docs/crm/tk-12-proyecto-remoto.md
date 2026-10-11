# TK-12 · Crear el proyecto remoto `eli-crm` (paso a paso para aprobar)

> ✋ **Nada de esto se ha hecho todavía.** Es el plan para que lo apruebes. Nada pide tarjeta. Lo
> que diga «tú» lo haces tú en el navegador; el resto lo corre `crm-datos` y te muestra cada comando
> antes de lanzarlo.

## 0. Lo que tienes que decidir

| Decisión | Propuesta | Por qué |
|---|---|---|
| Plan | **Free** (0 $, sin tarjeta) | 500 MB de base, hasta 2 proyectos gratis activos (verificarlo al crear: las condiciones pueden cambiar). Sobra para un consultorio |
| Región | **East US (North Virginia)** `us-east-1` | Desde Ecuador el tráfico suele salir por Miami, así que suele ser la más rápida. Alternativa: **South America (São Paulo)** `sa-east-1`. En las dos los datos salen de Ecuador (LOPDP: transferencia internacional; ver nota abajo). **La región no se puede cambiar después** |
| Organización | La tuya personal en Supabase | Si luego EliDental quiere ser dueña, se transfiere el proyecto |
| Contraseña de la base | Larga y al azar, generada por Supabase | Se guarda en tu gestor de contraseñas y en `.env` (`CRM_DB_URL`), nunca en git |

Límites del plan gratis que ya conocemos (plan.md §9): **se pausa tras 7 días sin uso** (reactivarlo es
gratis) y **no tiene copias descargables** → por eso existe `scripts/backup-crm.sh` (TK-13).

> Nota LOPDP: el Plan no define la región ni si hace falta informar a los pacientes de la
> transferencia internacional. No lo invento: queda para que lo decidas tú (o la doctora).

## 1. Crear el proyecto (tú, en el navegador)

1. Entra a <https://supabase.com/dashboard> con tu cuenta (GitHub o correo). No pide tarjeta.
2. **New project** → organización tuya (plan Free) → nombre `eli-crm` → región elegida →
   **Generate a password** y cópiala a tu gestor de contraseñas.
3. Espera a que diga «Project is ready» (1–2 min) y pásame el **Project ref** (Settings → General;
   no es secreto).

(Alternativa por terminal, si prefieres: `supabase login` y
`supabase projects create eli-crm --org-id <org> --region us-east-1 --db-password <contraseña>`.)

## 2. Aplicar las migraciones (crm-datos, desde `feat/crm-datos`)

```bash
supabase login                              # una vez; abre el navegador
supabase link --project-ref <ref>           # pide la contraseña de la base
supabase db push --dry-run                  # muestra las 9 migraciones que va a aplicar
supabase db push                            # las aplica (NO aplica seed.sql: los datos de prueba no van a la nube)
```

Comprobación: `supabase migration list` (local = remoto) y los **advisors de seguridad** del proyecto
sin errores (`get_advisors` del MCP de Supabase o Dashboard → Advisors).

## 3. Login sin registro público (tú o crm-datos)

- Dashboard → **Authentication → Sign In / Providers** → apagar **Allow new users to sign up**.
  Dejar **Email** encendido (si se apaga, nadie puede entrar).
- **URL Configuration → Site URL**: por ahora `http://localhost:3000`; en TK-35 se cambia a la de Netlify.
- No uso `supabase config push` para esto porque subiría también la configuración local (URLs de localhost).

## 4. Cuentas de la doctora y del admin (tú)

1. Dashboard → **Authentication → Users → Add user → Create new user**, con correo real y contraseña,
   marcando **Auto Confirm User**. Una para la doctora y otra para el admin (tú).
2. En **SQL Editor** (crm-datos te pasa la consulta exacta con los correos):

```sql
insert into public.personal (user_id, nombre, rol)
select id, 'Dra. …', 'doctora' from auth.users where email = '<correo de la doctora>';
insert into public.personal (user_id, nombre, rol)
select id, '…', 'admin' from auth.users where email = '<tu correo>';
```

Sin fila en `personal`, una cuenta puede iniciar sesión pero ve 0 datos (RLS).

## 5. Función `eli-evento` y su secreto (crm-datos)

```bash
supabase functions deploy eli-evento                 # verify_jwt = false sale de config.toml
supabase secrets set ELI_EVENTO_SECRETO=<secreto largo al azar>
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya existen dentro de las funciones; no se configuran.

## 6. Dónde va cada clave

| Clave | Dónde se saca | Dónde va | ¿Secreta? |
|---|---|---|---|
| URL del proyecto `https://<ref>.supabase.co` | Settings → API | Panel: `NEXT_PUBLIC_SUPABASE_URL` (`crm/.env.local` y Netlify) | No |
| Clave pública (anon / publishable) | Settings → API Keys | Panel: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (la protege RLS) |
| `ELI_EVENTO_SECRETO` | La generamos | `supabase secrets set` + credencial de n8n (cabecera `x-eli-secreto`) | **Sí** |
| URL de la función `https://<ref>.supabase.co/functions/v1/eli-evento` | — | Sub-workflow «Eli → CRM» de n8n (TK-18) | No |
| `CRM_DB_URL` (Session pooler + contraseña) | Connect → Session pooler | `.env` de la raíz, solo para `scripts/backup-crm.sh` | **Sí** |
| Contraseña de la base | Paso 1 | Tu gestor de contraseñas (y dentro de `CRM_DB_URL`) | **Sí** |
| `service_role` / secret key | Settings → API Keys | **En ningún lado nuestro.** Nunca en el navegador, en git ni en n8n | **Sí** |

Los secretos solo en `.env` / secretos de Supabase / credenciales de n8n; nunca en git, Notion ni chats.

## 7. Cierre

- `scripts/backup-crm.sh` una vez contra la nube (cierra TK-13).
- Regenerar tipos: `supabase gen types typescript --project-id <ref> --schema public` y comparar con
  `crm/lib/data/database.types.ts` (deben ser iguales).
- Criterio de hecho de TK-12: proyecto gratis sin tarjeta · `db push` ok · registro público apagado ·
  doctora y admin en `personal` · advisors de seguridad sin errores · `ELI_EVENTO_SECRETO` puesto.
