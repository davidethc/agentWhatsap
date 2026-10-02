# Supabase (barberia-reservas) para el agente de WhatsApp

El agente usa la base de datos de la app **barberia-reservas** como fuente de verdad:
servicios, precios, horarios, barberos, turnos libres y citas.

| Llamada (REST RPC) | Qué hace | Quién la creó |
|---|---|---|
| `public_bot_info(p_business_id)` | Negocio, servicios activos, horario y barberos en un JSON | Este repo (`whatsapp_bot_read_helpers.sql`) |
| `public_bot_slots(p_business_id, p_date, p_service_id)` | Turnos libres por barbero para ese día y servicio | Este repo |
| `create_public_appointment(...)` | Crea/actualiza el cliente en `clients` y la cita en `appointments` (valida horario, choques y doble reserva) | La app (ya existía) |

## Instalar en otro proyecto
1. Supabase → **SQL Editor** → pega `whatsapp_bot_read_helpers.sql` → **Run**.
2. Supabase → *Project Settings → API Keys* → copia la **publishable key** (`sb_publishable_...`).
   Es pública por diseño (la misma que usa la web); los permisos los controlan las funciones.
3. Copia el `id` de tu negocio (`select id, name from businesses;`).
4. En n8n, en los nodos **Info negocio**, **Ver turnos libres** y **Agendar cita** reemplaza:
   - `TU-PROYECTO` → el ref del proyecto (en `https://<ref>.supabase.co`)
   - `TU_SUPABASE_PUBLISHABLE_KEY` → la publishable key
   - `TU_BUSINESS_ID` → el id del negocio

## Notas
- El teléfono se envía en formato local de Ecuador (`0XXXXXXXXX`), que exige `create_public_appointment`;
  el nodo *Normalizar mensaje* convierte `593…` → `0…`.
- Las citas del bot quedan con `source = 'online'` y `status = 'pending'`, igual que las de la web.
- Errores posibles al agendar: `BOOKING_SLOT_TAKEN`, `BOOKING_TOO_SOON`, `BOOKING_PAST_DATE`,
  `BOOKING_INVALID_INPUT`, `BOOKING_SERVICE_NOT_FOUND`, `BOOKING_BARBER_NOT_BOOKABLE`.
