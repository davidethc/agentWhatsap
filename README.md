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

- [`workflows/agente-citas.json`](workflows/agente-citas.json): agente de WhatsApp (Kapso) con Claude que responde
  sobre servicios, consulta Google Calendar y agenda citas. Impórtalo en n8n desde el menú **⋯ → Import from File**.
