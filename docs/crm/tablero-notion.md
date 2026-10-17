# Tablero SDD: foto verificada

Fecha: 2026-10-16. Los IDs ORQ/V2 son nombres de tarea; Notion asigna también un autonúmero TK. Los estados históricos no certifican el CRM nuevo.

| ID | Tarea | Estado | Alcance | Transición |
|---|---|---|---|---|
| TK-1 | [Inicializar Supabase local (CLI, config, Auth sin registro, extensiones)](https://app.notion.com/p/3f55445f5f8681c590fee308a18613fe) | Done | Legado | Pendiente de verificar |
| TK-2 | [Migración: tipos, personal, conversaciones, pacientes y datos_clinicos con RLS](https://app.notion.com/p/3f55445f5f86819780acf875e5c44e50) | Done | Legado | Pendiente de verificar |
| TK-3 | [Migración: mensajes, citas, cambios_etapa, horario, errores_integracion y sync_calendario con RLS y Realtime](https://app.notion.com/p/3f55445f5f8681f78309c6df8659c63c) | Done | Legado | Pendiente de verificar |
| TK-4 | [Auditoría por trigger y bloqueo de datos clínicos sin consentimiento](https://app.notion.com/p/3f55445f5f86818a9efae854e431717e) | Done | Legado | Pendiente de verificar |
| TK-5 | [Funciones de etapa: mover_etapa y marcar_asistencia](https://app.notion.com/p/3f55445f5f86814cbf8ce0ddb73b069d) | Done | Legado | Pendiente de verificar |
| TK-6 | [Funciones: crear_paciente (duplicado/responsable) y guardar_cita/cancelar_cita](https://app.notion.com/p/3f55445f5f868102b235f9bb14dc7b59) | Done | Legado | Pendiente de verificar |
| TK-7 | [registrar_evento_eli: mensaje_entrante, mensaje_saliente y cita_reservada (idempotente)](https://app.notion.com/p/3f55445f5f868126b9fcc47d9400d18f) | Done | Legado | Pendiente de verificar |
| TK-8 | [Edge Function eli-evento (secreto y validación)](https://app.notion.com/p/3f55445f5f868180b3f9f4e33fd1ed9f) | Done | Legado | Sustituido |
| TK-9 | [Tarea programada: Perdido (no respondió) a las 24 h](https://app.notion.com/p/3f55445f5f868145b2a7ff936ee2b1ce) | Done | Legado | Pendiente de verificar |
| TK-10 | [Función resumen_del_dia: citas de hoy, números, cumpleaños y retornos](https://app.notion.com/p/3f55445f5f8681da84b9dfe18e8374c0) | Done | Legado | Pendiente de verificar |
| TK-11 | [seed.sql con datos inventados y tipos TypeScript generados](https://app.notion.com/p/3f55445f5f86815ba929ceede352f367) | Done | Legado | Sustituido |
| TK-12 | [✋ Crear el proyecto remoto eli-crm y aplicar las migraciones](https://app.notion.com/p/3f55445f5f8681539cf6c9040d1e48d6) | Done | Legado | Sustituido |
| TK-13 | [Script [backup-crm.sh](http://backup-crm.sh) (copia semanal de la base)](https://app.notion.com/p/3f55445f5f868172a750d375b664d3e1) | Done | Legado | Pendiente de verificar |
| TK-14 | [Guía y secretos: cuenta de servicio de Google y calendario compartido](https://app.notion.com/p/3f55445f5f8681f2bd99df81a7052faa) | Testing | Legado | Pendiente de verificar |
| TK-15 | [Función calendario: push de citas pendientes a Google Calendar](https://app.notion.com/p/3f55445f5f86817c82aacbb87df53739) | Backlog | Legado | Pendiente de verificar |
| TK-16 | [Función calendario: pull incremental de Google Calendar](https://app.notion.com/p/3f55445f5f868128819bf3dc29406eef) | Backlog | Legado | Pendiente de verificar |
| TK-17 | [Disparos y conflictos: trigger pg_net, cron de 2 min y etag](https://app.notion.com/p/3f55445f5f868135a952dbe37629dfaa) | Backlog | Legado | Sustituido |
| TK-18 | [Sub-workflow n8n «Eli → CRM»](https://app.notion.com/p/3f55445f5f86810dab58f787beb65ff6) | Done | Legado | Sustituido |
| TK-19 | [Conectar una COPIA de version4 a «Eli → CRM» en 3 puntos, sin esperar](https://app.notion.com/p/3f55445f5f8681859d47c128b2f3f51d) | Done | Legado | Pendiente de verificar |
| TK-20 | [✋ Aplicar el cambio al version4 real](https://app.notion.com/p/3f55445f5f8681348110e2bb8de438b5) | Testing | Legado | Sustituido |
| TK-21 | [Scaffold crm/: Next.js, TypeScript estricto, Tailwind, shadcn, tema clínico, Inter y Lucide](https://app.notion.com/p/3f55445f5f86819cbab4d71a9ede127e) | Done | Legado | Reutilizable |
| TK-22 | [Login, middleware y layout con menú lateral](https://app.notion.com/p/3f55445f5f86819d97e5e0121b76b6ca) | Done | Legado | Pendiente de verificar |
| TK-23 | [Capa de datos lib/data (interfaz, adaptador Supabase y adaptador falso)](https://app.notion.com/p/3f55445f5f86819f937beff73aa770ab) | Done | Legado | Pendiente de verificar |
| TK-24 | [Resumen: citas de hoy, Asistió / No asistió y diálogo «volver en»](https://app.notion.com/p/3f55445f5f868188a87ae65fa27ecd01) | Done | Legado | Pendiente de verificar |
| TK-25 | [Resumen: tarjetas de números y gráficos](https://app.notion.com/p/3f55445f5f86815899eff5540d5db4cf) | Done | Legado | Pendiente de verificar |
| TK-26 | [Resumen: cumpleaños y retornos](https://app.notion.com/p/3f55445f5f86810ca9d6cbcb5e23afc9) | Done | Legado | Pendiente de verificar |
| TK-27 | [Kanban: 6 columnas, arrastrar con dnd-kit y motivo de Perdido](https://app.notion.com/p/3f55445f5f8681468dbfe6f9da55307d) | Done | Legado | Pendiente de verificar |
| TK-28 | [Kanban: búsqueda y actualización en tiempo real](https://app.notion.com/p/3f55445f5f8681e496b3fb11ad1ed592) | Done | Legado | Reutilizable |
| TK-29 | [Ficha: datos básicos editables, responsable/dependientes e historial de etapas](https://app.notion.com/p/3f55445f5f8681f1912dfc97e5890fd3) | Done | Legado | Pendiente de verificar |
| TK-30 | [Ficha: datos clínicos con consentimiento](https://app.notion.com/p/3f55445f5f8681629fc4f7d6235cf0fc) | Done | Legado | Pendiente de verificar |
| TK-31 | [Ficha: conversación con Eli de solo lectura](https://app.notion.com/p/3f55445f5f86814993b7d07db303fe6c) | Backlog | Legado | Sustituido |
| TK-32 | [Nuevo paciente (formulario, duplicado por teléfono y dependiente)](https://app.notion.com/p/3f55445f5f8681a8bbe7e7e809955011) | Done | Legado | Pendiente de verificar |
| TK-33 | [Citas: crear, editar y cancelar desde el panel](https://app.notion.com/p/3f55445f5f8681b385c9e2429fb8629d) | Done | Legado | Pendiente de verificar |
| TK-34 | [Citas: vista de semana y vincular citas sin paciente](https://app.notion.com/p/3f55445f5f8681509430d1207dd6f82f) | Done | Legado | Pendiente de verificar |
| TK-35 | [✋ Publicar el panel en Netlify gratis](https://app.notion.com/p/3f55445f5f86814fae07df32fb788fb6) | Done | Legado | Sustituido |
| TK-36 | [QA: pruebas de punta a punta del panel (HU-1 a HU-9)](https://app.notion.com/p/3f55445f5f86813e9dc0ea69fc983b77) | Done | Legado | Sustituido |
| TK-37 | [QA: integración Eli → CRM, incluido el CRM caído](https://app.notion.com/p/3f55445f5f8681f2b3d2ca9054079a8f) | Done | Legado | Pendiente de verificar |
| TK-38 | [QA: sincronización con Google Calendar](https://app.notion.com/p/3f55445f5f8681908fb3f800617487d2) | Backlog | Legado | Pendiente de verificar |
| TK-39 | [QA: revisión de seguridad y datos de salud](https://app.notion.com/p/3f55445f5f86811cabd7d05f70817275) | Done | Legado | Pendiente de verificar |
| TK-40 | [Documentación final del Eli Panel](https://app.notion.com/p/3f55445f5f86811581dae86db79f82ee) | Testing | Legado | Sustituido |
| TK-41 | [Quitar del CRM el contenido de los mensajes (por ahora)](https://app.notion.com/p/3f65445f5f868197ae3ae4cb168f4064) | Testing | Legado | Sustituido |
| TK-42 | [ORQ-01 · Lanzador Codex/tmux](https://app.notion.com/p/3fc5445f5f86819e8dffd41b1b905723) | In progress | Orquestación | — |
| TK-43 | [ORQ-02 · Transición SDD y roles](https://app.notion.com/p/3fc5445f5f868191af8aef34a85d3cb2) | In progress | Orquestación | — |
| TK-44 | [ORQ-03 · Revisión y simulacro de orquestación](https://app.notion.com/p/3fc5445f5f8681fb87fbf8a859f608b5) | In progress | Orquestación | — |
| TK-45 | [V2-01 · Especificar privacidad y bandeja](https://app.notion.com/p/3fc5445f5f8681f78184e15c015bbc8f) | Ready | CRM nuevo | — |
| TK-46 | [V2-02 · Especificar agenda única](https://app.notion.com/p/3fc5445f5f8681ac8bc7d41e6ace4bd9) | Backlog | CRM nuevo | — |
| TK-47 | [V2-03 · Especificar integración fiable](https://app.notion.com/p/3fc5445f5f868123b874fc683e06381b) | Backlog | CRM nuevo | — |
| TK-48 | [V2-04 · Especificar operación permanente](https://app.notion.com/p/3fc5445f5f868156b0c8dfd854a4c17d) | Backlog | CRM nuevo | — |
| TK-49 | [V2-05 · Especificar funciones de doctora](https://app.notion.com/p/3fc5445f5f86813085ffe0cb16edcba9) | Backlog | CRM nuevo | — |
| TK-50 | [V2-06 · Piloto completo conectado](https://app.notion.com/p/3fc5445f5f8681de8184df4072168aa1) | Backlog | CRM nuevo | — |
| TK-51 | [V2-07 · Conciliar cierres y seguridad](https://app.notion.com/p/3fc5445f5f8681419a9efd37b4175d11) | Ready | CRM nuevo | — |

