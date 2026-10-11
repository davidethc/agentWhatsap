# Eli Panel: Spec (aprobada)

> Espejo de Notion: «02 · Spec» y la base «Historias de usuario» del hub
> [Eli Panel — SDD Hub](https://app.notion.com/p/3f55445f5f868115ab4acac0869bd112).
> **Aprobada el 10-oct-2026** (punto de control 1). Notion manda: si cambia allí, se vuelve a copiar.
> Aquí no se habla de tecnología: solo de comportamiento.

## Visión

La doctora de EliDental abre **Eli Panel** en su computadora y en un vistazo sabe quién viene hoy, cómo
va su consultorio y quién necesita atención. Cada persona que escribe por WhatsApp aparece sola en el
panel y avanza por el embudo hasta convertirse en paciente que vuelve.

## Usuarias

| Usuaria | Qué necesita |
|---|---|
| Doctora | Ver el día, sus pacientes y las citas; marcar asistencia; registrar pacientes que llaman o llegan en persona. Uso básico de la tecnología, sobre todo desde la **computadora**. |
| Administrador | Crear la cuenta de la doctora, dar soporte y revisar que todo funcione. |

## Épicas

- **E1 Acceso**: login seguro.
- **E2 Resumen del día**: la pantalla de inicio.
- **E3 Pacientes**: kanban, ficha y Nuevo paciente. (La conversación con Eli quedó pospuesta: [ADR 0012](../adr/0012-crm-sin-contenido-de-mensajes.md).)
- **E4 Citas**: crear, editar y asistencia, sincronizadas con Google Calendar.
- **E5 Eli conectada**: Eli llena y mueve el CRM sola.
- **E6 Privacidad**: datos de salud protegidos.

## Etapas del embudo

Nuevo → Conversando → Agendó → Asistió → Seguimiento/Volver, más **Perdido** con su motivo (no
respondió, indeciso, no asistió). Basadas en el embudo de Eli ([conversacion.md](../conversacion.md)).

## Reglas aclaradas (ronda 2, 10-oct)

- **Un teléfono, varios pacientes:** cada persona es un paciente aparte con su ficha; el menor queda con
  un «responsable» y comparten teléfono y conversación.
- **Retorno:** al marcar Asistió la doctora pone «volver en» (por defecto 6 meses). El resumen muestra a
  quien le toca volver esta semana.
- **Nuevo → Conversando:** cuando la persona responde a Eli (2.º mensaje). **→ Perdido (no respondió):**
  sin cita y 24 h sin escribir. Si alguien en Perdido vuelve a escribir, regresa a Conversando.
- **Citas:** 1 h por defecto, la doctora puede cambiar la duración. Si la cita se mueve o se borra en
  Google Calendar, el CRM se actualiza (borrada = Cancelada).
- **Consentimiento:** en papel en el consultorio; la ficha registra «Consentimiento firmado» con fecha;
  los datos clínicos se llenan desde entonces.
- **Importar pacientes:** no en el MVP.
- **Colores:** paleta dental neutra (turquesa/azul suave + blanco), fácil de cambiar.

Detalle de cada decisión: Notion «03 · Clarificaciones y decisiones».

## Historias de usuario

### E1 Acceso

**HU-1 · Entrar con correo y contraseña** (Must)
Como doctora, quiero entrar con mi correo y contraseña, para que solo yo vea los datos de mis pacientes.
1. Dado que no inicié sesión, cuando abro cualquier página, entonces me lleva al login.
2. Dado un correo y contraseña correctos, cuando entro, entonces veo el Resumen del día.
3. No existe registro público: las cuentas las crea el administrador.

### E2 Resumen del día

**HU-2 · Ver las citas de hoy y marcar asistencia** (Must)
Como doctora, quiero ver al entrar quién viene hoy y marcar si asistió, para organizar mi día y saber
quién faltó.
1. Dado que hay citas hoy, cuando abro el panel, entonces las veo ordenadas por hora con paciente,
   tratamiento y estado.
2. Cuando marco Asistió, entonces el paciente pasa a Seguimiento y puedo poner «volver en» (por defecto
   6 meses; lo puedo cambiar o dejar vacío).
3. Cuando marco No asistió, entonces pasa a Perdido (no asistió).

**HU-3 · Ver los números del consultorio** (Should)
Como doctora, quiero ver cuántos pacientes nuevos, agendados e inasistencias tengo, para saber cómo va el
consultorio.
1. El resumen muestra: nuevos hoy y en la semana, citas agendadas en la semana, inasistencias en la
   semana y de qué canal llegan.
2. Los números coinciden con los datos del kanban y de las citas.

**HU-4 · Ver cumpleaños y retornos** (Could)
Como doctora, quiero ver quién cumple años y a quién le toca volver, para contactarlos si quiero.
1. El resumen lista los cumpleaños de hoy y de la semana.
2. Dado un paciente con fecha de retorno («volver en» puesto al marcar Asistió), cuando esa fecha cae
   esta semana o ya pasó y no tiene cita futura, entonces aparece en Retornos.
3. Solo se muestra: no se envían mensajes.

### E3 Pacientes

**HU-5 · Kanban de pacientes por etapa** (Must)
Como doctora, quiero ver a mis pacientes en columnas por etapa y moverlos, para saber en qué punto está
cada uno.
1. Columnas: Nuevo, Conversando, Agendó, Asistió, Seguimiento/Volver y Perdido.
2. Cuando arrastro una tarjeta, entonces cambia su etapa y queda registrado quién y cuándo.
3. Al mover a Perdido, pide el motivo (no respondió, indeciso, no asistió).
4. Puedo buscar por nombre o teléfono.

**HU-6 · Ficha del paciente** (Must)
Como doctora, quiero ver y editar la ficha de cada paciente, para tener sus datos y su historia a mano.
1. La ficha muestra datos básicos (nombre, teléfono, cédula, nacimiento, correo, responsable si lo
   tiene), datos clínicos básicos (alergias, enfermedades, embarazo, miedo), etapa, citas, fecha de
   retorno y el historial de etapas (con los motivos de Perdido).
2. Puedo editar los datos y se guarda quién cambió qué.
3. Dado que no está marcado «Consentimiento firmado», entonces los datos clínicos no se pueden llenar y
   la ficha lo avisa.
4. Si el paciente tiene responsable, la ficha enlaza a la ficha del responsable y muestra la
   conversación compartida.

**HU-7 · Leer la conversación con Eli** (⏸ **Pospuesta**, TK-41, 2026-10-11: por privacidad el CRM no guarda ni muestra el contenido de los mensajes; ver [ADR 0012](../adr/0012-crm-sin-contenido-de-mensajes.md). TK-31 en Backlog. Lo que sigue es la historia original, **no se construye ahora**.)
Como doctora, quiero leer todo lo que el paciente habló con Eli, para entender qué necesita antes de
atenderlo.
1. La ficha muestra los mensajes del paciente y de Eli en orden, con fecha y hora.
2. La conversación sigue visible aunque hayan pasado más de 24 horas.
3. Es de solo lectura: no se puede responder desde el panel.

**HU-8 · Registrar un paciente nuevo a mano** (Must)
Como doctora, quiero registrar a quien llama o llega en persona, para tener a todos mis pacientes en el
mismo lugar.
1. El botón Nuevo paciente abre un formulario con los datos de la ficha y el origen (llamada,
   presencial, referido).
2. Si el teléfono ya existe, avisa y ofrece abrir esa ficha o crear un paciente aparte con esa persona
   como responsable (p. ej. mamá e hijo).
3. El paciente nuevo aparece en Nuevo.

### E4 Citas

**HU-9 · Crear y editar citas desde el panel** (Must)
Como doctora, quiero agendar, mover y cancelar citas desde el panel, para manejar también a quienes no
escriben por WhatsApp.
1. Cuando creo una cita, entonces aparece en Google Calendar y el paciente pasa a Agendó.
2. La cita dura 1 h por defecto y puedo cambiar la duración.
3. Cuando la muevo o la cancelo, Google Calendar se actualiza.
4. No me deja agendar fuera del horario del consultorio ni encima de otra cita.

**HU-10 · Ver las citas creadas por Eli o en el calendario** (Must)
Como doctora, quiero que las citas que agenda Eli o que yo pongo en Google Calendar aparezcan en el
panel, para tener una sola agenda.
1. Cuando Eli reserva, la cita aparece en el panel ligada al paciente.
2. Cuando la doctora mueve una cita en Google Calendar, el panel muestra la nueva hora en pocos minutos.
3. Cuando la borra en Google Calendar, la cita queda Cancelada en el panel.

### E5 Eli conectada

**HU-11 · Eli crea al paciente y registra los mensajes** (Must)
Como doctora, quiero que quien escribe por WhatsApp aparezca solo en el panel, para no registrar nada a
mano.
1. Dado un número nuevo, cuando escribe, entonces aparece un paciente en Nuevo y queda registrado que escribió (sin guardar el contenido del mensaje).
2. Cuando responde a Eli (su 2.º mensaje), pasa a Conversando.
3. Si no tiene cita y lleva 24 h sin escribir, pasa a Perdido (no respondió).
4. Si está en Perdido y vuelve a escribir, regresa a Conversando con su historial.
5. Si el mismo mensaje llega dos veces, no se duplica.

**HU-12 · Eli mueve al paciente al agendar, mover o cancelar** (Must)
Como doctora, quiero que el panel se actualice cuando Eli agenda, mueve o cancela, para ver la realidad
sin hacer nada.
1. Cuando Eli reserva, el paciente pasa a Agendó con la cita.
2. Cuando Eli mueve o cancela, la cita se actualiza en el panel.

**HU-13 · Eli sigue funcionando si el panel falla** (Must)
Como doctora, quiero que Eli siga atendiendo aunque el panel tenga problemas, para no perder pacientes.
1. Dado que el panel o su base no responden, cuando un paciente escribe, entonces Eli responde con
   normalidad.
2. El error queda registrado para revisarlo.

### E6 Privacidad

**HU-14 · Datos de salud protegidos** (Must)
Como doctora, quiero que los datos clínicos de mis pacientes estén protegidos, para cumplir la ley y
cuidar su confianza.
1. Sin login no se ve ningún dato.
2. Queda registro de quién cambió qué y cuándo.
3. La doctora marca «Consentimiento firmado» con su fecha cuando el paciente firma en papel en el
   consultorio; sin eso no se guardan datos clínicos.
4. En pruebas y en los documentos solo hay datos inventados.

## Fuera del MVP (versión 2)

- Responder WhatsApp desde el panel (inbox embebido de Kapso) y «Pausar a Eli».
- Mensajes automáticos: recordatorios de cita, cumpleaños, retornos.
- Varias clínicas, roles y recepcionista.
- Reportes avanzados y app móvil.
- Importar pacientes desde Excel/CSV.
