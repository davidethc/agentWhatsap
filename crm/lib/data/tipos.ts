/**
 * Tipos del dominio que ve la interfaz (en camelCase, sin detalles de Postgres).
 *
 * Las filas crudas salen de `database.types.ts` (generado por la base). Estos tipos del dominio son
 * el contrato con las pantallas.
 */

export const ETAPAS = ["nuevo", "conversando", "agendo", "asistio", "seguimiento", "perdido"] as const
export type Etapa = (typeof ETAPAS)[number]

export const MOTIVOS_PERDIDO = ["no_respondio", "indeciso", "no_asistio"] as const
export type MotivoPerdido = (typeof MOTIVOS_PERDIDO)[number]

export type EstadoCita = "agendada" | "asistio" | "no_asistio" | "cancelada"
export type OrigenPaciente = "whatsapp" | "llamada" | "presencial" | "referido"
export type OrigenCita = "eli" | "panel" | "calendario"

export type Paciente = {
  id: number
  nombre: string
  /** Normalizado 593…; null si no tiene teléfono. */
  telefono: string | null
  conversacionId: number | null
  responsableId: number | null
  cedula: string | null
  /** yyyy-MM-dd */
  fechaNacimiento: string | null
  correo: string | null
  origen: OrigenPaciente
  etapa: Etapa
  motivoPerdido: MotivoPerdido | null
  /** yyyy-MM-dd: cuándo la doctora quiere volver a verlo. */
  volverEl: string | null
  consentimientoFirmadoEn: string | null
  etapaCambiadaEn: string
}

export type Cita = {
  id: number
  pacienteId: number | null
  pacienteNombre: string | null
  /** ISO 8601 (UTC). */
  iniciaEn: string
  terminaEn: string
  servicio: string | null
  estado: EstadoCita
  origen: OrigenCita
  sync: "ok" | "pendiente" | "error"
}

export type CambioEtapa = {
  id: number
  de: Etapa | null
  a: Etapa
  motivoPerdido: MotivoPerdido | null
  actor: "personal" | "eli" | "sistema" | "calendario"
  en: string
}

export type DatosClinicos = {
  alergias: string | null
  enfermedades: string | null
  embarazo: boolean | null
  miedo: string | null
}

export type Mensaje = {
  id: number
  direccion: "entrante" | "saliente"
  texto: string
  enviadoEn: string
}

/** Todo lo que muestra la ficha del paciente. */
export type FichaPaciente = {
  paciente: Paciente
  responsable: Pick<Paciente, "id" | "nombre"> | null
  dependientes: Pick<Paciente, "id" | "nombre">[]
  datosClinicos: DatosClinicos | null
  citas: Cita[]
  historial: CambioEtapa[]
}

/** Resumen del día (lo que devuelve la función `resumen_del_dia`, en camelCase). */
export type Resumen = {
  /** yyyy-MM-dd */
  fecha: string
  semana: { desde: string; hasta: string }
  /** Por hora; incluye las canceladas (la pantalla decide cómo mostrarlas). */
  citasHoy: Cita[]
  tarjetas: {
    /** Sin canceladas. */
    citasHoy: number
    nuevosHoy: number
    nuevosSemana: number
    agendadasSemana: number
    inasistenciasSemana: number
  }
  /** Pacientes nuevos por día de la semana (lunes a domingo). */
  nuevosPorDia: { dia: string; nuevos: number }[]
  /** Por origen del paciente. */
  canales: { origen: OrigenPaciente; nuevos: number; agendadas: number; inasistencias: number }[]
  cumpleanosHoy: Cumpleanos[]
  /** Incluye los de hoy. */
  cumpleanosSemana: Cumpleanos[]
  retornos: { id: number; nombre: string; etapa: Etapa; volverEl: string }[]
}

export type Cumpleanos = {
  id: number
  nombre: string
  fechaNacimiento: string
  /** yyyy-MM-dd: el día de esta semana en que cumple. */
  cumple: string
}

// ───────────────────────── entradas ─────────────────────────

export type NuevoPaciente = {
  nombre: string
  origen: OrigenPaciente
  telefono?: string
  cedula?: string
  fechaNacimiento?: string
  correo?: string
  /** Para crear un dependiente de otro paciente. */
  responsableId?: number
}

export type ResultadoCrearPaciente = {
  /** true = el teléfono ya existía: `paciente` es el titular existente y no se creó nada. */
  duplicado: boolean
  paciente: Paciente
}

export type EntradaCita = {
  pacienteId: number
  iniciaEn: string
  /** Por defecto, 1 hora después. */
  terminaEn?: string
  servicio?: string
  /** Si viene, se edita esa cita en vez de crear otra. */
  citaId?: number
}

export type FiltroPacientes = {
  /** Busca por nombre o teléfono. */
  texto?: string
}
