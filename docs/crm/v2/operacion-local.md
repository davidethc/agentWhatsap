# Operación local

Diagnóstico sólo lectura, 2026-10-16:

- Docker Desktop instalado; inicialmente docker ps falló por daemon detenido.
  El coordinador lo abrió después; es necesario repetir salud antes de usarlo.
- ngrok instalado en /opt/homebrew/bin/ngrok.
- Inicialmente no había listeners 3000/3001/5678/4040/5432.
- .env de producción presente: no leído ni cargado para las pruebas.
- Sin consultas a mensajes, ejecuciones reales o credenciales.
- Compose declara nombre fijo agentwhatsap y seis servicios persistentes.
  Ejecutarlo desde otro worktree puede alcanzar producción.

## Secuencia del coordinador

1. Abrir Docker Desktop (ya realizado por coordinador) y comprobar docker ps.
   Servicios existentes pueden arrancar automáticamente; no recrearlos sin motivo.
2. Si no arrancan, desde /Users/d/agentWhatsap anunciar docker compose up -d.
   Conservar volúmenes; no usar down -v.
3. Comprobar http://127.0.0.1:5678/healthz y servicios healthy.
4. Anunciar ngrok http 5678 en sesión persistente; comparar URL HTTPS con
   WEBHOOK_URL de .env. Si difiere hace falta actualizar configuración y
   reiniciar n8n/worker; esto corresponde al coordinador.
5. scripts/check.sh desde repo original verifica servicios, versión, Kapso,
   salud y túnel. Carga .env real: no es prueba aislada.
6. Antes de tocar workflow: scripts/backup.sh, trabajar en copia,
   scripts/check.sh y scripts/export-workflow.sh.
7. Abrir http://localhost:5678 y panel local del coordinador. La BD del panel
   debe estar separada del PostgreSQL n8n.
8. Para escribir por WhatsApp confirmar destino del webhook Kapso y ruta
   Eli→Panel. Abrir páginas/arrancar servicios no demuestra esa conexión.
   La copia nueva de simulación sólo usa ejecución manual, no tráfico real.

No se arrancaron servicios desde esta subtarea ni se verificaron login n8n,
credenciales, webhook externo o mensajería real. No se cambió producción.
El arnés ficticio no necesita Docker, ngrok, Kapso ni saldo IA.

Recomprobación tras apertura de Docker por el coordinador: agentwhatsap
PostgreSQL/Redis healthy; n8n/main y worker health:starting, runners up.
GET /healthz devolvió curl 52 (respuesta vacía), por dos comprobaciones.
Ngrok 4040 siguió sin listener. vocero-dev-postgres healthy en host 5432;
varios Supabase legado unhealthy. No se intervinieron esos contenedores.
