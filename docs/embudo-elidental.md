# Embudo de conversación de Eli (EliDental)

Recorrido de un paciente por WhatsApp, desde el primer mensaje hasta volver a la limpieza de los 6
meses. Eli conversa como una persona del consultorio. La diferencia es que sabe qué responder y qué no,
con la información real de EliDental. Cada etapa tiene sus mensajes, sus esperas y cuándo se da por
perdido o por ganado.

Imagen para compartir: [img/embudo-elidental.png](img/embudo-elidental.png).

**Leyenda:** 🟦 mensaje de Eli · 🟩 conversación (IA o la doctora) · 🟨 disparador · 🟪 espera ·
🟥 perdido · ✅ ganado. Lo marcado con 🔧 **todavía no está construido** en n8n; el resto ya funciona hoy.

```mermaid
flowchart TB
 subgraph E1["1. BIENVENIDA (filtro)"]
    direction TB
    B1[/"ELI BIENVENIDA:<br>¡Hola! 😊 Soy Eli, de EliDental.<br>Gracias por escribirnos.<br>Para ayudarle mejor:<br>1. ¿La cita es para usted o para alguien más?<br>2. ¿Qué le gustaría atender?<br>Una molestia, una limpieza, ortodoncia u otro tratamiento"/]
    BT{{"⚡ DISPARADOR:<br>El paciente responde"}}
    BU{{"⚡ URGENCIA DETECTADA:<br>dolor fuerte, hinchazón,<br>diente roto, sangrado"}}
    BW1("⏳ 🔧 Espera: 3 horas")
    B2[/"🔧 ELI RECORDATORIO SUAVE:<br>Hola, ¿pudo ver mi mensaje?<br>Cuénteme con calma qué necesita<br>y le ayudo a encontrar un turno"/]
    BW2("⏳ 🔧 Espera: hasta 23 h<br>desde su último mensaje")
    B3[/"🔧 ELI ÚLTIMO MENSAJE (puerta abierta):<br>Imagino que tuvo un día ocupado.<br>No le escribo más para no molestar.<br>Cuando quiera agendar, escríbame aquí<br>y le busco un turno 🦷"/]
    BL(["🟥 Perdido: no respondió"])
 end

 subgraph EU["URGENCIA (atajo)"]
    direction TB
    U1[/"ELI URGENCIA:<br>Lamento que esté con molestias.<br>El primer turno libre es [hoy 15:00].<br>¿Se lo reservo?<br>Si tiene la cara muy hinchada, fiebre alta<br>o le cuesta tragar o respirar,<br>acuda a emergencias ahora"/]
    U2("🔧 Aviso a la doctora<br>por WhatsApp")
 end

 subgraph E2["2. CONVERSACIÓN (confianza)"]
    direction TB
    C1("🟩 IA conversa")
    C2[/"ELI CONVERSACIÓN NATURAL:<br>Escucha y valida el motivo.<br>Responde dudas con datos reales:<br>tratamientos, sedación si tiene miedo,<br>niños, dirección, horario.<br>Precio: lo confirma la doctora en la valoración.<br>Cierra ofreciendo 2 turnos concretos:<br>¿Le queda mejor el jueves 10:00<br>o el viernes 16:00?"/]
    CW1("⏳ 🔧 Espera: 2 h sin respuesta")
    C3[/"🔧 ELI NUDGE con turnos reales:<br>Le guardé estas opciones por si le sirven:<br>[mañana 10:00] o [jueves 16:00].<br>¿Cuál le queda mejor?"/]
    CW2("⏳ 🔧 Espera: hasta 23 h")
    C4[/"🔧 ELI VALOR (sin presión):<br>Le dejo un dato útil:<br>una limpieza cada 6 meses evita caries<br>y molestias mayores.<br>Cuando quiera, aquí estoy para agendar 🤍"/]
    CL(["🟥 Perdido: indeciso"])
    CD("👩‍⚕️ Pasa a la doctora:<br>pregunta clínica, foto, queja<br>WhatsApp 099 970 1778")
    CT{{"⚡ DISPARADOR:<br>El paciente elige turno y dice sí<br>(reservar_cita = ok)"}}
 end

 subgraph E3["3. CITA AGENDADA (asistencia)"]
    direction TB
    A1[/"ELI CONFIRMACIÓN:<br>¡Listo! Su cita de [Limpieza dental]<br>es el [jueves 10] a las [10:00]<br>en Av. Manuel Agustín Aguirre 343-39,<br>entre Miguel Riofrío y Azuay.<br>Si es su primera vez, llegue 10 min antes"/]
    AW1("⏳ 🔧 Día anterior, 18:00")
    A2[/"🔧 PLANTILLA RECORDATORIO (utility):<br>Hola [Nombre], le recordamos su cita<br>mañana a las [hora] en EliDental.<br>¿Nos confirma su asistencia?<br>[Confirmo] [Necesito cambiar]"/]
    AC{{"⚡ Botón Confirmo"}}
    AX{{"⚡ Botón Necesito cambiar"}}
    AR("🟩 IA reagenda<br>y libera el turno anterior")
    AN("🔧 Sin respuesta:<br>va al resumen de la doctora 07:00")
    AW2("⏳ 🔧 Pasada la hora de la cita<br>sin marcar asistencia")
    A3[/"🔧 PLANTILLA NO ASISTIÓ (utility):<br>Hola [Nombre], ayer le esperábamos.<br>¿Todo bien? Si quiere, le busco otro turno"/]
    AL(["🟥 Perdido: no asistió"])
 end

 subgraph E4["4. ATENDIDO (ganado)"]
    direction TB
    W1(["✅ PACIENTE ATENDIDO"])
    W2[/"🔧 PLANTILLA SEGUIMIENTO (utility), al día siguiente:<br>Hola [Nombre], ¿cómo se siente después de<br>su [tratamiento]? Si tiene molestias,<br>escríbanos o llame al 099 970 1778"/]
    W3[/"🔧 RESEÑA, solo si respondió bien:<br>¡Qué gusto! ¿Nos ayudaría con una reseña?<br>[enlace de Google o Facebook]"/]
 end

 subgraph E5["5. VOLVER (retención)"]
    direction TB
    R1("⏳ 🔧 6 meses después de una limpieza")
    R2[/"🔧 PLANTILLA RECALL (marketing, con permiso):<br>Hola [Nombre], ya pasaron 6 meses<br>desde su última limpieza.<br>¿Le busco un turno? Tengo [opciones]"/]
    R3("⏳ 🔧 Controles de ortodoncia:<br>cada [X] semanas, según la doctora")
 end

    S(("🟢 EL PACIENTE ESCRIBE<br>WhatsApp o post de Instagram")) --> B1
    B1 -- Responde --> BT
    B1 -- Escribe con urgencia --> BU
    B1 -- No responde en 3 h --> BW1
    BW1 --> B2
    B2 -- Responde --> BT
    B2 -- No responde --> BW2
    BW2 --> B3
    B3 -- Responde --> BT
    B3 -- Silencio --> BL
    BU --> U1
    U1 --> U2
    U1 -- Acepta el turno --> CT
    BT --> C1
    C1 --> C2
    C2 -- Clínico, foto o queja --> CD
    C2 -- Deja de responder 2 h --> CW1
    CW1 --> C3
    C3 -- Responde --> C2
    C3 -- No responde --> CW2
    CW2 --> C4
    C4 -- Responde --> C2
    C4 -- Silencio --> CL
    C2 -- Elige turno y confirma --> CT
    CT --> A1
    A1 --> AW1
    AW1 --> A2
    A2 --> AC
    A2 --> AX
    A2 -- No contesta --> AN
    AX --> AR
    AR --> A1
    AC --> AW2
    AN --> AW2
    AW2 -- Asistió --> W1
    AW2 -- No asistió --> A3
    A3 -- Responde --> C2
    A3 -- Silencio --> AL
    W1 --> W2
    W2 -- Responde bien --> W3
    W2 -- Molestia --> CD
    W1 --> R1
    R1 --> R2
    R2 -- Responde --> C2
    W1 -. ortodoncia .-> R3
    R3 --> R2

    classDef bot fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#000
    classDef user fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#000
    classDef trigger fill:#FFF9C4,stroke:#FBC02D,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    classDef wait fill:#F3E5F5,stroke:#7B1FA2,stroke-width:1px,color:#000
    classDef lost fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#000
    classDef win fill:#C8E6C9,stroke:#2E7D32,stroke-width:4px,color:#000
    classDef urgent fill:#FFE0B2,stroke:#E65100,stroke-width:3px,color:#000
    class B1,B2,B3,C2,C3,C4,A1,A2,A3,W2,W3,R2 bot
    class C1,CD,AR,AN,U2 user
    class BT,BU,CT,AC,AX trigger
    class BW1,BW2,CW1,CW2,AW1,AW2,R1,R3 wait
    class BL,CL,AL lost
    class W1 win
    class U1 urgent
```

## Etapa por etapa

### 1. Bienvenida (filtro)

| | |
|---|---|
| Objetivo | Saber para quién es la cita y el motivo, en el primer mensaje |
| Mensaje | «¡Hola! 😊 Soy Eli, de EliDental. Gracias por escribirnos. Para ayudarle mejor: 1. ¿La cita es para usted o para alguien más? 2. ¿Qué le gustaría atender: una molestia, una limpieza, ortodoncia u otro tratamiento?» |
| Atajo | Si el primer mensaje ya trae urgencia, se salta la bienvenida y va a **Urgencia** |
| Si no responde | A las 3 h, recordatorio suave. Cerca de las 23 h, último mensaje con la puerta abierta. Después, perdido |
| Hoy | ✅ El saludo y la pregunta los hace la IA. 🔧 Los recordatorios por tiempo no existen todavía |

### Urgencia (atajo)

| | |
|---|---|
| Disparadores | Dolor fuerte, «me duele mucho», hinchado, sangra, se rompió, se cayó un diente o corona, golpe, fiebre, pus |
| Mensaje | Empatía en una frase, el **primer turno libre real** (de Google Calendar) y la indicación de ir a emergencias si los síntomas son graves |
| Hoy | ✅ Funciona por el prompt de la IA. 🔧 Falta el aviso automático a la doctora |

### 2. Conversación (confianza)

| | |
|---|---|
| Objetivo | Que el paciente se sienta escuchado y termine eligiendo un turno |
| Cómo habla Eli | Trato de usted, cálido, mensajes de 2 a 6 líneas, máximo un emoji. Valida el motivo («entiendo, una molestia así incomoda mucho»), responde con datos reales y **cierra siempre con dos turnos concretos**, sin preguntas abiertas como «¿cuándo puede?» |
| Lo que sabe | Tratamientos, sedación para pacientes con miedo, atención a niños y embarazadas, dirección, horario (L–V 09:00–18:00, sábado 09:00–15:00) |
| Lo que no hace | No da precios (los confirma la doctora en la valoración), no diagnostica, no interpreta fotos, no inventa horarios |
| Pasa a la doctora | Pregunta clínica, foto, queja o «quiero hablar con la doctora»: le da el WhatsApp 099 970 1778 |
| Si deja de responder | A las 2 h, «nudge» con **dos turnos reales**. Cerca de las 23 h, mensaje de valor sin presión. Después, perdido (indeciso) |
| Hoy | ✅ Conversación, turnos reales, reserva y derivación. 🔧 Nudges por tiempo |

### 3. Cita agendada (asistencia)

| | |
|---|---|
| Confirmación | Servicio, día, hora y dirección completa. Si es su primera vez, llegar 10 minutos antes |
| Recordatorio | Día anterior a las 18:00, **plantilla de Meta** con botones «Confirmo» y «Necesito cambiar» |
| Necesito cambiar | Eli ofrece otros turnos, reserva el nuevo y libera el anterior |
| Sin respuesta | Aparece en el resumen de las 07:00 para la doctora |
| No asistió | Al día siguiente, plantilla «¿Todo bien? ¿Le busco otro turno?». Si no responde, perdido |
| Hoy | ✅ Confirmación. 🔧 Recordatorio, resumen y «no asistió» (diseño en [eli-dental.md](eli-dental.md#6-recordatorios)) |

### 4. Atendido (ganado)

| | |
|---|---|
| Seguimiento | Al día siguiente: «¿Cómo se siente después de su tratamiento?». Si hay molestias, pasa a la doctora |
| Reseña | **Solo** si respondió bien: pedir una reseña con el enlace de Google o Facebook |
| Hoy | 🔧 Todo por construir. Hace falta marcar «asistió» en el evento del calendario |

### 5. Volver (retención)

| | |
|---|---|
| Limpieza | A los 6 meses: plantilla de marketing con dos turnos. Solo a quien aceptó recibir mensajes |
| Ortodoncia | Controles periódicos, con la frecuencia que indique la doctora |
| Hoy | 🔧 Por construir |

## Reglas que hacen que suene humano y no a bot

1. **Una pregunta por mensaje**, salvo en la bienvenida (dos, numeradas).
2. **Siempre dos opciones concretas** de turno. Nunca «¿qué día puede?» sin opciones.
3. **Validar antes de vender:** primero el motivo o la molestia, después el turno.
4. **Nombrar al paciente** cuando ya lo sabemos.
5. **El seguimiento se corta apenas el paciente responde.** Nunca dos recordatorios seguidos.
6. **Sin presión falsa.** Nada de «URGENTE» ni de «se liberó un espacio» si no es verdad: en salud, la
   confianza vale más que la conversión. La escasez real sí se usa: si alguien cancela, Eli puede ofrecer
   ese turno a quien lo pidió (🔧 lista de espera).

## Lo que exige WhatsApp

| Situación | Qué se puede enviar | Costo |
|---|---|---|
| Hasta 24 h después del último mensaje del paciente | Cualquier mensaje (texto, botones) | Respuestas de servicio: 1.000 gratis al mes por número, después se cobran |
| Más de 24 h | Solo **plantillas aprobadas por Meta** | Se cobran por mensaje |

Por eso los seguimientos de las etapas 1 y 2 terminan **antes de las 23 h**: son los últimos mensajes
libres y gratis. Todo lo de las etapas 3 a 5 (recordatorio, no asistió, seguimiento, recall) son
plantillas:

| Plantilla | Categoría | Botones |
|---|---|---|
| `recordatorio_cita` | Utility | Confirmo · Necesito cambiar |
| `cita_no_asistio` | Utility | Buscar otro turno |
| `seguimiento_tratamiento` | Utility | — |
| `recall_limpieza` | Marketing (requiere permiso del paciente) | Agendar |

## Cómo se construye en n8n

| Pieza | Qué hace | Estado |
|---|---|---|
| `version4` (webhook) | Bienvenida, conversación, urgencia, reserva, derivación | ✅ En producción |
| Estado en Redis | `v4:stage:<tel>` (bienvenida, conversación, agendado, atendido), `v4:last_in:<tel>` (hora del último mensaje del paciente), `v4:nudge:<tel>` (seguimientos enviados) | 🔧 |
| Workflow `Eli · Seguimiento` | Cada 15 min revisa las conversaciones sin respuesta y envía el seguimiento de su etapa (3 h y 23 h en bienvenida; 2 h y 23 h en conversación). Para si el paciente respondió | 🔧 |
| Workflow `Eli · Recordatorios` | Día anterior a las 18:00: plantilla con botones; 07:00: resumen a la doctora | 🔧 Diseño listo |
| Workflow `Eli · Después de la cita` | No asistió, seguimiento, reseña y recall | 🔧 |
| Aviso a la doctora | Urgencias, quejas, preguntas clínicas | 🔧 |

Orden sugerido: 1) estado en Redis y seguimientos de las etapas 1 y 2, que son gratis y dentro de la
ventana; 2) recordatorios; 3) aviso a la doctora; 4) después de la cita y recall.

## Cómo medirlo

| Métrica | Pregunta que responde |
|---|---|
| Conversaciones nuevas por semana | ¿Cuánta gente escribe? |
| % que responde la bienvenida | ¿El primer mensaje engancha? |
| % que agenda | ¿La conversación convence? |
| % que confirma el recordatorio | ¿Llegan informados? |
| % que no asiste | ¿Los recordatorios funcionan? |
| % que vuelve a los 6 meses | ¿Hay retención? |

## Fuentes

- [Doctocliq: convertir leads en pacientes desde WhatsApp](https://www.doctocliq.com/blog/convertir-leads-pacientes-whatsapp-clinica-dental)
- [Kura: agente de IA para clínicas dentales](https://getkura.ai/en/ai-dental-clinics)
- [Aurora Inbox: chatbot de WhatsApp para clínicas dentales](https://www.aurorainbox.com/en/2026/05/15/chatbot-dental-clinics-via-whatsapp/)
- [Dentalclinically: recall por WhatsApp](https://dentalclinically.com/whatsapp-automation-for-dental-clinics/)
- [Updent: recuperar pacientes inactivos](https://updent.es/blog/recuperar-pacientes-inactivos-clinica-dental/)
- [smsmode: ventana de 24 h y plantillas](https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/)

Las cifras de estos sitios son de empresas que venden automatización: sirven de referencia, no como
estudios.
