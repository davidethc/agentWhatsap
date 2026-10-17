# QA privacidad — arnés independiente

Alcance: `scripts/e2e-privacidad.mjs`, cuentas/conversaciones/archivos ficticios. API y navegador reales; SQL solo siembra fixtures, concede permisos explícitos y cuenta resultados. No cambia producción ni carga `.env` del repositorio. No elimina cuentas al terminar: quedan para inspección en la BD aislada.

Comandos desde `crm-v2-diseno`:

```
node --check scripts/e2e-privacidad.mjs
node --env-file=/tmp/eli-panel-qa/.env scripts/e2e-privacidad.mjs
# Reiniciar la aplicación QA; después:
node --env-file=/tmp/eli-panel-qa/.env scripts/e2e-privacidad.mjs --resume-purge
```

Guardas antes de escribir: panel HTTP loopback:3100; PostgreSQL loopback:55432 y nombre con `qa`; schema `vocero`; Graph loopback:3100; WA_MOCK_ENABLED=true; MEDIA_DIR bajo `/tmp/eli-panel-qa/`; QA_PASSWORD y BOT_API_KEY de entorno. El coordinador debe comprobar que aplicación y arnés usan exactamente ese mismo entorno.

Casos: 401 anónimo; 403 admin sin grant para historial/medios/SSE; 404 otra organización; acceso doctora; revocación API/medios y cierre SSE; UI tomar/devolver con comprobación BD; envío y reintento contra proveedor mock con conteo; epoch antiguo durante pausa y tras devolver; caducidad en borde de 90 días usando reloj PostgreSQL; anuncio indirecto; DELETE inmediato, repetición, purga física y conservación de ficha; checkpoint persistente y recuperación tras reinicio.

Estado al crear: sintaxis Node PASS. Ejecución API/UI/DB y recuperación por reinicio **pendientes** hasta que el coordinador arranque la versión integrada. La ejecución falla al primer criterio incumplido; no convierte pasos omitidos en PASS. El borde HTTP ocurre después de fijar exactamente 90 días en BD; no demuestra disponibilidad a 1 ms antes del borde.

Pendientes adicionales: pausas y envíos concurrentes con proveedor demorado; fallo/crash entre aceptación del proveedor y commit; descargas tardías durante DELETE; nuevo entrante sin resucitar contenido expirado; eventos UI concurrentes con 403/DELETE; cifrado/rotación y restauración de backups. El checkpoint simula una tarea persistida e interrumpida antes de purgar; no mata un proceso durante unlink/commit.
