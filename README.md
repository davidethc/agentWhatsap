# agentWhatsap

Bot de WhatsApp (Kapso) para Exclusive Barber Shop, construido en n8n.

## version4 (flujo único)

Workflow n8n `version4` (id `u4hWSJLdLFVSTtjQ`). Código fuente (n8n Workflow SDK): `n8n/version4/workflow.sdk.ts`.

- **Webhook Kapso** → normaliza el lote → dedup (Redis) → lock por conversación (Redis, encola si está ocupada)
- **Agente Sofi**: OpenRouter (`openrouter/free`) con Gemini de respaldo, memoria Redis por teléfono
- **Herramientas**: `ver_turnos_libres`, `reservar_cita` (el mismo flujo se llama a sí mismo: rama *Agenda interna*), `buscar_mis_citas`, `mover_cita`, `cancelar_cita` (Google Calendar)
- **Turnos**: 1 hora, 07:00–19:00 — mañana (07–12) y tarde (12–19). Horario, días cerrados y servicios se editan en el nodo **Validar pedido**.
- **Salida**: responde por Kapso, procesa mensajes encolados y libera el lock.

Usa el mismo path de webhook que version3, así que en Kapso no hay que cambiar nada: solo despublicar version3 y publicar version4.
