# agentWhatsap

Agente de WhatsApp construido con **n8n Community Edition** (gratis) corriendo en **Docker**.

👉 Guía completa de instalación y uso: [GUIA.md](GUIA.md)

## Arranque rápido en Windows

```powershell
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
Copy-Item .env.example .env
docker compose up -d
```

La primera vez Docker descargará n8n y n8n instalará automáticamente el nodo comunitario de Kapso. Luego abre http://localhost:5678 y crea una cuenta de administrador.

El workflow necesita credenciales propias de Kapso, Anthropic y Google Calendar. No están incluidas en el repositorio: cada persona debe configurarlas en n8n.

## Workflows

- [`workflows/agente-citas.json`](workflows/agente-citas.json): agente de WhatsApp (Kapso) con Claude que responde
  sobre servicios, consulta Google Calendar y agenda citas. Impórtalo en n8n desde el menú **⋯ → Import from File**.

Consulta [GUIA.md](GUIA.md) para configurar las credenciales y publicar el webhook para WhatsApp.
