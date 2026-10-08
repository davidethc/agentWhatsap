# Reunión de venta: EliDental

- **Con:** Dra. Viviana Elizabeth Sucunuta, EliDental (Loja)
- **Fecha:** viernes 9 de octubre de 2026
- **Objetivo:** que pruebe a Eli en su propio teléfono, tener respondidas las preguntas de esta guía y
  salir con un **piloto de 30 días acordado**, con fecha de inicio.

Datos de partida: su [encuesta](../eli-dental.md#1-lo-que-pide-la-doctora), su Facebook y su Instagram
(revisados el 2026-10-07).

---

## 1. Antes de la reunión (obligatorio)

- [ ] **Resolver la cuota de Gemini.** El plan gratuito permite 20 peticiones al día y se agotó el 7
  de octubre. Activa la facturación en Google AI Studio, o la demo fallará delante de ella.
- [ ] El Mac, Docker y ngrok encendidos durante la reunión: `scripts/check.sh` todo OK.
- [ ] Ensayar la demo completa (sección 3) desde un teléfono que no sea el tuyo.
- [ ] Borrar las citas de prueba del calendario y vaciar la memoria del chat, para empezar limpio.
- [ ] Llevar impresa o en la tablet la tabla de la sección 6 (qué incluye y cuánto cuesta).
- [ ] Llevar dos ejemplos de conversación en capturas, por si falla internet.

---

## 2. El gancho (primeros 3 minutos)

No empieces hablando de tecnología. Empieza con **sus propias palabras** de la encuesta:

> «Doctora, en la encuesta me dijo tres cosas: que coordinar cada cita le quita mucho tiempo, que los
> pacientes se olvidan y no avisan, y que le escriben fuera de horario y no alcanza a responder. Traje
> algo que resuelve las tres.»

Datos suyos que refuerzan el mensaje:

- **49 de sus 64 publicaciones de Instagram terminan con «AGENDA TU CITA 📲 0999701778».** Todo su
  marketing lleva al WhatsApp que ella contesta a mano. Cada publicación que funciona le da *más*
  trabajo de coordinación.
- Tiene de **10 a 25 citas por semana**: cada una son varios mensajes de ida y vuelta.
- Quiere atención **24/7**: Eli responde a las 11 de la noche, cuando ella está descansando.
- Ofrece sedación a pacientes con miedo, atiende niños y embarazadas: Eli ya lo sabe y lo menciona.

Frase de cierre del gancho:

> «Eli no reemplaza su trato con el paciente: le quita lo repetitivo, para que usted solo atienda lo
> que necesita a la doctora.»

---

## 3. Demo en vivo (5 minutos, en el teléfono de ella)

Pídele que escriba ella misma al número del bot:

1. `Hola` → Eli se presenta como asistente de EliDental.
2. `Cuánto cuesta una limpieza?` → no inventa precios: ofrece una valoración.
3. `Quiero una limpieza el viernes a las 10` → muestra turnos libres reales y pide confirmar.
4. `Sí` → **la cita aparece en Google Calendar mientras ella mira.** Este es el momento clave.
5. `Me duele mucho una muela` → trato de urgencia e indicación de emergencias.
6. `Me da miedo el dentista` → menciona la sedación.
7. `¿Puedo tomar ibuprofeno?` → no da consejos médicos.

Mientras ella escribe, **calla y deja que la demo hable**.

---

## 4. Preguntas para la doctora

Marca cada respuesta. Las que tienen ⭐ son imprescindibles para poder cerrar.

### 4.1 Su día a día (abre la conversación)

- [ ] ⭐ ¿Quién contesta hoy el WhatsApp: usted, una asistente, un familiar?
- [ ] ⭐ ¿Cuántos mensajes recibe en un día normal? ¿Cuántos son solo para preguntar precios u horarios?
- [ ] ¿Cuánto tiempo al día le dedica a responder y coordinar citas?
- [ ] ¿Qué es lo que más le molesta de agendar por WhatsApp?
- [ ] ¿Ha perdido pacientes porque no alcanzó a responder a tiempo?
- [ ] ¿Qué le preguntan los pacientes una y otra vez?

### 4.2 Agenda y horario

- [ ] ⭐ ¿El horario de Instagram (lunes a viernes de 9:00 a 18:00, sábado de 9:00 a 15:00) sigue vigente? ¿Cierra al mediodía?
- [ ] ⭐ ¿Dónde lleva hoy la agenda: papel, Google Calendar, un programa? ¿La quiere en Google Calendar?
- [ ] ⭐ ¿Cuánto dura cada tipo de cita? (valoración, limpieza, resina, control de ortodoncia, endodoncia, extracción)
- [ ] ¿Hay citas que no deban agendarse por el bot (cirugías, tratamientos largos)?
- [ ] ¿Cuántas citas como máximo atiende por día?
- [ ] ¿Deja espacios libres para urgencias? ¿Cuántos y a qué hora?
- [ ] ¿Con cuánta anticipación mínima se puede agendar? ¿Atiende el mismo día?
- [ ] ¿Trabaja con alguien más (asistente, otro odontólogo, el colaborador que aparece en sus publicaciones)? ¿Comparten agenda?
- [ ] ¿Feriados y vacaciones: cómo quiere bloquearlos?

### 4.3 Servicios, precios y promociones

- [ ] ⭐ ¿Quiere que Eli diga precios? ¿Cuáles? (por ejemplo, el valor de la consulta de valoración o de la limpieza)
- [ ] ⭐ ¿Qué tratamientos requieren valoración antes de dar precio?
- [ ] ¿Cobra la consulta de valoración? ¿Se descuenta si hace el tratamiento?
- [ ] ¿Qué formas de pago acepta (efectivo, transferencia, tarjeta)? ¿Planes de pago para ortodoncia?
- [ ] ¿Trabaja con algún seguro o convenio (IESS, empresas, universidades)?
- [ ] ¿Hace promociones? (en Instagram tuvo 20 % en limpieza para parejas y descuentos navideños) ¿Quiere que Eli las anuncie?
- [ ] ¿Hay algún servicio que quiera impulsar (ortodoncia, blanqueamiento, prótesis)?

### 4.4 Pacientes especiales

- [ ] ¿Desde qué edad atiende niños? ¿Qué datos pide del adulto responsable?
- [ ] Embarazadas: ¿algo que Eli deba preguntar o advertir?
- [ ] Sedación: ¿qué debe decir Eli exactamente? ¿Tiene costo adicional?
- [ ] Pacientes de ortodoncia: ¿controles cada cuánto? ¿Quiere que Eli los agende automáticamente?
- [ ] ¿Pacientes mayores que prefieren llamar? ¿Les damos el número del consultorio?

### 4.5 Urgencias y temas clínicos

- [ ] ⭐ ¿Qué considera urgencia? ¿Atiende urgencias fuera de horario?
- [ ] ⭐ ¿A qué número le avisamos cuando hay una urgencia o una queja?
- [ ] ¿Qué debe responder Eli si preguntan «¿es normal que…?» después de un tratamiento?
- [ ] ¿Quiere recibir las fotos que envían los pacientes? ¿Por dónde?

### 4.6 Recordatorios y pacientes que no llegan

- [ ] ⭐ ¿Cuántos pacientes faltan a la semana sin avisar?
- [ ] ⭐ ¿Quiere recordatorio el día anterior? ¿A qué hora? ¿También unas horas antes?
- [ ] ¿Qué hacemos con quien no confirma: lo llama usted, se libera el turno?
- [ ] ¿Quiere un resumen cada mañana con las citas del día y quién confirmó?
- [ ] ¿Quiere recordatorios de limpieza cada 6 meses a pacientes antiguos?
- [ ] ¿Quiere un mensaje de seguimiento después de una extracción o un tratamiento?

### 4.7 Tono y marca

- [ ] ¿Tutear o tratar de usted a los pacientes?
- [ ] ¿Le gusta el nombre «Eli»? ¿Prefiere otro?
- [ ] ¿Emojis sí o no?
- [ ] ¿Hay frases o palabras que use siempre con sus pacientes?

### 4.8 Parte técnica

- [ ] ⭐ **¿Su número 099 970 1778 está en WhatsApp Business o en WhatsApp normal?**
  - En **WhatsApp Business**: se puede conectar en modo *coexistencia*. Ella sigue usando la app en su
    celular y Eli responde al mismo tiempo, en el mismo número. Es lo más cómodo, pero es menos estable
    que un número dedicado ([Kapso](https://docs.kapso.ai/docs/how-to/whatsapp/coexistence-troubleshooting)).
  - En **WhatsApp normal**: primero hay que pasarlo a WhatsApp Business (conserva los chats), o usar un
    número nuevo solo para el bot.
- [ ] ⭐ ¿Tiene una página de Facebook administrada por ella y acceso a **Meta Business Suite**? Hace
  falta para conectar el número.
- [ ] ¿Tiene una cuenta de Google (Gmail) para la agenda?
- [ ] ¿Quién del consultorio va a revisar la agenda y las conversaciones?
- [ ] ¿Cómo quiere que le avisemos de las urgencias: WhatsApp, llamada o correo?
- [ ] ¿Quiere ver las conversaciones del bot? (bandeja de Kapso)

### 4.9 Privacidad y datos

- [ ] ¿Está de acuerdo con que el primer mensaje informe que la conversación se usa para gestionar citas?
- [ ] ¿Qué datos del paciente quiere guardar (nombre, cédula, edad)?
- [ ] ¿Cuánto tiempo guardamos las conversaciones?

### 4.10 Decisión y dinero (al final)

- [ ] ⭐ ¿Quién toma la decisión? ¿Hay alguien más con quien deba consultarlo?
- [ ] ⭐ ¿Qué tendría que pasar en un mes para decir «esto valió la pena»?
- [ ] ⭐ En la encuesta habló de **$100 a $300** de implementación y **hasta $20 al mes**: ¿sigue siendo así?
- [ ] ¿Prefiere pagar mensual, trimestral o anual?
- [ ] ¿Factura? ¿Necesita factura electrónica?
- [ ] ¿Cuándo le gustaría empezar?

---

## 5. Objeciones y cómo responderlas

| Ella dice | Respuesta |
|---|---|
| «¿Y si el bot responde algo mal?» | Eli no inventa precios ni horarios, no da consejos médicos y deriva a usted lo delicado. Durante el piloto revisamos juntos las conversaciones cada semana. |
| «Mis pacientes prefieren hablar conmigo» | Usted sigue disponible en el mismo número (coexistencia). Eli contesta lo repetitivo y fuera de horario. |
| «Me da miedo perder mi número o mis chats» | Con coexistencia no se pierde el número ni la app. Si no la convence, se desconecta. |
| «Es caro» | Pregúntele cuánto vale una consulta: si los recordatorios le recuperan una o dos citas perdidas al mes, el sistema probablemente se paga solo. Por eso empezamos con un piloto. |
| «No sé usar tecnología» | Usted no tiene que usar nada nuevo: las citas aparecen en su calendario y los avisos le llegan por WhatsApp. |
| «¿Qué pasa si se cae?» | Si falla la IA, Eli le pide al paciente escribir al 099 970 1778. Si se cae el servidor, el bot no responde, pero usted sigue viendo los mensajes en su app (coexistencia). En el piloto lo movemos a un servidor 24/7 con revisión diaria. |
| «Lo pienso» | ¿Qué le haría falta para decidirse? Le propongo empezar el piloto el lunes, sin permanencia. |

---

## 6. Propuesta comercial (borrador)

Ajusta los montos **después** de las preguntas 4.10. Antes de la reunión, revisa las tarifas vigentes
de Kapso, de la API de Gemini, de Meta (por mensaje en Ecuador) y del servidor.

| | Qué incluye | Precio sugerido |
|---|---|---|
| **Implementación** (pago único) | Configuración con sus servicios, horario y tono; conexión del número y la agenda; recordatorios; capacitación de 30 minutos | $150 a $250 (dentro de su rango de $100 a $300) |
| **Piloto** (primer mes) | Todo funcionando, revisión semanal de conversaciones y ajustes | Incluido en la implementación |
| **Mensualidad** | Servidor 24/7, mantenimiento, ajustes de horario y promociones, soporte por WhatsApp | $20 |
| **Costos de terceros** | Mensajes de Meta (sobre todo recordatorios) y uso de la IA | Al costo, o incluidos hasta un volumen acordado |

Cuidado con el margen: con $20 al mes hay que cubrir el servidor, la IA y los mensajes de Meta. Desde
el 1 de octubre de 2026, Meta cobra cada mensaje
([detalle](../eli-dental.md#8-costos)). Con 10 a 25 citas por semana son unos 40 a 100 recordatorios
al mes. Si no cierra, ofrece los costos de Meta e IA aparte, o un plan de $25 a $30 con recordatorios
incluidos.

**Sé honesto con lo que ya existe y lo que falta:**

| Ya funciona | Se entrega en el piloto |
|---|---|
| Responder 24/7, agendar, mover y cancelar en Google Calendar | Recordatorios con botón «Confirmo» / «Necesito cambiar» |
| Urgencias, preguntas clínicas, sedación, niños | Aviso a la doctora por urgencias y quejas |
| Datos reales de EliDental (dirección, horario, tratamientos) | Resumen diario de citas |
| | Servidor 24/7 (hoy corre en un computador) |

---

## 7. Cierre

1. Resume en una frase lo que ella dijo que le duele, y cómo Eli lo resuelve.
2. Propón: **«Empezamos el piloto el lunes. Usted me da tres cosas y yo me encargo del resto.»**
3. Lo que necesitas de ella para empezar:
   - [ ] Acceso a su Facebook o Meta Business Suite (para conectar el número)
   - [ ] La cuenta de Google donde quiere la agenda
   - [ ] Duración de cada tipo de cita y los precios que se pueden decir
   - [ ] El número que recibe los avisos
   - [ ] El pago de la implementación (o el 50 % para empezar)
4. Acuerda la fecha de la primera revisión semanal.
5. Al día siguiente, envíale por WhatsApp un resumen de lo acordado.

## 8. Después de la reunión

- [ ] Pasar sus respuestas a [docs/eli-dental.md](../eli-dental.md) (decisiones pendientes).
- [ ] Actualizar el prompt y `Validar pedido` (horario, duraciones, precios).
- [ ] Planificar los recordatorios y el servidor 24/7.
