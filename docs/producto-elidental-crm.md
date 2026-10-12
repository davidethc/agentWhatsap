# EliDental CRM — Documento de producto

## 1. Qué es EliDental CRM

EliDental CRM es el panel de trabajo del consultorio EliDental (Loja, Ecuador).
Es el lugar donde la doctora ve, en un solo tablero, lo que pasa por WhatsApp:
las conversaciones, el embudo de pacientes y la agenda del consultorio.

Tres ideas lo definen:

- **Una sola clínica.** No es una plataforma multi-negocio: una instancia es un
  consultorio, con su marca (EliDental, acento turquesa #0e7490), su horario, su
  zona horaria (America/Guayaquil) y su moneda (USD).
- **WhatsApp como canal.** Todo entra y sale por la WhatsApp Cloud API oficial de
  Meta. No usa sesiones web ni librerías no oficiales.
- **White-label sobre vocero-crm.** Es una adaptación de vocero-crm, un CRM de
  WhatsApp open source bajo licencia MIT. Se cambió la marca, el embudo, la
  agenda y el agente para el caso dental.

El agente de IA del CRM es **Eli**, la misma asistente que atiende por WhatsApp.
Eli conversa de forma natural, sin botones ni formularios, y lleva al paciente a
una cita concreta.

## 2. Módulos y qué resuelven

| Módulo | Qué resuelve |
|---|---|
| Bandeja | Ver y responder las conversaciones de WhatsApp en tiempo real. Muestra el hilo, el contacto, la ventana de 24 horas, las respuestas de Eli marcadas como IA y permite pasar la conversación a la doctora con un click (handoff). Acepta texto y adjuntos (imagen, audio, video, documento). |
| Pipeline de pacientes | Ordenar a los pacientes por etapa del recorrido, en un tablero kanban: Nuevo, Interesado, Agendó, Asistió, Seguimiento, Perdido. Eli puede mover a un paciente de etapa cuando detecta la intención. |
| Pacientes | Cada persona que escribe queda registrada con su ficha, notas y el historial de conversación. Es la base de contacto del consultorio. |
| Citas / agenda dental | Calendario del consultorio (Día, Semana, Mes, Lista) en la zona horaria del negocio. Eli ofrece solo huecos reales, reserva el que el paciente elige, y permite reprogramar, marcar realizada, marcar «no asistió», cancelar y bloquear horarios. Los conectores entregan la cita (enlace fijo, Google Calendar + Meet o Zoom). |
| Agente Eli + knowledge base | El comportamiento del agente: nombre (Eli), tono, instrucciones, reglas de escalado y el conocimiento del consultorio en pares pregunta/respuesta y bloques libres. Eli responde solo con lo que sabe y escala a la doctora cuando corresponde. |
| Laboratorio | Pacientes simulados conversan contra Eli en un sandbox interno que jamás envía mensajes reales. Un juez independiente evalúa cada conversación y da un puntaje, hallazgos con evidencia y sugerencias para el conocimiento. Sirve para probar a Eli antes de que hable con pacientes reales. |
| Resultados | Números del consultorio: conversaciones nuevas, embudo, citas realizadas, canceladas y no asistidas, contra el periodo anterior. Todo sale de los datos del propio CRM. |
| Ajustes | Configuración: WhatsApp (credenciales y webhook), Marca (nombre, color, logo), Plantillas, Equipo, IA (proveedor y llave), Agenda (horario y conexión de calendario). |

## 3. Embudo del paciente

Recorrido de un paciente por WhatsApp, de la primera consulta a la vuelta
(limpieza de los 6 meses):

| Etapa | Qué significa | Cómo se llega |
|---|---|---|
| Nuevo | El paciente escribió por primera vez. | Entra automáticamente con su primer mensaje. |
| Interesado | Eli conversó y el paciente mostró interés concreto. | La conversación avanza hacia un motivo de cita. |
| Agendó | El paciente tiene una cita reservada. | Eli reserva un hueco real en la agenda. |
| Asistió | El paciente llegó a su cita. | Se marca la cita como realizada. Esta etapa se considera ganada. |
| Seguimiento | El paciente ya se atendió y vuelve a la conversación (control, otro tratamiento, recall). | Después de la cita o cuando el paciente vuelve a escribir. |
| Perdido | Se cerró sin cita ni atención. | Cuando el paciente deja de responder, no llega, o él mismo dice que no. Esta etapa se considera perdida. |

Motivación de **Perdido**: que el CRM distinga entre quien todavía se puede
recuperar y quien cerró el ciclo. Un paciente en silencio o que no asistió no
desaparece: queda en Perdido para que la doctora (o un mensaje futuro) pueda
retomarlo.

## 4. Agenda dental

Configuración por defecto del consultorio, ajustable en Ajustes → Agenda:

| Parámetro | Valor |
|---|---|
| Horario | Lunes a viernes 09:00-18:00; sábado 09:00-15:00; domingo cerrado |
| Zona horaria | America/Guayaquil |
| Aviso mínimo | 2 horas de anticipación para agendar |
| Ventana de días | 7 días hacia adelante |
| Duración de cita | Por defecto 30 minutos (se ajusta por tipo de cita) |

**Conectores de entrega de la cita** (cómo se entrega la reunión o el turno):

| Conector | Qué hace | Necesita |
|---|---|---|
| Enlace fijo (por defecto) | Reparte la sala o enlace de siempre. | Nada |
| Google Calendar + Meet | Crea un evento en el calendario con su enlace de Meet. | Una app de Google Cloud del consultorio |
| Zoom | Una reunión por cita; mover la mueve, cancelar la borra. | Una app Server-to-Server de Zoom |

Dos garantías que no se negocian: Eli **solo reserva un horario que ya ofreció**
y **nunca confirma una cita que no se creó**. Si el hueco se ocupó a media
conversación, ofrece alternativas frescas en vez de una promesa falsa.

## 5. Reglas de Eli

Eli conversa sin botones ni formularios, con trato de usted y mensajes cortos.
Reglas tomadas de la operación real del consultorio:

| Regla | Cómo la aplica |
|---|---|
| Nunca da precios | El valor lo confirma la doctora en la consulta. Si preguntan, ofrece una valoración. |
| No diagnostica | No interpreta síntomas ni fotos. Ofrece una valoración y pasa el caso a la doctora. |
| Urgencias | Ante dolor fuerte, hinchazón, diente roto, sangrado o fiebre: empatía, el primer turno libre real e indicación de acudir a emergencias si los síntomas son graves. |
| Derivación a la doctora | Preguntas clínicas, quejas y «quiero hablar con la doctora» se derivan al WhatsApp del consultorio: **099 970 1778**. |
| Dos o tres turnos concretos | Nunca pregunta «¿qué día puede?» sin opciones. Ofrece máximo dos o tres turnos reales de la agenda. |
| Trato de usted | Habla de usted al paciente, con una sola pregunta al final de cada mensaje. |
| Honestidad | Si le preguntan si es un bot, dice que es la asistente virtual de EliDental. No inventa horarios, precios ni urgencias. |

Datos públicos del consultorio que Eli usa: dirección Av. Manuel Agustín Aguirre
343-39, entre Miguel Riofrío y Azuay, Loja; WhatsApp y celular **099 970 1778**;
horario L-V 09:00-18:00 y sábado 09:00-15:00.

## 6. Costos mensuales estimados

| Concepto | Estimado | Nota |
|---|---|---|
| Mensajes de Meta (WhatsApp) | Dentro del presupuesto | Cada número tiene 1000 mensajes de servicio gratis al mes. El costo principal son los recordatorios de cita (plantillas cobradas por Meta), unos 40 a 100 al mes con 10 a 25 citas por semana. |
| Servidor VPS | ~$5 al mes | Para tener el bot 24/7 y el CRM en línea. |
| Uso de IA | Dentro del presupuesto | El agente Eli y el Laboratorio. Se cuida para no salir del plan. |
| **Total estimado** | **~$20 al mes** | El segundo aviso de cita y los mensajes de «no llegó» solo se activan si los números cierran. |

El volumen esperado (10 a 25 citas por semana) cabe en el presupuesto; las
respuestas normales de cada conversación suelen caer dentro de los 1000 mensajes
gratis, por lo que los recordatorios son el gasto variable a vigilar.

## 7. Propuesta comercial para la doctora

Basada en la reunión del 9 de octubre de 2026 y con montos a confirmar tras las
preguntas de cierre.

| Concepto | Qué incluye | Precio sugerido |
|---|---|---|
| Implementación (pago único) | Configuración con sus servicios, horario y tono; conexión del número y la agenda; recordatorios; capacitación de 30 minutos. | $150 a $250 (dentro de su rango de $100 a $300) |
| Piloto (primer mes) | Todo funcionando, revisión semanal de conversaciones y ajustes. | Incluido en la implementación |
| Mensualidad | Servidor 24/7, mantenimiento, ajustes de horario y promociones, soporte por WhatsApp. | $20 al mes |
| Costos de terceros | Mensajes de Meta (sobre todo recordatorios) y uso de la IA. | Al costo, o incluidos hasta un volumen acordado |

Cuidado con el margen: los $20 mensuales deben cubrir servidor, IA y mensajes de
Meta. Si no cierra, se ofrecen los costos de Meta e IA aparte, o un plan de $25 a
$30 con recordatorios incluidos.

Honestidad sobre el alcance: el agente que agendará y responderá 24/7 es Eli, y
las piezas base ya funcionan. Los recordatorios de cita, el aviso a la doctora y
el resumen diario se entregan durante el piloto.

## 8. Plan de despliegue resumido

1. **Servidor VPS** (~$5 al mes) con Docker.
2. **Coolify** o `docker compose` para desplegar el CRM.
3. **Dominio con https**: un registro DNS apuntando al VPS (Meta exige https para
   los webhooks). Caddy emite el certificado solo.
4. **Variables de entorno**: se generan con `pnpm init-env` (base de datos,
   secretos, verify token del webhook). `pnpm doctor` las revisa antes de arrancar.
5. **Banderas**: la agenda va encendida por defecto (`AGENDA=on`).
6. **Copia de seguridad**: respaldo periódico de la base de datos y del volumen de
   datos del CRM.
7. **Credenciales en la app**: WhatsApp e IA se configuran desde Ajustes.

## 9. Checklist de conexión de WhatsApp con la Meta Cloud API (099 970 1778)

Objetivo: conectar el número existente del consultorio en **modo coexistencia**,
para que la doctora siga usando WhatsApp en su celular y Eli responda al mismo
tiempo en el mismo número.

> Este paso requiere que **el usuario tenga acceso a Meta Business** (la página de
> Facebook del consultorio y Meta Business Suite).

- [ ] **1. Crear la app** en [Meta for Developers](https://developers.facebook.com)
  (tipo Negocio) para EliDental.
- [ ] **2. Agregar el producto WhatsApp Business** y vincular el número existente
  **099 970 1778** en **modo coexistencia** (para no perder la app ni los chats
  actuales).
- [ ] **3. Anotar las credenciales del número**: **Phone Number ID** y **WABA ID**
  (WhatsApp Business Account ID).
- [ ] **4. Crear un token permanente** de usuario del sistema con permisos
  `whatsapp_business_messaging` y `whatsapp_business_management`.
- [ ] **5. Configurar en el CRM, Ajustes → WhatsApp**: pegar WABA ID, Phone Number
  ID y token. El token se guarda **cifrado en reposo** (AES-256-GCM). Pulsar
  **Probar conexión** y **Guardar**.
- [ ] **6. Configurar el webhook**: la URL es `/api/webhooks/wa/<verify-token>`,
  donde el segmento es el valor de `META_WEBHOOK_VERIFY_TOKEN`. Al guardar, el CRM
  registra el webhook en Meta por ti (override a nivel del número). Suscribir el
  campo `messages` (y `message_template_status_update` si se usarán plantillas).
- [ ] **7. (Recomendado) Agregar `META_APP_SECRET`**: el App Secret de la app, para
  verificar la firma HMAC de cada evento entrante.
- [ ] **8. Probar**: correr el self-test / e2e de la aplicación y, después, enviar
  un **mensaje real** al número y comprobar que aparece en la bandeja en uno o dos
  segundos.
- [ ] **9. Registrar el número** en la Cloud API si aún no lo está
  (`POST /{PHONE_NUMBER_ID}/register`).

Aviso: la URL del webhook contiene el verify token como segmento secreto. Debe
tratarse como una contraseña y no publicarse ni compartirse por canales
inseguros.

## 10. Pendientes con la doctora

Lista tomada de `elidental.md`, sección «Decisiones pendientes con la doctora»:

- [ ] Confirmar que el horario publicado en 2024 sigue vigente y si hay pausa de almuerzo.
- [ ] Duración de cada tipo de cita (valoración, limpieza, resina, control, urgencia).
- [ ] Cuántos turnos de urgencia reserva por día, y en qué horas.
- [ ] Si Eli puede dar algún precio (hoy no da ninguno), por ejemplo el de la consulta de valoración.
- [ ] Seguros que acepta.
- [ ] Si atiende niños, y desde qué edad.
- [ ] Datos de un paciente nuevo (nombre y edad; ¿cédula?).
- [ ] Número que recibe los avisos de urgencias, quejas y el resumen diario.
- [ ] Hora del recordatorio (propuesta: 18:00 del día anterior) y si se envía el segundo aviso.
- [ ] Si se escribe al paciente que no llegó.
- [ ] Recordatorios de control cada 6 meses.
- [ ] Qué calendario usa, para que todo turno quede en el mismo lugar.
- [ ] Dónde corre el bot: un servidor pequeño en la nube, para cumplir el 24/7 dentro de $20 al mes.

## 11. Próximos pasos sugeridos

1. **Recordatorios de cita**: plantilla aprobada por Meta, envío el día anterior a
   las 18:00, interpretación de la respuesta del paciente (confirma, cambia) y
   resumen diario para la doctora a las 07:00.
2. **Avisos a la doctora**: notificación por urgencias, quejas y preguntas
   clínicas, al número que ella indique.
3. **Seguimiento post-tratamiento**: mensaje al día siguiente de una extracción o
   un tratamiento, con paso a la doctora si hay molestias.
4. **Recall a 6 meses**: recordatorio de limpieza a pacientes antiguos, solo a
   quien aceptó recibir mensajes.
