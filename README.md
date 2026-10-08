# agentWhatsap

Agente de WhatsApp construido con **n8n Community Edition** (gratis) corriendo en **Docker**.

👉 Guía completa de instalación y uso: [GUIA.md](GUIA.md)

## Arranque rápido

```bash
cp .env.example .env
docker compose up -d
```

(En Windows PowerShell usa `copy .env.example .env`.)

Abre http://localhost:5678 y crea tu cuenta de administrador.

## Workflows

| Archivo | Qué hace |
|---|---|
| [`workflows/agente-citas.json`](workflows/agente-citas.json) | **Barbería · Bot WhatsApp**: recibe mensajes de Kapso, agente IA (OpenRouter) con memoria Redis (24 h), responde por WhatsApp. |
| [`workflows/barberia-agenda-gcal.json`](workflows/barberia-agenda-gcal.json) | **Sub-workflow de agenda**: `turnos` lee Google Calendar y calcula horas libres; `agendar` valida y crea el evento. |

Importa primero el sub-workflow, copia su ID en las herramientas **Ver turnos libres** y **Agendar cita** del bot,
y reemplaza los marcadores `TU-PROYECTO`, `TU_SUPABASE_PUBLISHABLE_KEY`, `TU_BUSINESS_ID` y `TU_CALENDARIO@gmail.com`.
Detalles de Supabase en [`supabase/README.md`](supabase/README.md).
