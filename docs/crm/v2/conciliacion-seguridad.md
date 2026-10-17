# V2-07 — conciliación de evidencia

2026-10-16. Estado: revisión local en curso, no certificación de producción. Fuente histórica: ../auditoria-transicion.md, ../qa.md y ../backup-crm.md.

| Observación | Evidencia actual | Límite |
|---|---|---|
| TK-13 respaldo | El script histórico respalda Supabase, no prueba restauración de PostgreSQL nuevo | Copias cifradas/rotación siete días y reaplicación de borrados requieren ensayo propio; no cerrar con checksum |
| TK-36 E2E | Base nueva: 1026 tests, lint, tipos y build pasan en c2d05a8 | No demuestra nueva política, integración WhatsApp ni Calendar |
| S1 cabeceras | next.config.ts define CSP, DENY, nosniff, Referrer/Permissions-Policy y poweredByHeader:false | Falta comprobar respuestas HTTP de la entrega integrada |
| S2 logout GET | app-nav.tsx llama signOut de Better Auth; no hay ruta /salir nueva | Falta comprobar método en navegador/API |
| S3 contraseña 6 | Better Auth configura minPasswordLength:8 en servidor | No equivale a política 12 del legado; no atribuir el cierre legado al stack nuevo |
| S4 logs Redis | CRM nuevo no usa Redis para mensajes, pero lib/api.ts y ingest.ts imprimían errores completos | Backend de esta entrega debe sanear errores; revisar también otras superficies antes de producción |
| S5 privilegios anon | Esquema Drizzle/PostgreSQL, sin rol Supabase anon en arquitectura nueva | No demuestra permisos correctos del usuario PostgreSQL del despliegue; ensayar sólo base aislada |

Los cierres históricos se conservan sin sobrescribirlos. Ni el arranque de Docker ni la presencia de archivos acreditan que una integración esté conectada o que las observaciones estén resueltas en remoto.
