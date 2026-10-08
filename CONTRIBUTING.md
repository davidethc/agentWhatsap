# Normas y procesos

Cómo trabajar en este proyecto sin romper producción ni filtrar datos.

## Principios

1. **Producción primero:** Eli atiende personas reales. Nada se prueba con pacientes ni con su número.
2. **Nada privado en Git:** ni secretos, ni teléfonos, ni conversaciones, ni el calendario real (ver
   [docs/seguridad.md](docs/seguridad.md)).
3. **Todo cambio se puede deshacer:** respaldo antes de tocar, y lo anterior va a `legacy/`, no se borra.
4. **Lo que no está escrito no existe:** cada decisión importante deja un ADR y cada versión, una
   entrada en el CHANGELOG.

## Estructura

```
├── README.md               Qué es, arranque rápido y mapa
├── GUIA.md                 Instalación paso a paso
├── CONTRIBUTING.md         Este archivo
├── CHANGELOG.md            Historial de versiones
├── docker-compose.yml      Infraestructura (queue mode)
├── .env.example            Plantilla de configuración, sin secretos
├── scripts/                init-env, check, backup, export-workflow
├── docs/
│   ├── arquitectura.md     Componentes, recorrido de un mensaje, claves de Redis
│   ├── operacion.md        Runbook: publicar, respaldar, restaurar, problemas
│   ├── seguridad.md        Secretos y datos de pacientes
│   ├── eli-dental.md       Diseño conversacional, datos de EliDental y recordatorios
│   ├── comercial/          Guía de la reunión de venta
│   └── adr/                Registros de decisiones
├── flows/                  WhatsApp Flows (formularios) en JSON
├── workflows/              Exportaciones de n8n (producción, pruebas, legacy)
└── supabase/               Integración opcional de la v2
```

## Ramas y commits

- `main` siempre refleja lo que está en producción o listo para estarlo.
- Trabajo en ramas cortas: `feat/<tema>`, `fix/<tema>`, `docs/<tema>`, `chore/<tema>`.
- Mensajes de commit en imperativo, con prefijo:
  `feat: recordatorio de cita con plantilla de Meta`, `fix: secuencias de PostgreSQL tras importar`,
  `docs: guía de restauración`.
- Todo entra a `main` por Pull Request, con al menos una revisión.

## Cambiar un workflow

1. `scripts/backup.sh`.
2. Edita en n8n. Si el cambio es grande, hazlo en una **copia** (*⋯ → Duplicate*) sin publicar.
3. Prueba con tu propio número, o con un webhook de prueba que no envíe mensajes.
4. **Save** y **Publish**. Revisa **Executions** y `docker compose logs n8n-worker`.
5. Exporta: `scripts/export-workflow.sh <ID> workflows/<archivo>.json`. Si el script avisa de datos
   privados, corrígelo antes de seguir.
6. Actualiza la documentación afectada (`docs/arquitectura.md`, `docs/eli-dental.md`) y el CHANGELOG.
7. Abre el PR con: qué cambia, por qué, cómo se probó y cómo se vuelve atrás.

## Cambiar la infraestructura

- La versión de n8n se cambia solo en `.env` (`N8N_VERSION`). n8n, el worker y los runners siempre en
  la misma versión.
- Antes de actualizar n8n: `scripts/backup.sh`, leer las notas de la versión nueva y probar primero en
  una copia.
- Valida el Compose antes de levantar: `docker compose config --quiet`.
- PostgreSQL y Redis nunca publican puertos. n8n solo en `127.0.0.1`.
- Comandos **prohibidos** en una instalación con datos: `docker compose down -v`, `docker volume rm`,
  `docker system prune --volumes`, cambiar `N8N_ENCRYPTION_KEY`.

## Decisiones (ADR)

Cuando un cambio afecta la arquitectura (un servicio nuevo, otro proveedor de IA, otra forma de guardar
datos), agrega `docs/adr/NNNN-titulo.md` con **Estado, Fecha, Contexto, Decisión y Consecuencias**, y
enlázalo en la tabla de [docs/arquitectura.md](docs/arquitectura.md#decisiones-de-arquitectura). Un ADR
no se edita después de aceptado: si la decisión cambia, se escribe uno nuevo que lo reemplace.

## Definición de terminado

- [ ] Funciona en n8n y se probó sin afectar a pacientes reales
- [ ] `scripts/check.sh` sale todo OK
- [ ] Workflow exportado con `scripts/export-workflow.sh`, sin avisos
- [ ] Documentación y CHANGELOG actualizados
- [ ] Revisión de secretos: `git diff --cached | grep -nE '@gmail|sk-|AIza|Bearer|[0-9]{12,}'`
- [ ] Hay un respaldo de antes del cambio
