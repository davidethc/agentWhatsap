# Sofi: asistente de citas por WhatsApp

Sofi atiende por WhatsApp, entiende lo que pide el cliente, consulta la agenda y reserva, mueve o
cancela citas en Google Calendar. Está construida con **n8n** (en modo queue, dentro de Docker),
**Kapso** como puente con WhatsApp y **Gemini** como modelo de IA.

| | |
|---|---|
| **En producción** | `version4`, configurada para una barbería ([workflow](workflows/sofi-version4.json)) |
| **Siguiente paso** | Adaptarla a consultorios dentales, con recordatorios de cita ([diseño](docs/sofi-dentista.md)) |
| **Stack** | n8n 2.41.5 (main + worker + runners) · PostgreSQL 18 · Redis 7 · Kapso · Gemini · Google Calendar · ngrok |

```mermaid
flowchart LR
  P[WhatsApp] --> K[Kapso] --> T[ngrok] --> N[n8n principal]
  N -- cola Redis --> W[n8n worker]
  W --> AI[Gemini]
  W --> C[Google Calendar]
  W --> R[(Redis: memoria y locks)]
  N & W --> DB[(PostgreSQL)]
  W -- respuesta --> K
```

## Inicio rápido

Requisitos: Docker Desktop, git, jq, openssl y ngrok. Paso a paso completo en **[GUIA.md](GUIA.md)**.

```bash
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
scripts/init-env.sh          # crea .env con secretos nuevos
docker compose up -d         # levanta los 6 servicios
scripts/check.sh             # todo debe salir OK
```

Después: abre n8n, crea las credenciales (Kapso, Gemini, Google Calendar, Redis local) e importa
`workflows/sofi-version4.json` ([GUIA, pasos 8 y 9](GUIA.md#8-credenciales-en-n8n)).

## Documentación

| Documento | Para quién | Contenido |
|---|---|---|
| [GUIA.md](GUIA.md) | Quien instala | Instalación desde cero: cuentas, Docker, ngrok, Kapso, Google, Gemini, workflow, pruebas |
| [docs/arquitectura.md](docs/arquitectura.md) | Quien desarrolla | Componentes, recorrido de un mensaje, claves de Redis, decisiones y límites |
| [docs/operacion.md](docs/operacion.md) | Quien mantiene | Encender, revisar, publicar, respaldar, restaurar, migrar y problemas conocidos |
| [docs/seguridad.md](docs/seguridad.md) | Todos | Secretos y datos de pacientes |
| [docs/sofi-dentista.md](docs/sofi-dentista.md) | Producto | Conversación para dentistas, reglas, urgencias, recordatorios, costos y pendientes |
| [docs/adr/](docs/adr/) | Quien decide | Por qué el sistema es como es |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Quien contribuye | Normas, ramas, cómo cambiar un workflow, definición de terminado |
| [CHANGELOG.md](CHANGELOG.md) | Todos | Historial de versiones |
| [workflows/README.md](workflows/README.md) | Quien desarrolla | Catálogo de workflows |

## Comandos

| Acción | Comando |
|---|---|
| Encender | `docker compose up -d` y `ngrok http --url=TU-DOMINIO 5678` |
| Revisar salud | `scripts/check.sh` |
| Respaldo completo | `scripts/backup.sh` |
| Exportar un workflow | `scripts/export-workflow.sh <ID> workflows/<archivo>.json` |
| Apagar (conserva los datos) | `docker compose stop` |

> ⚠️ Nunca `docker compose down -v`: borra workflows, credenciales y la base de datos.

## Límites actuales

- Corre en un computador personal: si se apaga o se suspende, Sofi no responde. Para 24/7 hace falta
  un servidor.
- Solo WhatsApp (Kapso). Instagram y Messenger no están integrados.
- Desde octubre de 2026, Meta cobra cada mensaje enviado ([costos](docs/sofi-dentista.md#8-costos)).
