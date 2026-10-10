# Eli: asistente de EliDental

Datos del cliente, lo que pidió la doctora y diseño técnico de los recordatorios de Eli, la asistente
por WhatsApp de **EliDental** (Loja, Ecuador).

**Estado (2026-10-10):** `version4` está en producción como Eli, con los datos públicos de EliDental y
**conversación natural, sin botones ni formularios** ([ADR 0006](adr/0006-conversacion-natural.md)).
Qué responde Eli, cómo agenda, el embudo por etapas y las reglas de WhatsApp están en
[conversacion.md](conversacion.md). Falta construir: los seguimientos por tiempo, el aviso a la doctora
y los recordatorios de cita.

## EliDental

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

## Lo que pide la doctora

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
- Cada mensaje de Meta cuesta (ver [Costos](#costos)), así que hay que cuidar el presupuesto de $20.
- Ella no va a usar n8n: todo lo que necesite saber le llega por WhatsApp.

## Cómo se agenda en Latinoamérica

- El paciente escribe por WhatsApp y una recepcionista responde a mano. El problema principal no es
  agendar, sino que el paciente no llegue.
- Blogs de software dental hablan de un 15 % a 30 % de inasistencia, sin citar un estudio
  ([Dentalink](https://www.softwaredentalink.com/blog/como-disminuir-el-ausentismo-de-pacientes-en-una-clinica-dental)).
  Una revisión sistemática citada por
  [VioletWave](https://www.violetwaveai.com/blog/chatbot-whatsapp-turnos-odontologia) (McLean et al.,
  2016) encontró que los recordatorios mejoran la asistencia en torno a un 34 %.
- Buenas prácticas de recepción que Eli copia: preguntar primero si es urgencia; en la primera
  visita, pedir llegar 10 minutos antes para la historia clínica
  ([Leadsales](https://leadsales.io/blog/whatsapp-para-consultorios-y-clinicas/)); confirmar con día,
  hora, profesional y dirección ([Medesk](https://www.medesk.net/es/blog/plantillas-de-comunicacion-para-clinicas/));
  recordar la cita el día anterior y pedir que confirme respondiendo; derivar a la doctora urgencias,
  necesidades especiales y reclamos.
- Por WhatsApp solo se envía logística, nunca diagnósticos
  ([Gestión Dental](https://gestiondental.org/whatsapp-confirmar-citas-dentales-ventajas-limites-buenas-practicas/)).

## Reglas del consultorio

Cómo las aplica Eli en cada mensaje está en [conversacion.md](conversacion.md).

**Tipo de cita según el motivo:**

| Motivo | Turno |
|---|---|
| Dolor, golpe, algo roto | Urgencia (el primero libre) |
| Limpieza o control | Normal |
| Tratamiento nuevo (brackets, implantes, blanqueamiento, coronas) | Consulta de valoración primero |
| Control de un tratamiento en curso | Normal, con el motivo anotado |
| No sabe o «revisión» | Consulta de valoración |

- **Primera vez:** nombre completo, edad y motivo; llegar 10 minutos antes para la historia clínica.
- **Precios:** solo los fijos que apruebe la doctora. Nunca se inventa un precio.
- **Privacidad:** los mensajes automáticos solo llevan día, hora y lugar.
- **Un solo calendario:** todo turno, también los que la doctora da por teléfono, va al mismo Google
  Calendar; si no, el bot puede ofrecer un turno ya ocupado.
- **Urgencia sin turnos hoy:** la doctora decide si atiende fuera de agenda.
- **Instagram y Messenger:** fuera del alcance de Kapso; esas redes responden con un enlace al WhatsApp.

## Recordatorios

Diseño técnico. Cómo responde Eli al paciente que contesta un recordatorio está en
[conversacion.md](conversacion.md).

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
| `v4:reminder:<teléfono>` | `<eventId>` | 36 h | Saber a qué cita se refiere la respuesta del paciente |
| `v4:handoff:<teléfono>` | `1` | lo decide la doctora | El bot no responde mientras la doctora atiende |

### Horarios de envío

| Momento | Acción |
|---|---|
| Día anterior, 18:00 | Plantilla a cada cita de mañana con teléfono y sin recordatorio enviado |
| Al responder el paciente | `Estado: confirmada` (evento en verde) o `cambio pedido`; al reservar el nuevo turno, se borra el anterior |
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

## Costos

Desde el **1 de octubre de 2026**, Meta cobra por mensaje: las plantillas (marketing, utility) y también
las respuestas de servicio y utility dentro de la ventana de 24 horas
([precios de Meta](https://developers.facebook.com/docs/whatsapp/pricing)). Cada número tiene
**1.000 mensajes de servicio gratis al mes**. La tarifa depende del país del destinatario: consulta la
tabla vigente para Ecuador antes de cotizar.

Volumen esperado con 10 a 25 citas por semana: unos 40 a 100 recordatorios al mes y el resumen diario a
la doctora (unos 30). Las respuestas de cada conversación suelen caber en los 1.000 gratis, así que **los
recordatorios son el costo principal**. Con el presupuesto de $20 al mes, el segundo aviso de 2 horas
antes y los mensajes de «no llegaste» solo se activan si los números cierran.

## Decisiones pendientes con la doctora

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
- [Meta: precios de WhatsApp](https://developers.facebook.com/docs/whatsapp/pricing)
- [Kapso: n8n](https://docs.kapso.ai/docs/whatsapp/n8n)
