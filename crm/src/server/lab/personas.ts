/**
 * Las 6 personas GUIONADAS del Laboratorio (FR-030). El cliente simulado no
 * usa LLM: son secuencias fijas — determinismo total del lado del cliente.
 * El agente que responde es el REAL (mismo pipeline de US3).
 */

export type Persona = {
  key: string;
  label: string;
  description: string;
  /** Teléfono sintético estable (jamás un número real). */
  phone: string;
  contactName: string;
  script: string[];
};

export const PERSONAS: Persona[] = [
  {
    key: "comprador_decidido",
    label: "Paciente decidido",
    description: "Sabe qué necesita y quiere agendar su cita de una vez.",
    phone: "5210000000001",
    contactName: "[Prueba] Paciente decidido",
    script: [
      "Buenas tardes",
      "Quiero una cita para una limpieza dental, por favor",
      "El jueves a las 16:00 me queda bien",
      "Perfecto, quedo atento a la confirmación. Gracias",
    ],
  },
  {
    key: "pregunton_precios",
    label: "Paciente que pregunta precios",
    description: "Pregunta cuánto cuesta cada tratamiento sin decidirse.",
    phone: "5210000000002",
    contactName: "[Prueba] Pregunta precios",
    script: [
      "Hola, ¿cuánto cuesta un blanqueamiento?",
      "¿Y los brackets?",
      "¿Y las carillas? ¿Cuánto salen?",
      "¿No me puede dar ningún precio por aquí?",
      "Ok, lo voy a pensar y le aviso",
    ],
  },
  {
    key: "cliente_enojado",
    label: "Paciente molesto",
    description: "Llega molesto por un dolor o una molestia tras un tratamiento.",
    phone: "5210000000003",
    contactName: "[Prueba] Paciente molesto",
    script: [
      "Oiga, esto es el colmo",
      "Me hicieron una extracción la semana pasada y todavía me duele horrible, quedó mal la muela",
      "¿Me van a responder o qué? Quiero una solución ya",
      "Pues espero que sí porque no pienso aguantar este dolor",
    ],
  },
  {
    key: "fuera_de_kb",
    label: "Pregunta fuera del conocimiento",
    description: "Pregunta algo que el knowledge base no cubre (fuera_de_kb).",
    phone: "5210000000004",
    contactName: "[Prueba] Fuera del conocimiento",
    script: [
      "Hola, una pregunta",
      "¿Qué seguros dentales aceptan?",
      "¿Trabajan con el seguro del IESS o con alguna aseguradora privada?",
      "¿Dónde puedo revisar qué convenios tienen?",
    ],
  },
  {
    key: "pide_humano",
    label: "Pide hablar con la doctora",
    description: "Quiere ser atendido por la doctora o una persona (debe escalar).",
    phone: "5210000000005",
    contactName: "[Prueba] Pide hablar con la doctora",
    script: [
      "Hola",
      "Tengo un asunto con mi tratamiento y quiero hablarlo directamente",
      "Prefiero hablar con la doctora, ¿me puede comunicar con ella?",
      "Gracias",
    ],
  },
  {
    key: "errores_modismos",
    label: "Errores y modismos",
    description: "Escribe con faltas de ortografía y modismos ecuatorianos.",
    phone: "5210000000006",
    contactName: "[Prueba] Errores y modismos",
    script: [
      "ola, kiero ver si me sangra la muela, me duele arto",
      "no sé si será la guagua o qué, toy con miedo",
      "cuanto sale si me hace atender hoy?",
      "dale, deme turno y ya voy pue",
    ],
  },
];

export const PERSONA_LABELS: Record<string, string> = Object.fromEntries(
  PERSONAS.map((p) => [p.key, p.label])
);
