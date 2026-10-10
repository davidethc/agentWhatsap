# Eli Panel: registro de integración

Lo escribe `crm-orquestador`. Cada entrega de un agente que se une a `feat/crm` queda aquí, con su
verificación.

| Fecha | Tarea | Rama | Merge | Verificación | Notas |
|---|---|---|---|---|---|
| 2026-10-10 | TK-14 Guía de Google Calendar | `feat/crm-n8n` | `2f0530d` | `node --check scripts/gcal-prueba.mjs` ok; sin claves en el diff; `.gitignore` cubre las claves JSON; la guía dice que no se pide tarjeta | Falta que el usuario cree la cuenta de servicio y el calendario de prueba, y corra el script |
