# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Fechas en hora de
Ecuador.

## [Sin publicar]

### Cambiado
- `version4` en producción con contexto de consultorio dental y datos provisionales: prompt de Sofi
  (trato de usted, urgencias, sin consejos médicos, sin prometer recordatorios), servicios y precios,
  horario 09:00–18:00 de lunes a sábado, eventos `🦷 <Servicio> - <Paciente>`.

### Diseño
- Sofi para consultorios dentales: reglas antes que la IA, urgencias, derivación a la doctora y
  recordatorios de cita con plantilla de Meta ([docs/sofi-dentista.md](docs/sofi-dentista.md),
  [ADR 0005](docs/adr/0005-reglas-antes-que-ia.md)).

## 2026-10-07

### Cambiado
- `version4` usa solo Gemini (`gemini-3.5-flash`); se quitó OpenRouter ([ADR 0003](docs/adr/0003-gemini.md)).
- Repositorio reorganizado: `docs/` (arquitectura, operación, seguridad, ADR), `scripts/`,
  `workflows/` (producción, pruebas, legacy), normas en `CONTRIBUTING.md`.
- `GUIA.md` reescrita para el sistema actual (queue mode, Gemini, Redis local, `sofi-version4.json`).

### Agregado
- `scripts/init-env.sh`, `check.sh`, `backup.sh` y `export-workflow.sh`.
- Workflows de autotest en `workflows/pruebas/`.
- Historial v2 (Supabase, sub-workflow de agenda) y fuente SDK de version4, integrados en `legacy/`.

### Seguridad
- Se reemplazaron por marcadores el correo del calendario, el `phone_number_id`, los IDs de
  credenciales y un teléfono de ejemplo en los archivos del repositorio.

## 2026-10-06

### Cambiado
- n8n 2.41.5 en **modo queue**: PostgreSQL 18, Redis 7, worker y runners externos; migración de SQLite
  con `import:entities` y ajuste de secuencias ([ADR 0001](docs/adr/0001-queue-mode.md)).
- Estado del bot en Redis local (DB 1), en vez de Redis Cloud ([ADR 0002](docs/adr/0002-redis-local.md)).

## 2026-10-02

### Agregado
- `version4`: un solo workflow con la agenda como entrada interna, dedup, lock por conversación y
  cola de pendientes en Redis ([ADR 0004](docs/adr/0004-un-solo-workflow.md)).
- v2: integración con Supabase (`barberia-reservas`) y sub-workflow de agenda validado.
- Mensaje de aviso al cliente cuando el agente falla; reglas contra horarios inventados.

### Cambiado
- Modelo: de Claude a OpenRouter y luego a Gemini Flash (nivel gratuito).

## 2026-10-01

### Agregado
- Primera versión: n8n en Docker, workflow de citas con Kapso, Claude y Google Calendar.
