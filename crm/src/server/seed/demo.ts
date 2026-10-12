import { eq, inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

/**
 * Consultorio de demostración "EliDental" (FR-075).
 * Idempotente: borra los datos demo previos de la organización (scoped por
 * los teléfonos demo) y reinserta. El KB queda lleno EXCEPTO seguros —
 * hueco INTENCIONAL para que el Laboratorio encuentre algo real en la
 * primera corrida.
 */

type Db = ReturnType<typeof getDb>;

const HOURS = 60 * 60 * 1000;

const DEMO_CONTACTS: {
  phone: string;
  name: string;
  notes?: string;
  stage: string;
  thread: { dir: "in" | "out"; text: string; hoursAgo: number; ai?: boolean }[];
}[] = [
  {
    phone: "593912340001",
    name: "María Fernanda López",
    stage: "Interesado",
    notes: "Busca limpieza dental; nunca ha venido.",
    thread: [
      { dir: "in", text: "Hola, ¿hacen limpiezas?", hoursAgo: 5 },
      { dir: "out", text: "¡Hola María! 😊 Sí, hacemos limpieza (profilaxis con ultrasonido). ¿Desea agendar? Tengo mañana a las 10:00 o el jueves a las 16:00.", hoursAgo: 5, ai: true },
      { dir: "in", text: "¿Tienen precio de esa limpieza?", hoursAgo: 4 },
      { dir: "out", text: "El valor lo confirma la doctora en la valoración, según cada caso. ¿Le agendo? Si es su primera vez, llegue 10 minutos antes para la historia clínica.", hoursAgo: 4, ai: true },
      { dir: "in", text: "Ah, ya. Déjeme confirmar mi horario y le digo.", hoursAgo: 3 },
    ],
  },
  {
    phone: "593912340002",
    name: "Carlos Ramírez",
    stage: "Agendó",
    thread: [
      { dir: "in", text: "Buenas, me duele una muela desde ayer", hoursAgo: 8 },
      { dir: "out", text: "Lamento que esté con esa molestia. El primer turno libre es hoy a las 15:00, ¿se lo reservo? Si la cara se le hincha, tiene fiebre alta o le cuesta tragar o respirar, acuda a emergencias ahora.", hoursAgo: 8, ai: true },
      { dir: "in", text: "Sí, resérveme las 15:00 por favor", hoursAgo: 7 },
      { dir: "out", text: "¡Listo! Su urgencia dental es hoy a las 15:00 en Av. Manuel Agustín Aguirre 343-39, entre Miguel Riofrío y Azuay. Llegue 10 minutos antes.", hoursAgo: 7, ai: true },
    ],
  },
  {
    phone: "593912340003",
    name: "Lupita Hernández",
    stage: "Asistió",
    notes: "Limpieza + control: paciente recurrente.",
    thread: [
      { dir: "in", text: "Hola, quisiera hacer una limpieza otra vez 😊", hoursAgo: 30 },
      { dir: "out", text: "¡Hola Lupita! Con gusto. Tengo el miércoles a las 11:00 o el viernes a las 14:00, ¿cuál le queda mejor?", hoursAgo: 30, ai: true },
      { dir: "in", text: "El miércoles a las 11", hoursAgo: 29 },
      { dir: "out", text: "Perfecto, su cita queda el miércoles a las 11:00 en Av. Manuel Agustín Aguirre 343-39. ¡Nos vemos!", hoursAgo: 29, ai: true },
    ],
  },
  {
    phone: "593912340004",
    name: "Jorge Castillo",
    stage: "Nuevo",
    thread: [
      { dir: "in", text: "ola, tengo un dolor fuerte en una muela y estoy asustado", hoursAgo: 2 },
      { dir: "out", text: "Hola Jorge, entiendo que una molestia así incomoda mucho. ¿Desde cuándo le duele? El primer turno libre es hoy a las 15:00. Si la cara se le hincha o le cuesta tragar, acuda a emergencias ahora.", hoursAgo: 2, ai: true },
    ],
  },
  {
    phone: "593912340005",
    name: "Ana Sofía Torres",
    stage: "Interesado",
    thread: [
      { dir: "in", text: "Hola, vi su perfil. ¿Hacen ortodoncia?", hoursAgo: 12 },
      { dir: "out", text: "¡Hola Ana! 😊 Sí, la Dra. Viviana Sucunuta es posgradista en ortodoncia. Para un tratamiento nuevo empezamos por una consulta de valoración. ¿Le agendo? Tengo el lunes a las 10:00 o el miércoles a las 16:00.", hoursAgo: 12, ai: true },
      { dir: "in", text: "¿Cuánto cuestan los brackets aquí?", hoursAgo: 11 },
      { dir: "out", text: "El valor lo confirma la doctora en la valoración, según cada caso; ahí también se define el plan de tratamiento. ¿Le agendo una valoración?", hoursAgo: 11, ai: true },
      { dir: "in", text: "Déjeme hablarlo con mi esposo y le confirmo", hoursAgo: 10 },
    ],
  },
  {
    phone: "593912340006",
    name: "Roberto Mendoza",
    stage: "Perdido",
    notes: "Pidió precio de brackets por WhatsApp; no volvió.",
    thread: [
      { dir: "in", text: "¿A cómo están los brackets acá?", hoursAgo: 96 },
      { dir: "out", text: "Hola Roberto: los precios los confirma la doctora en la valoración. ¿Le agendo una para que le den el plan completo? Tengo el jueves a las 09:00.", hoursAgo: 96, ai: true },
      { dir: "in", text: "Uy no, allá me la dan más fácil, no me sirve", hoursAgo: 95 },
      { dir: "out", text: "Entiendo. Aquí estamos si luego quiere una valoración sin compromiso. ¡Éxitos!", hoursAgo: 95, ai: true },
    ],
  },
  {
    phone: "593912340007",
    name: "Paty Domínguez",
    stage: "Agendó",
    notes: "Miedo al dentista; se le ofreció sedación.",
    thread: [
      { dir: "in", text: "Hola, la verdad me da mucho miedo el dentista 😰", hoursAgo: 26 },
      { dir: "out", text: "Es muy común, no se preocupe Paty 😊 La doctora trabaja con mucha paciencia y también ofrece sedación para quienes sienten ansiedad. ¿Le agendo una valoración para conversarlo con calma?", hoursAgo: 26, ai: true },
      { dir: "in", text: "¿Y de verdad no me va a doler?", hoursAgo: 25 },
      { dir: "out", text: "En la valoración la doctora le explica todo y define la mejor opción, con mucha paciencia. ¿Le sirve el sábado a las 09:00 o el martes a las 15:00?", hoursAgo: 25, ai: true },
    ],
  },
  {
    phone: "593912340008",
    name: "Don Chuy Aguilar",
    stage: "Seguimiento",
    thread: [
      { dir: "in", text: "Hola, ya me hice la extracción de la muela del juicio", hoursAgo: 50 },
      { dir: "out", text: "¡Qué bien Don Chuy! ¿Cómo se siente hoy? Si tiene molestias o notas, escríbanos o llame al 099 970 1778. Le recordamos el control para revisar la cicatrización.", hoursAgo: 50, ai: true },
      { dir: "in", text: "Gracias, por ahora bien", hoursAgo: 49 },
      { dir: "out", text: "¡Me alegro! Quedamos atentos a cualquier molestia.", hoursAgo: 49, ai: true },
    ],
  },
];

const DEMO_KB: { kind: "qa" | "block"; question?: string; answer?: string; content?: string }[] = [
  {
    kind: "block",
    content:
      "EliDental — Odontología integral para toda la familia. Consultorio en Av. Manuel Agustín Aguirre 343-39, entre Miguel Riofrío y Azuay, Loja (Ecuador). La Dra. Viviana Elizabeth Sucunuta, posgradista en ortodoncia, atiende con sedación a pacientes con miedo y también a niños y embarazadas.",
  },
  { kind: "qa", question: "¿Cuál es el horario de atención?", answer: "Lunes a viernes de 09:00 a 18:00, sábados de 09:00 a 15:00. Los domingos cerrado." },
  { kind: "qa", question: "¿Dónde están ubicados?", answer: "Av. Manuel Agustín Aguirre 343-39, entre Miguel Riofrío y Azuay, Loja. En la primera cita conviene llegar 10 minutos antes para la historia clínica." },
  { kind: "qa", question: "¿Qué servicios ofrecen?", answer: "Limpieza (profilaxis con ultrasonido), resinas y cambio de amalgamas, ortodoncia, blanqueamiento, carillas, endodoncia, extracciones y muelas del juicio, prótesis total y fija (coronas y puentes) y frenectomía. Para un tratamiento nuevo se empieza por una consulta de valoración." },
  { kind: "qa", question: "¿Cuánto cuesta una limpieza?", answer: "El valor de cada tratamiento lo confirma la doctora en la consulta de valoración, según el caso. No publicamos precios." },
  { kind: "qa", question: "¿Cómo agendo una cita?", answer: "Por este WhatsApp o llamando al 099 970 1778. Le ofrezco dos o tres turnos concretos dentro del horario y usted elige." },
  { kind: "qa", question: "Tengo miedo al dentista", answer: "Es muy común. La doctora trabaja con mucha paciencia y ofrece sedación para quienes sienten ansiedad; también se puede empezar con una valoración para conversarlo sin compromiso." },
  { kind: "qa", question: "Tengo una urgencia dental", answer: "Si tiene dolor fuerte, la cara muy hinchada, fiebre alta o le cuesta tragar o respirar, acuda a una emergencia. Para la molestia en sí se busca el primer turno libre y se registra como urgencia." },
  { kind: "qa", question: "¿Atienden niños?", answer: "Sí, atendemos niños y embarazadas." },
  // HUECO INTENCIONAL: nada sobre seguros aceptados (lo encuentra el Laboratorio).
];

export async function seedDemo(
  db: Db,
  organizationId: string
): Promise<{ contacts: number; kbEntries: number }> {
  const demoPhones = DEMO_CONTACTS.map((c) => c.phone);

  // --- Idempotencia: limpiar datos demo previos (orden inverso de FKs) ---
  const prevContacts = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(inArray(schema.contact.phone, demoPhones));
  const prevIds = prevContacts.map((c) => c.id);
  if (prevIds.length > 0) {
    const prevConvs = await db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(inArray(schema.conversation.contactId, prevIds));
    const convIds = prevConvs.map((c) => c.id);
    if (convIds.length > 0) {
      await db
        .delete(schema.message)
        .where(inArray(schema.message.conversationId, convIds));
      await db
        .delete(schema.conversation)
        .where(inArray(schema.conversation.id, convIds));
    }
    await db.delete(schema.lead).where(inArray(schema.lead.contactId, prevIds));
    await db.delete(schema.contact).where(inArray(schema.contact.id, prevIds));
  }
  // KB y corridas demo previas
  await db
    .delete(schema.kbEntry)
    .where(eq(schema.kbEntry.organizationId, organizationId));
  await db
    .delete(schema.agentTestCase)
    .where(eq(schema.agentTestCase.organizationId, organizationId));
  await db
    .delete(schema.agentTestRun)
    .where(eq(schema.agentTestRun.organizationId, organizationId));

  // --- Etapas (por nombre) ---
  const stages = await db
    .select()
    .from(schema.pipelineStage)
    .where(eq(schema.pipelineStage.organizationId, organizationId));
  const stageByName = new Map(stages.map((s) => [s.name, s.id]));
  const fallbackStage = stages[0]?.id;
  if (!fallbackStage) throw new Error("La organización no tiene etapas");

  // --- Contactos + conversaciones + mensajes + leads ---
  const now = Date.now();
  let position = 0;
  for (const demo of DEMO_CONTACTS) {
    const contactId = newId("contact");
    await db.insert(schema.contact).values({
      id: contactId,
      organizationId,
      phone: demo.phone,
      waIdentity: demo.phone,
      name: demo.name,
      notes: demo.notes ?? null,
    });

    const lastInbound = demo.thread
      .filter((t) => t.dir === "in")
      .reduce((min, t) => Math.min(min, t.hoursAgo), Infinity);
    const lastMessage = demo.thread.reduce(
      (min, t) => Math.min(min, t.hoursAgo),
      Infinity
    );

    const conversationId = newId("conversation");
    await db.insert(schema.conversation).values({
      id: conversationId,
      organizationId,
      contactId,
      lastInboundAt: new Date(now - lastInbound * HOURS),
      lastMessageAt: new Date(now - lastMessage * HOURS),
      unreadCount: demo.thread[demo.thread.length - 1]?.dir === "in" ? 1 : 0,
    });

    for (const msg of demo.thread) {
      const at = new Date(now - msg.hoursAgo * HOURS);
      await db.insert(schema.message).values({
        id: newId("message"),
        organizationId,
        conversationId,
        waMessageId: `wamid.demo.${newId("message")}`,
        direction: msg.dir,
        type: "text",
        text: msg.text,
        status: msg.dir === "in" ? "delivered" : "read",
        aiGenerated: msg.ai ?? false,
        origin: msg.ai ? "ai" : "operator",
        waTimestamp: at,
        createdAt: at,
      });
    }

    await db.insert(schema.lead).values({
      id: newId("lead"),
      organizationId,
      contactId,
      stageId: stageByName.get(demo.stage) ?? fallbackStage,
      position: position++,
      lastActivityAt: new Date(now - lastMessage * HOURS),
    });
  }

  // --- Knowledge base (con el hueco intencional) ---
  for (const entry of DEMO_KB) {
    await db.insert(schema.kbEntry).values({
      id: newId("kbEntry"),
      organizationId,
      kind: entry.kind,
      question: entry.question ?? null,
      answer: entry.answer ?? null,
      content: entry.content ?? null,
    });
  }

  // --- Comportamiento del agente de la demo ---
  await db
    .update(schema.agentProfile)
    .set({
      name: "Eli",
      tone: "Cercana y serena, trato de usted, como la recepcionista de un consultorio de confianza. Valida la molestia antes de proponer nada y ofrece turnos concretos sin presionar.",
      instructions:
        "Según el motivo: dolor, golpe o algo roto es urgencia (el primer turno libre); un tratamiento nuevo o una revisión empieza por consulta de valoración; limpieza o control es un turno normal. Si es su primera vez, pide nombre completo, edad y motivo. Nunca da precios (los confirma la doctora), no diagnostica, no interpreta fotos y no inventa horarios. Ofrece dos o tres turnos concretos y cierra con un resumen de servicio, día, hora y dirección.",
      escalationRules:
        "Deriva a la doctora (WhatsApp 099 970 1778) las preguntas clínicas o las fotos (sin opinar, ofreciendo una valoración), las quejas, las peticiones de hablar con la doctora o con una persona. Ante urgencias graves (cara hinchada, fiebre alta, dificultad para respirar) indica acudir a emergencias.",
      greeting:
        "¡Hola! 😊 Soy Eli, de EliDental. ¿En qué le puedo ayudar? ¿Desea agendar una cita o tiene alguna molestia?",
      updatedAt: new Date(),
    })
    .where(eq(schema.agentProfile.organizationId, organizationId));

  // --- Corrida de Laboratorio de ejemplo (guardada, con el hueco encontrado) ---
  const runId = newId("testRun");
  await db.insert(schema.agentTestRun).values({
    id: runId,
    organizationId,
    status: "done",
    score: 83,
    startedAt: new Date(now - 24 * HOURS),
    finishedAt: new Date(now - 24 * HOURS + 3 * 60 * 1000),
  });
  const exampleCases: {
    persona: string;
    veredicto: "verde" | "amarillo" | "rojo";
    hallazgos: unknown[];
    transcript: { role: string; text: string }[];
  }[] = [
    {
      persona: "comprador_decidido",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Buenas tardes, quiero sacar una cita para una limpieza dental" },
        { role: "agente", text: "¡Claro! Con gusto le ayudo. Tengo mañana a las 10:00 o el jueves a las 16:00, ¿cuál le queda mejor?" },
        { role: "cliente", text: "El jueves a las 16:00 está bien" },
        { role: "agente", text: "Perfecto. Su limpieza (profilaxis con ultrasonido) queda el jueves a las 16:00 en Av. Manuel Agustín Aguirre 343-39, entre Miguel Riofrío y Azuay. Si es su primera vez, llegue 10 minutos antes. ¿Me confirma su nombre completo?" },
      ],
    },
    {
      persona: "pregunton_precios",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "¿Cuánto cuesta el blanqueamiento?" },
        { role: "agente", text: "El valor lo confirma la doctora en la consulta, según cada caso. ¿Le agendo una valoración sin compromiso?" },
        { role: "cliente", text: "¿Y los brackets? ¿Y las carillas?" },
        { role: "agente", text: "Los precios de cada tratamiento los confirma la doctora en la valoración, porque dependen del caso. ¿Le reservo una para que le den el plan completo?" },
      ],
    },
    {
      persona: "cliente_enojado",
      veredicto: "amarillo",
      hallazgos: [
        {
          tipo: "tono",
          evidencia:
            "El agente respondió correcto pero algo frío ante 'me dejó mal la muela'; faltó empatizar antes de escalar a la doctora.",
        },
      ],
      transcript: [
        { role: "cliente", text: "Me hicieron una extracción la semana pasada y todavía me duele horrible, me dejó mal la muela" },
        { role: "agente", text: "Lamento el problema. Paso su caso a la doctora para que lo revise." },
      ],
    },
    {
      persona: "fuera_de_kb",
      veredicto: "rojo",
      hallazgos: [
        {
          tipo: "fuera_de_kb",
          evidencia:
            "El paciente preguntó por seguros y el conocimiento no lo cubre.",
          sugerencia: {
            pregunta: "¿Qué seguros aceptan?",
            respuesta:
              "El consultorio no tiene convenios con seguros por ahora: la atención se paga en consulta. Si algún día se habilitan, se lo comunicamos por aquí.",
          },
        },
      ],
      transcript: [
        { role: "cliente", text: "¿Qué seguros aceptan?" },
        { role: "agente", text: "Déjeme confirmarlo con la doctora y le digo en un momento." },
      ],
    },
    {
      persona: "pide_humano",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Prefiero hablar con la doctora, ¿me puede comunicar con ella?" },
        { role: "agente", text: "Con gusto; le comparto el WhatsApp del consultorio, 099 970 1778, para que coordine directamente con la doctora." },
      ],
    },
    {
      persona: "errores_modismos",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "ola, kiero ver si me sangra la muela, me duele arto" },
        { role: "agente", text: "Lamento que esté con esa molestia. El primer turno libre es hoy a las 15:00, ¿se lo reservo? Si la cara se le hincha o le cuesta tragar o respirar, acuda a emergencias ahora." },
      ],
    },
  ];
  for (const c of exampleCases) {
    await db.insert(schema.agentTestCase).values({
      id: newId("testCase"),
      organizationId,
      runId,
      persona: c.persona,
      status: "done",
      veredicto: c.veredicto,
      hallazgos: c.hallazgos,
      transcript: c.transcript,
    });
  }

  return { contacts: DEMO_CONTACTS.length, kbEntries: DEMO_KB.length };
}

/** true si la organización aún no tiene datos de dominio (para el botón). */
export async function isDomainEmpty(
  db: Db,
  organizationId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, organizationId))
    .limit(1);
  return rows.length === 0;
}
