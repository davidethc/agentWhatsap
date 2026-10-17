# Primera entrega: conversaciones privadas de la doctora

Especificación previa a implementación, aprobada mediante el plan del usuario el 2026-10-16. Sustituye los pendientes de definición V2-01; no certifica implementación.

- Solo la cuenta expresamente habilitada de la doctora puede leer conversaciones y adjuntos, responder, tomar/devolver atención y borrar historial. Ser administrador técnico no concede este permiso. Cada operación valida sesión, organización y permiso en servidor.
- Tomar conversación pausa a Eli hasta «Devolver a Eli». Una respuesta generada con una autorización anterior no puede enviarse tras perderla, aunque se devuelva posteriormente. La aceptación previa por un proveedor no se puede cancelar retroactivamente.
- Texto y adjuntos caducan exactamente a los 90 días de última actividad. La lectura caduca aunque la purga diaria todavía no haya corrido. Una actividad nueva no debe recuperar historial ya caducado.
- El borrado anticipado oculta inmediatamente, invalida operaciones pendientes y deja una tarea persistente idempotente para eliminar contenido y archivos. Se conserva actor/fecha sin copiar contenido. Nunca elimina contacto ni ficha clínica.
- Copias cifradas: rotación máxima propuesta de siete días; reaplicar borrados antes de habilitar restauración. Es requisito operativo pendiente de ensayo, no garantía actual. No cubre copias externas WhatsApp/proveedores.
- No se cambian dependencias, Gemini ni conversación natural. Datos de pruebas ficticios, sin push y sin gastos nuevos.

## Aceptación

1. Llamadas directas de anónimo, administrador sin permiso y otra organización no revelan contenido ni adjuntos; SSE también aplica permisos y revocación.
2. Takeover/envío concurrentes, repetición y reintentos no permiten respuestas viejas o duplicadas.
3. Límite 90 días exacto, purga interrumpida/reanudada y borrado anticipado sin afectar ficha.
4. UI existente con carga, vacío, error, pendiente, foco y confirmación de eliminación.
5. Migraciones aisladas, lint, tipos, tests, build y recorrido real local ficticio.

## Ampliación solicitada durante ejecución

El usuario pidió dejar abiertos Docker, n8n, panel y ngrok para probar él mismo por WhatsApp al terminar. Se registra como paso final separado: comprobar servicios y URLs, conexiones y flujo antes de afirmar que está listo. Cualquier cambio a Eli requiere scripts/backup.sh, copia del flujo y scripts/check.sh. No enviar mensajes reales automáticamente ni usar pacientes como pruebas. La implementación local no demuestra integración productiva.
