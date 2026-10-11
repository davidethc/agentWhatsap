// Validación del contrato Eli → CRM (docs/crm/plan.md §5). Sin dependencias: se puede probar aparte.

export type TipoEvento = "mensaje_entrante" | "mensaje_saliente" | "cita_reservada";

const CAMPOS: Record<TipoEvento, { obligatorios: string[]; opcionales: string[]; fechas: string[] }> = {
  mensaje_entrante: {
    obligatorios: ["telefono", "message_id"],
    opcionales: ["nombre_whatsapp", "en"],
    fechas: ["en"],
  },
  mensaje_saliente: {
    obligatorios: ["telefono", "execution_id"],
    opcionales: ["en"],
    fechas: ["en"],
  },
  cita_reservada: {
    obligatorios: ["telefono", "gcal_event_id", "inicio"],
    opcionales: ["fin", "servicio", "nombre"],
    fechas: ["inicio", "fin"],
  },
};

export type Resultado =
  | { ok: true; evento: Record<string, string> & { tipo: TipoEvento } }
  | { ok: false; error: string };

/** Comprueba la forma del evento. Solo deja pasar los campos del contrato, como cadenas. */
export function validarEvento(cuerpo: unknown): Resultado {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, error: "El cuerpo debe ser un objeto JSON" };
  }
  const c = cuerpo as Record<string, unknown>;
  // El CRM no guarda el contenido de los mensajes (TK-41): se rechaza para que nadie crea que se guarda.
  if ("texto" in c) {
    return { ok: false, error: "texto ya no se acepta: el CRM no guarda el contenido de los mensajes" };
  }
  const tipo = c.tipo;
  if (typeof tipo !== "string" || !(tipo in CAMPOS)) {
    return { ok: false, error: "tipo debe ser mensaje_entrante, mensaje_saliente o cita_reservada" };
  }
  const reglas = CAMPOS[tipo as TipoEvento];
  const evento: Record<string, string> = { tipo };

  for (const campo of [...reglas.obligatorios, ...reglas.opcionales]) {
    let valor = c[campo];
    if (valor === undefined || valor === null || valor === "") {
      if (reglas.obligatorios.includes(campo)) return { ok: false, error: `Falta el campo ${campo}` };
      continue;
    }
    // execution_id de n8n puede venir como número.
    if (typeof valor === "number" && campo === "execution_id") valor = String(valor);
    if (typeof valor !== "string") return { ok: false, error: `${campo} debe ser una cadena` };
    if (reglas.fechas.includes(campo) && Number.isNaN(Date.parse(valor))) {
      return { ok: false, error: `${campo} debe ser una fecha ISO 8601` };
    }
    evento[campo] = valor;
  }
  return { ok: true, evento: evento as Record<string, string> & { tipo: TipoEvento } };
}

/** Compara el secreto en tiempo constante. */
export function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = new TextEncoder().encode(recibido);
  const b = new TextEncoder().encode(esperado);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
