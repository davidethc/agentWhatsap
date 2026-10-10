# Cómo funciona Eli (explicado sin tecnicismos)

Esta página es para entender el proyecto **sin saber programar**: qué es Eli, de qué piezas está hecha,
qué puede hacer, qué hace hoy y cuánto cuesta.

## Qué es Eli

Eli es una **asistente virtual que contesta el WhatsApp de un consultorio dental**. Cuando un paciente
escribe, Eli le responde como lo haría una recepcionista: saluda, resuelve dudas, busca un horario
libre en la agenda y deja la cita anotada. Lo que requiere a la doctora (dolor fuerte, dudas de salud,
quejas) se lo pasa a ella.

Hoy atiende a **EliDental** (Loja), de la Dra. Viviana Sucunuta.

## Las piezas, como si fuera un consultorio

| Pieza | En el consultorio sería… | Qué hace |
|---|---|---|
| **WhatsApp** | El teléfono del consultorio | Por donde escribe el paciente |
| **Meta** | La compañía telefónica | La dueña de WhatsApp: entrega los mensajes y cobra por algunos |
| **Kapso** | La central que conecta el teléfono con la recepción | Recibe los mensajes de WhatsApp y se los pasa a Eli, y envía las respuestas |
| **n8n** | La recepción, con sus procedimientos | El programa donde está armado cómo trabaja Eli, paso a paso |
| **Gemini** (de Google) | La recepcionista que entiende y redacta | La inteligencia artificial que entiende lo que escribe el paciente y redacta la respuesta |
| **Google Calendar** | La agenda de citas | Donde Eli mira qué horarios están libres y anota las citas |
| **Docker** | El edificio donde está la recepción | Mantiene todo funcionando en una computadora |
| **ngrok** | La dirección del edificio | Da una dirección de internet para que Kapso encuentre la computadora |

```
Paciente → WhatsApp → Meta → Kapso → n8n (Eli + Gemini + Google Calendar) → Kapso → WhatsApp → Paciente
```

Una respuesta tarda entre 5 y 20 segundos: Kapso espera 5 segundos por si el paciente manda varios
mensajes seguidos, y luego Eli piensa la respuesta.

## Qué es Kapso y por qué lo usamos

WhatsApp no deja conectar programas directamente a un número de negocio: hay que pasar por la
**plataforma oficial de Meta**. Kapso es una empresa **autorizada por Meta** que hace esa conexión fácil.

**Lo bueno:**
- **Es oficial:** no hay riesgo de que bloqueen el número por usar algo no permitido.
- **Se conecta en minutos** y trae piezas listas para n8n.
- **La doctora puede seguir usando su WhatsApp** en el celular, con el mismo número, mientras Eli
  responde. A esto se le llama «coexistencia».
- **El cliente no tiene que poner su tarjeta:** Kapso le paga a Meta con un saldo prepagado nuestro, y
  nosotros le cobramos al consultorio una mensualidad fija. Solo una empresa autorizada como Kapso puede
  hacer esto; si nos conectáramos directo a Meta, cada consultorio tendría que poner su tarjeta.
- Junta los mensajes seguidos del paciente para responder una sola vez.

**Lo malo:**
- **Es un proveedor más:** el plan gratuito permite un solo número. Para varios consultorios hay que
  pagar un plan.
- **Dependemos de Kapso:** si falla o cambia sus condiciones, nos afecta. Además, una vez que un número
  usa el saldo de Kapso, no se puede pasar fácilmente a la tarjeta propia del consultorio.
- **Los costos de WhatsApp no desaparecen:** Kapso solo los paga por nosotros.
- **Usar el mismo número en el celular y con Eli** es un poco menos estable que un número solo para Eli.

**Otras opciones que descartamos:**

| Opción | Por qué no, por ahora |
|---|---|
| Conectar directo a Meta | Cada consultorio tendría que poner su tarjeta en Meta, y es más técnico |
| Otras empresas como Kapso (Twilio, 360dialog, WATI) | Hacen lo mismo, con otros precios; no conectan tan directo con n8n |
| Programas «no oficiales» que imitan WhatsApp Web | Son gratis, pero **violan las reglas de WhatsApp**: pueden bloquear el número del consultorio |
| Programas de gestión dental con WhatsApp (Doctocliq, Dentalink) | Sirven, pero no son nuestro producto ni se pueden adaptar tanto |

La decisión técnica completa está en la [ADR 0007](adr/0007-kapso.md).

## Qué puede hacer Eli

**Hoy:**
- Responder 24 horas, mientras la computadora y los servicios estén encendidos.
- Saludar y conversar de forma natural, con trato de usted.
- Dar información real del consultorio: servicios, horario, dirección, sedación para pacientes con
  miedo, atención a niños.
- Buscar horarios libres y, si el que pide el paciente está ocupado, ofrecer los más cercanos.
- Agendar, ver, mover y cancelar citas en Google Calendar.
- Reconocer una urgencia y ofrecer el primer turno libre, con la indicación de ir a emergencias si es
  grave.
- Pasar a la doctora lo que es de salud, las fotos y las quejas, dándole al paciente su WhatsApp.
- Decir con honestidad que es una asistente virtual, si le preguntan.

**Lo que se puede agregar (ya está diseñado):**
- Volver a escribir, con tacto, a quien dejó de responder (dentro de las primeras 23 horas).
- Recordar la cita el día anterior y pedir que el paciente confirme.
- Mandarle a la doctora un resumen cada mañana con las citas del día.
- Escribir a quien no asistió, preguntar cómo se siente después de un tratamiento y pedir una reseña.
- Recordar la limpieza a los 6 meses.

El recorrido completo está en [conversacion.md](conversacion.md).

**Lo que Eli no hace (a propósito):**
- No da diagnósticos ni recomienda medicamentos.
- No dice precios: los confirma la doctora en la valoración.
- No inventa horarios, urgencias ni promociones.
- No usa botones ni formularios: conversa como una persona.

## Cuánto cuesta

| Concepto | Quién lo cobra | Cómo se cobra |
|---|---|---|
| **Mensajes de WhatsApp** | Meta, a través del saldo de Kapso | Las respuestas de Eli: **1.000 gratis al mes por número**, después se cobran. Los mensajes que Eli envía por su cuenta (recordatorios, seguimientos después de 24 horas) **se cobran cada uno**. El precio depende del país |
| **Kapso** | Kapso | Plan gratuito con 1 número; para más números, plan mensual. Revisa su precio actual |
| **Gemini** (la IA) | Google | El plan gratuito permite unas 20 consultas al día, y se agota rápido. Para uso real hay que activar el pago por uso |
| **Servidor** | Un proveedor de servidores en la nube | Hoy corre en un computador personal (gratis, pero si se apaga, Eli no responde). Para un consultorio real hace falta un servidor pequeño siempre encendido, que se paga mensualmente |
| **n8n, Google Calendar, ngrok** | — | Gratis en la forma en que los usamos |

**Modelo de cobro:** nosotros pagamos Meta (con el saldo de Kapso), Gemini y el servidor, y le cobramos
al consultorio una **mensualidad fija**, por adelantado y con margen. El consultorio nunca pone una
tarjeta.

## Qué tiene que estar encendido

Para que Eli responda tienen que estar encendidos el computador, **Docker** y **ngrok**. Si el computador
se reinicia, hay que levantarlos de nuevo: [operacion.md](operacion.md#después-de-reiniciar-el-computador).

## Glosario

| Palabra | Significado |
|---|---|
| Workflow | La receta paso a paso que sigue Eli en n8n |
| Plantilla | Un mensaje modelo que Meta aprueba antes de usarlo. Hace falta para escribirle a alguien que no escribió en las últimas 24 horas |
| Ventana de 24 horas | Tiempo en que se le puede responder libremente a un paciente después de su último mensaje |
| Webhook | La «dirección» a la que Kapso envía cada mensaje que llega |
| Token / API key | Una contraseña para que dos programas se conecten |
| Coexistencia | Usar el mismo número de WhatsApp en el celular y con Eli al mismo tiempo |
