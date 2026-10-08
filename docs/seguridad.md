# Seguridad y datos

Sofi maneja teléfonos, nombres y citas de pacientes. Estas reglas son obligatorias para cualquier
persona que trabaje en el proyecto.

## Secretos

| Secreto | Dónde vive | Nunca |
|---|---|---|
| `N8N_ENCRYPTION_KEY`, contraseñas de PostgreSQL y Redis, token de runners | `.env` (permisos 600), generado con `scripts/init-env.sh` | En Git, en chats ni en capturas |
| API keys de Kapso, Gemini y Google OAuth | Credenciales de n8n (cifradas en PostgreSQL) | En el código de los workflows ni en `.env.example` |
| Authtoken de ngrok | Configuración local de ngrok | En el repositorio |

- Guarda una copia de `N8N_ENCRYPTION_KEY` en un gestor de contraseñas: sin ella, los respaldos de
  credenciales no se pueden abrir.
- `.gitignore` excluye `.env`, `.env.*` (excepto `.env.example`), `backups/`, `local-files/` y `*.backup`.
- Si se filtra un secreto: rótalo en el proveedor (Kapso, Google, Gemini) y cambia la credencial en n8n.
  `N8N_ENCRYPTION_KEY` no se rota sin una migración planificada.

## Red

- Solo n8n publica un puerto, y solo en `127.0.0.1:5678`. PostgreSQL y Redis no son accesibles fuera
  de la red Docker.
- El acceso público es únicamente a través de ngrok (HTTPS).
- El editor de n8n queda expuesto por la URL de ngrok: usa una contraseña fuerte para la cuenta owner.

## Datos de pacientes

- **No subas datos reales al repositorio:** ni teléfonos, nombres, conversaciones, exportaciones de
  ejecuciones, el calendario real ni el `phone_number_id`. `scripts/export-workflow.sh` reemplaza el
  calendario y el `phone_number_id` por marcadores y avisa si encuentra correos o números largos.
- **Mensajes automáticos solo con logística:** día, hora y lugar. Nunca un diagnóstico ni un
  tratamiento.
- **El bot no da consejos médicos.** Las preguntas clínicas y las fotos se derivan a la doctora.
- **Consentimiento:** el primer mensaje informa que la conversación se usa para gestionar citas y
  recordatorios.
- **Retención:** la memoria del chat dura 24 horas en Redis. Las ejecuciones guardadas en PostgreSQL
  contienen mensajes de pacientes; para un cliente real, configura la depuración automática
  (`EXECUTIONS_DATA_PRUNE`, `EXECUTIONS_DATA_MAX_AGE`).
- En Ecuador, la Ley Orgánica de Protección de Datos Personales trata los datos de salud como datos
  sensibles. Antes de atender a un consultorio real, revisa con ellos el consentimiento y el
  tratamiento de esos datos.

## Antes de cada commit

```bash
git diff --cached | grep -nE '@gmail|@hotmail|sk-|AIza|Bearer|[0-9]{12,}' || echo "sin hallazgos"
```
