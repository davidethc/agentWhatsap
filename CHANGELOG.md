# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Fechas en hora de
Ecuador.

## [Sin publicar]

### Agregado
- Guía de la reunión de venta con EliDental ([docs/comercial/reunion-elidental.md](docs/comercial/reunion-elidental.md)).

### Cambiado
- La asistente se llama **Eli** y atiende a **EliDental** (Loja, Dra. Viviana Sucunuta) con los
  datos públicos de su Facebook: dirección, WhatsApp 099 970 1778, correo y servicios (valoración,
  limpieza, resina, control de ortodoncia, urgencia). Sin precios; horario provisional. Deriva quejas
  y pedidos de hablar con la doctora al WhatsApp del consultorio.
- Datos del Instagram de EliDental: horario oficial (L–V 09:00–18:00, sábado 09:00–15:00), nombre
  completo y formación de la doctora, lista completa de tratamientos, atención a niños y embarazadas,
  y sedación para pacientes con miedo.
- Horario por día con descanso de mediodía (provisional, reemplazado el mismo día): L–V 09:00–13:00 y 15:00–19:00, sábado
  09:00–13:00, domingo cerrado. `Validar pedido` usa `HORARIO` por bloques; se borró la memoria de chat
  anterior (2 conversaciones de prueba).
- `workflows/sofi-version4.json` → `workflows/eli-version4.json`, `docs/sofi-dentista.md` → `docs/eli-dental.md`.
- `scripts/export-workflow.sh` admite contacto público del negocio (`workflows/.datos-publicos`).
- `version4` en producción con contexto de consultorio dental y datos provisionales: prompt de Sofi
  (trato de usted, urgencias, sin consejos médicos, sin prometer recordatorios), servicios y precios,
  horario 09:00–18:00 de lunes a sábado, eventos `🦷 <Servicio> - <Paciente>`.

### Diseño
- Sofi para consultorios dentales: reglas antes que la IA, urgencias, derivación a la doctora y
  recordatorios de cita con plantilla de Meta ([docs/eli-dental.md](docs/eli-dental.md),
  [ADR 0005](docs/adr/0005-reglas-antes-que-ia.md)).

## 2026-10-10

### Agregado
- Embudo de conversación de Eli por etapas (bienvenida, urgencia, conversación, cita, atendido,
  retención), con mensajes reales, esperas dentro de la ventana de 24 h y plantillas de Meta
  ([docs/embudo-elidental.md](docs/embudo-elidental.md)).
- Guía de instalación en Windows ([docs/instalacion-windows.md](docs/instalacion-windows.md)).

### Cambiado
- `version4` vuelve a la **conversación natural** (sin formulario): el formulario WhatsApp Flow queda
  guardado en la rama `feat/flow-formulario` hasta que Meta permita publicarlo.
- Modelo del agente: `gemini-3.5-flash-lite` (cambiado en el editor de n8n).
- `docs/operacion.md`: cómo levantar todo después de reiniciar el computador.
- `scripts/backup.sh` avisa si Docker no está corriendo.

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
