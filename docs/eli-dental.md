# Eli: asistente de EliDental

Diseño conversacional y técnico de Eli, la asistente por WhatsApp de **EliDental** (Loja, Ecuador).
Se basa en la encuesta a la doctora, en sus páginas públicas y en cómo se agenda en Latinoamérica.

**Estado (2026-10-10):** `version4` está en producción como Eli, con los datos públicos de EliDental y
**conversación natural, sin botones ni formularios**: el paciente escribe como quiere y Eli lo lleva a
una cita. La lógica de cada tipo de mensaje y de la agenda está en
[conversacion-natural.md](conversacion-natural.md). Falta construir: los seguimientos por tiempo, el
aviso a la doctora y los **recordatorios de cita** ([embudo-elidental.md](embudo-elidental.md)).

## 0. EliDental

Datos tomados el 2026-10-07 de su [Facebook](https://www.facebook.com/EliDentalec) y de su
[Instagram](https://www.instagram.com/elidentalec/) (biografía y las 64 publicaciones). Las publicaciones
anteriores a septiembre de 2024 tienen la dirección antigua (Mercadillo y Av. Universitaria).

| Dato | Valor | Fuente |
|---|---|---|
| Nombre | EliDental, «Odontología integral para toda la familia» | Facebook |
| Odontóloga | Dra. Viviana Elizabeth Sucunuta (@viviana_sucunuta), Universidad de Cuenca, posgradista en ortodoncia (Brasil) | Instagram |
| Dirección | Av. Manuel Agustín Aguirre 343-39, entre Miguel Riofrío y Azuay, Loja | Facebook |
| WhatsApp y celular | 099 970 1778 | Facebook |
| Correo | elidentalec@hotmail.com | Facebook |
| Fundación | 30 de abril de 2021 | Facebook |
| Servicios publicados | Limpieza (profilaxis con ultrasonido), resinas y cambio de amalgamas, ortodoncia, blanqueamiento, carillas, endodoncia, extracciones y muelas del juicio, prótesis total y fija (coronas, puentes), frenectomía; atención a niños y embarazadas; sedación para pacientes con miedo | Publicaciones de Instagram y Facebook |
| Servicios que agenda Eli | Consulta de valoración, Limpieza dental, Resina (calza), Control de ortodoncia, Urgencia dental | Definido para el bot |
| Precios | No publicados (rango «$$»; solo promociones antiguas, como 20 % en limpieza para parejas). Eli no da cifras: el valor lo confirma la doctora en la consulta | Facebook, Instagram |
| Horario | Lunes a viernes de 09:00 a 18:00, sábado de 09:00 a 15:00, domingo cerrado | Instagram, publicación de la mudanza (21/9/2024) |

> El recorrido completo del paciente, por etapas y con los mensajes reales, está en
> [embudo-elidental.md](embudo-elidental.md).

## 1. Lo que pide la doctora

Encuesta del 17/9/2026 (una respuesta):

| Tema | Respuesta |
|---|---|
| Volumen | 80 a 200 pacientes activos, 10 a 25 citas por semana |
| Cómo agenda hoy | Llamada, WhatsApp, en persona, redes sociales y agenda en papel |
| Problemas | Coordinar cada cita le quita tiempo; los pacientes olvidan sus citas sin avisar; le escriben fuera de horario |
| Lo más importante | **Agendar sin intervenir** y **recordatorios automáticos** |
| Disponibilidad | 24 horas, 7 días; tolera caídas breves |
| Canales | WhatsApp, llamada, Messenger, Instagram |
| Tecnología | Uso básico (WhatsApp, redes, correo) |
| Presupuesto | Hasta $20 al mes; $100 a $300 de implementación |

Consecuencias de diseño:
- Los recordatorios no son opcionales: son la mitad del valor.
- 24/7 exige un servidor siempre encendido, no un computador personal.
- Cada mensaje de Meta cuesta (ver [Costos](#8-costos)), así que hay que cuidar el presupuesto de $20.
- Ella no va a usar n8n: todo lo que necesite saber le llega por WhatsApp.

## 2. Cómo se agenda en Latinoamérica

- El paciente escribe por WhatsApp y una recepcionista responde a mano. El problema principal no es
  agendar, sino que el paciente no llegue.
- Blogs de software dental hablan de un 15 % a 30 % de inasistencia, sin citar un estudio
  ([Dentalink](https://www.softwaredentalink.com/blog/como-disminuir-el-ausentismo-de-pacientes-en-una-clinica-dental)).
  Una revisión sistemática citada por
  [VioletWave](https://www.violetwaveai.com/blog/chatbot-whatsapp-turnos-odontologia) (McLean et al.,
  2016) encontró que los recordatorios mejoran la asistencia en torno a un 34 %.
- Buenas prácticas de recepción que Eli debe copiar: preguntar primero si es urgencia; en la primera
  visita, pedir llegar 10 minutos antes para la historia clínica
  ([Leadsales](https://leadsales.io/blog/whatsapp-para-consultorios-y-clinicas/)); confirmar con día,
  hora, profesional y dirección ([Medesk](https://www.medesk.net/es/blog/plantillas-de-comunicacion-para-clinicas/));
  recordar la cita el día anterior y pedir que confirme respondiendo; derivar a la doctora urgencias,
  necesidades especiales y reclamos.
- Por WhatsApp solo se envía logística, nunca diagnósticos
  ([Gestión Dental](https://gestiondental.org/whatsapp-confirmar-citas-dentales-ventajas-limites-buenas-practicas/)).

## 3. Conversación natural (sin botones)

Decisión del 2026-10-10 ([ADR 0006](adr/0006-conversacion-natural.md)): **no hay botones ni
formularios**. El paciente escribe «hola», «quiero info», «necesito agendar», «¿cómo está?» o lo que sea,
y Eli lo entiende con la IA, responde como una persona del consultorio y lo lleva a una cita.

- **Qué responde a cada tipo de mensaje** (saludo, información, precio, agendar, urgencia, temas
  clínicos, su cita, «¿eres un bot?», groserías, audios) y **cómo busca horarios** (libre, ocupado, día
  lleno, domingo): [conversacion-natural.md](conversacion-natural.md).
- **El recorrido completo, con seguimientos y recordatorios:** [embudo-elidental.md](embudo-elidental.md).

Los recordatorios, cuando se construyan, también serán texto: el paciente responde «sí», «ahí estaré» o
«no puedo», y la IA lo interpreta con el contexto de esa cita.

## 4. Quién responde cada tipo de mensaje

| Tipo de mensaje | Ejemplos | Responde | Qué hace |
|---|---|---|---|
| Saludo o charla | «hola», «buenas tardes», «¿cómo está?» | IA | Responde el saludo como persona y pregunta en qué ayuda |
| Información general | «quiero información», «¿qué hacen?» | IA | Resume EliDental y pregunta qué le gustaría atender |
| Precio, horario, ubicación | «cuánto cuesta una limpieza», «dónde quedan» | IA | Responde el dato (el precio lo confirma la doctora) y ofrece 2 turnos |
| Agendar | «necesito agendar», «quiero una limpieza el jueves» | IA + agenda | Pregunta el motivo si falta y ofrece turnos reales; si está ocupado, alternativas cercanas |
| Urgencia | «me duele mucho una muela», «se me rompió un diente» | IA + agenda | Empatía, primer turno libre e indicación de emergencias |
| Ver, mover o cancelar | «no voy a poder ir mañana» | IA + agenda | Busca su cita y ofrece reagendar antes de cancelar |
| Respuesta al recordatorio (🔧) | «sí», «ahí estaré», «no puedo» | IA con contexto | Confirma, o busca otro turno y libera el anterior |
| Pregunta clínica, foto o queja | «¿es normal que sangre?», imagen | Doctora | No opina de salud: WhatsApp 099 970 1778 |
| «¿Eres un bot?» | «¿hablo con una persona?» | IA | Con honestidad: es la asistente virtual; la doctora atiende en persona |
| Groserías o spam | insultos, mensajes sin sentido | IA | Una respuesta breve y respetuosa; si sigue, no discute |
| Audio o sticker | nota de voz | IA | Pide que lo escriba |
| Cita para otra persona | «cita para mi hijo de 6 años» | IA | Pide nombre y edad del paciente y el nombre del adulto responsable |

## 5. Reglas fijas

**Urgencia.** Disparadores: dolor fuerte, «me duele mucho», hinchado, sangra, se rompió, se cayó
(diente o corona), golpe, fiebre, pus. Eli responde:

> Lamento que esté con molestias. El primer turno libre es [día y hora], ¿se lo reservo? Si tiene la
> cara muy hinchada, fiebre alta o le cuesta tragar o respirar, acuda a emergencias ahora.

🔧 Por construir: que la doctora reciba además un aviso por WhatsApp, aunque sea fuera de horario.

**Tipo de cita según el motivo.**

| Motivo | Turno |
|---|---|
| Dolor, golpe, algo roto | Urgencia (el primero libre) |
| Limpieza o control | Normal |
| Tratamiento nuevo (brackets, implantes, blanqueamiento, coronas) | Consulta de valoración primero |
| Control de un tratamiento en curso | Normal, con el motivo anotado |
| No sabe o «revisión» | Consulta de valoración |

**Primera vez:** nombre completo, edad y motivo. Al confirmar: «Llega 10 minutos antes para llenar tu
historia clínica».

**Precios:** solo los fijos que apruebe la doctora. Nunca se inventa un precio.

**Privacidad:** los mensajes automáticos solo llevan día, hora y lugar.

**Fuera de horario:** se agenda igual. Lo que necesita a la doctora se responde con «La doctora te
responderá a partir de las [hora]».

## 6. Recordatorios

### Plantilla (Meta, categoría UTILITY, idioma `es`)

Nombre propuesto: `recordatorio_cita`

```
Hola {{nombre}}, le recordamos su cita en EliDental mañana {{dia}} a las {{hora}}
(Av. Manuel Agustín Aguirre 343-39). ¿Nos confirma su asistencia?
Si necesita cambiarla, respóndame por aquí.
```

- **Solo texto, sin botones.** El paciente responde con sus palabras y la IA lo interpreta con el
  contexto guardado en Redis (`v4:reminder:<teléfono>`).
- La plantilla se crea en Kapso o en Meta y **debe aprobarla Meta** antes de usarse. Solo lleva
  logística, para que la clasifiquen como UTILITY y no como MARKETING.
- Se envía con el nodo Kapso, operación **Send Template**
  ([documentación de Kapso](https://docs.kapso.ai/docs/whatsapp/n8n)).

### Datos que necesita cada cita

El evento de Google Calendar es la fuente de verdad. `version4` ya escribe en la descripción:

```
Paciente: <nombre>
Tel: <teléfono>
Servicio: <servicio> ($<precio>)
```

Se agregan dos líneas que el recordatorio actualiza:

```
Recordatorio: enviado 2026-10-07 18:00
Estado: pendiente | confirmada | cambio pedido
```

Las citas que la doctora crea a mano **deben llevar la línea `Tel:`**; si no la tienen, no reciben
recordatorio y aparecen como «sin teléfono» en el resumen.

### Estado en Redis (DB 1)

| Clave | Valor | Duración | Uso |
|---|---|---|---|
| `v4:reminder:sent:<eventId>` | `1` | 3 días | No enviar dos veces el mismo recordatorio |
| `v4:reminder:<teléfono>` | `<eventId>` | 36 h | Si el paciente responde con texto («sí», «no puedo»), saber a qué cita se refiere |
| `v4:handoff:<teléfono>` | `1` | lo decide la doctora | El bot no responde mientras la doctora atiende |

### Cuándo y a quién

| Momento | Acción |
|---|---|
| Al confirmar una cita nueva | «Te enviaremos un recordatorio por WhatsApp el día anterior» (consentimiento) |
| Día anterior, 18:00 | Plantilla a cada cita de mañana con teléfono y sin recordatorio enviado |
| Responde que asistirá («sí», «ahí estaré») | `Estado: confirmada`, evento en verde, «¡Gracias! Le esperamos mañana a las [hora]» |
| Responde que no puede o quiere cambiar | `Estado: cambio pedido`; Eli ofrece 2 turnos cercanos; al reservar el nuevo, borra el anterior |
| Respuesta ambigua | La IA la interpreta con el contexto de `v4:reminder:<teléfono>` y pregunta si hace falta |
| Mismo día, 07:00 | Resumen a la doctora: confirmadas, sin respuesta, cambios pedidos y citas sin teléfono |
| Opcional, 2 h antes | Segundo aviso solo a las que siguen sin confirmar (cuesta otro mensaje) |

### Construcción en n8n

1. **Contexto para la IA:** cuando llega un mensaje y existe `v4:reminder:<teléfono>`, *Preparar turno*
   agrega al texto «(el paciente responde al recordatorio de su cita del [día] a las [hora])».
2. **Prompt:** una sección *RESPUESTA AL RECORDATORIO* con qué hacer si confirma, si no puede o si es
   ambiguo, usando `buscar_mis_citas` y `mover_cita`.
3. **Workflow nuevo `Eli · Recordatorios`:** *Schedule Trigger* (18:00) → *Google Calendar: Get Many*
   (mañana) → *Code*: extraer `Tel:` y filtrar → *Redis*: ¿ya enviado? → *Kapso: Send Template* →
   *Google Calendar: Update* (descripción) → *Redis*: marcar enviado.
4. **Resumen de la mañana:** *Schedule Trigger* (07:00) → citas de hoy → *Code*: agrupar por estado →
   *Kapso: Send Text* al número de la doctora. Este mensaje cae fuera de la ventana de 24 h si ella no
   escribió al bot, así que necesita su propia plantilla UTILITY.
5. Probar con un evento en un calendario de prueba y con el número propio, nunca con pacientes reales.

## 7. Qué pasa si…

| Si el paciente… | Eli… |
|---|---|
| No responde al recordatorio | Queda «sin respuesta» en el resumen de la doctora; opcional, segundo aviso 2 h antes |
| Cancela el mismo día | Libera el turno y ofrece reagendar |
| No llega a la cita | Al día siguiente, «Te esperamos ayer, ¿reagendamos?», solo si la doctora lo aprueba |
| Tiene una urgencia y no hay turnos hoy | Avisa a la doctora para que decida si lo atiende fuera de agenda, y da la indicación de emergencias |
| Tiene una urgencia a las 2 de la mañana | Mensaje fijo de urgencia, indicación de emergencias y aviso a la doctora |
| Elige el mismo turno que otro paciente al mismo tiempo | Un lock de Redis por turno (`v4:slot:<fecha>T<hora>`, 60 s) reserva solo el primero; el segundo recibe otras opciones |
| Agenda para un menor | Pide el nombre del adulto responsable y la edad |
| Pidió urgencia y luego dice «ya no me duele» | Ofrece cambiarla a un turno normal |
| Insiste en un diagnóstico | No diagnostica; ofrece consulta o aviso a la doctora |
| Escribe por Instagram o Messenger | Fuera del alcance de Kapso: esas redes responden con un enlace al WhatsApp |
| Pide un turno que la doctora dio por teléfono | Si no está en el mismo calendario, el bot podría darlo: todo turno va al mismo calendario |
| Escribe cuando la IA o el servidor fallan | «Escríbeme en unos minutos» y aviso a la doctora; la regla de urgencia no depende de la IA |
| Envía un diagnóstico de otro médico | No lo repite; queda solo para la doctora |

## 8. Costos

Desde el **1 de octubre de 2026**, Meta cobra por mensaje: las plantillas (marketing, utility) y también
las respuestas de servicio y utility dentro de la ventana de 24 horas
([precios de Meta](https://developers.facebook.com/docs/whatsapp/pricing)).
La tarifa depende del país del destinatario: consulta la tabla vigente para Ecuador antes de cotizar.

Volumen esperado con 10 a 25 citas por semana: unos 40 a 100 recordatorios al mes, más el resumen
diario a la doctora (unos 30) y las respuestas de cada conversación. Con el presupuesto de $20 al mes,
el segundo aviso de 2 horas antes y los mensajes de «no llegaste» solo se activan si los números
cierran.

## 9. Decisiones pendientes con la doctora

- [ ] Confirmar que el horario publicado en 2024 sigue vigente y si hay pausa de almuerzo
- [ ] Duración de cada tipo de cita (valoración, limpieza, resina, control, urgencia)
- [ ] Cuántos turnos de urgencia reserva por día, y en qué horas
- [ ] Si Eli puede dar algún precio (hoy no da ninguno), por ejemplo el de la consulta de valoración
- [ ] Seguros que acepta
- [ ] Si atiende niños, y desde qué edad
- [ ] Datos de un paciente nuevo (nombre y edad; ¿cédula?)
- [ ] Número que recibe los avisos de urgencias, quejas y el resumen diario
- [ ] Hora del recordatorio (propuesta: 18:00 del día anterior) y si se envía el segundo aviso
- [ ] Si se escribe al paciente que no llegó
- [ ] Recordatorios de control cada 6 meses
- [ ] Qué calendario usa, para que todo turno quede en el mismo lugar
- [ ] Dónde corre el bot: un servidor pequeño en la nube, para cumplir el 24/7 dentro de $20 al mes

## Fuentes

- [Dentalink: WhatsApp para clínicas dentales](https://www.softwaredentalink.com/blog/whatsapp-clinicas-dentales)
- [Dentalink: reducir el ausentismo](https://www.softwaredentalink.com/blog/como-disminuir-el-ausentismo-de-pacientes-en-una-clinica-dental)
- [VioletWave: chatbot de WhatsApp para turnos dentales](https://www.violetwaveai.com/blog/chatbot-whatsapp-turnos-odontologia)
- [Gestión Dental: ventajas y límites de WhatsApp](https://gestiondental.org/whatsapp-confirmar-citas-dentales-ventajas-limites-buenas-practicas/)
- [Leadsales: WhatsApp para consultorios](https://leadsales.io/blog/whatsapp-para-consultorios-y-clinicas/)
- [Medesk: plantillas de comunicación](https://www.medesk.net/es/blog/plantillas-de-comunicacion-para-clinicas/)
- [Kapso: n8n](https://docs.kapso.ai/docs/whatsapp/n8n)
