import type { EstadoCita, Etapa, MotivoPerdido, OrigenPaciente } from "@/lib/data/tipos"

/** Textos para la doctora (sin jerga). Un solo lugar. */
export const ETAPA: Record<Etapa, string> = {
  nuevo: "Nuevo",
  conversando: "Conversando",
  agendo: "Agendó",
  asistio: "Asistió",
  seguimiento: "Seguimiento",
  perdido: "Perdido",
}

export const MOTIVO_PERDIDO: Record<MotivoPerdido, string> = {
  no_respondio: "No respondió",
  indeciso: "Indeciso",
  no_asistio: "No asistió",
}

export const ESTADO_CITA: Record<EstadoCita, string> = {
  agendada: "Agendada",
  asistio: "Asistió",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
}

export const ORIGEN_PACIENTE: Record<OrigenPaciente, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  presencial: "Presencial",
  referido: "Referido",
}
