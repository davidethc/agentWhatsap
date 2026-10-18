# Recuperar todo después de formatear el computador

Qué se guarda en GitHub, qué **no**, y cómo volver a dejar Eli funcionando. Última revisión: 2026-10-18.

## 1. Dónde vive cada cosa

| Qué | Dónde | ¿Se pierde al formatear? |
|---|---|---|
| Código, docs, scripts, `workflows/` (JSON de n8n) | Git, rama `main` | No, si hiciste `git push` |
| El CRM «Eli Panel» (código, docs, migraciones, agentes) | Git, rama `version-crm` | No, si hiciste `git push` |
| Contraseñas y claves (`.env`) | Solo en tu Mac | **Sí** |
| Base de n8n, workflows cargados y credenciales cifradas | Volúmenes de Docker y `backups/` | **Sí** |
| `N8N_ENCRYPTION_KEY` | Dentro de `.env` y de `backups/<fecha>/env` | **Sí**, y sin ella no se descifran las credenciales |
| Cuenta de ngrok, Kapso, Google, Gemini | En sus páginas web | No (hay que volver a iniciar sesión) |
| Base del CRM | Supabase (nube) | No |
| Despliegue del CRM | Vercel/Netlify (nube) | No |

## 2. Antes de formatear (lista de comprobación)

1. `git status` limpio y `git push origin main version-crm` (ver el comando en el CHANGELOG).
2. Respaldo fresco: `scripts/backup.sh`. Crea `backups/<fecha>/`.
3. **Copia `backups/` y `.env` a un disco externo o a tu nube personal.** Contienen secretos: no los subas a
   Git, a Notion ni a un chat.
4. Si usas el CRM: copia también `crm-v2-diseno/.env` (si existe) y anota el proyecto de Supabase.
5. Anota en un lugar seguro los accesos de Kapso, ngrok, Google Cloud, Gemini y Supabase.

## 3. Volver a levantar Eli

1. Instala Docker Desktop, git, jq, openssl y ngrok ([GUIA.md](../GUIA.md)).
2. `git clone https://github.com/davidethc/agentWhatsap.git && cd agentWhatsap`
3. Copia tu `.env` guardado a la carpeta del proyecto. **Debe ser el mismo**, sobre todo
   `N8N_ENCRYPTION_KEY`. Si no lo tienes, `scripts/init-env.sh` crea uno nuevo, pero entonces hay que volver
   a crear las credenciales a mano.
4. `docker compose up -d` y espera a que estén sanos.
5. Restaura la base desde el respaldo (ver [operacion.md, Restaurar](operacion.md#restaurar)):
   ```bash
   docker compose stop n8n n8n-worker
   docker compose exec -T postgres pg_restore -U n8n -d n8n --clean --if-exists < backups/<fecha>/postgres.dump
   docker compose start n8n n8n-worker
   ```
6. `scripts/check.sh` debe salir todo OK. Si no hay respaldo, importa `workflows/eli-version4.json` y
   `workflows/eli-seguimiento.json` en n8n y crea las credenciales ([GUIA, pasos 8 y 9](../GUIA.md)).
7. Vuelve a abrir ngrok y actualiza la URL del webhook en Kapso ([operacion.md](operacion.md)).

## 4. El CRM queda guardado para continuarlo

El CRM no está en `main`; vive entero en la rama **`version-crm`**:

```bash
git switch version-crm
```

Ahí está el código (`crm/`, `crm-v2-diseno/`), las migraciones (`supabase/`), la documentación
(`docs/crm/`, empieza por `docs/crm/README.md` y `docs/crm/CONTINUAR.md`) y los agentes de Claude
(`.claude/agents/`). Para seguir: instala dependencias, crea `.env` desde el ejemplo y apunta a tu proyecto
de Supabase.

## 5. Lo que se pierde seguro

- Sesiones de Codex y de Claude abiertas (el historial de chat). Lo decidido está en `docs/` y en el
  CHANGELOG.
- `node_modules/` y `.next/`: se regeneran con `npm install` / `pnpm install`.
