import { addMinutes } from "date-fns"
import { z } from "zod"

import { claveDia, hora } from "@/lib/dominio/fechas"

export const DURACIONES = [
  { minutos: 30, etiqueta: "30 minutos", porDefecto: false },
  { minutos: 45, etiqueta: "45 minutos", porDefecto: false },
  { minutos: 60, etiqueta: "1 hora", porDefecto: true },
  { minutos: 90, etiqueta: "1 hora y media", porDefecto: false },
  { minutos: 120, etiqueta: "2 horas", porDefecto: false },
] as const

/** Servicios de ejemplo para sugerir (se puede escribir otro). */
export const SERVICIOS = ["Valoración", "Limpieza", "Control", "Resina", "Extracción", "Ortodoncia", "Blanqueamiento"]

/** «2026-10-12» + «09:30» (hora de Guayaquil, UTC-5 todo el año) → instante ISO. */
export function aInstante(fecha: string, horaLocal: string): string {
  return new Date(`${fecha}T${horaLocal}:00-05:00`).toISOString()
}

/** Instante → fecha y hora de Guayaquil, para llenar el formulario al editar. */
export function partesLocales(iso: string): { fecha: string; hora: string } {
  return { fecha: claveDia(iso), hora: hora(iso) }
}

export function terminaEn(inicioIso: string, minutos: number): string {
  return addMinutes(new Date(inicioIso), minutos).toISOString()
}

export const esquemaCita = z.object({
  pacienteId: z.number({ error: "Elige el paciente" }).int().positive("Elige el paciente"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora"),
  duracion: z.number().int().min(15).max(480),
  servicio: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(80, "El servicio es muy largo").nullable().optional().default(null)
  ),
})
export type CitaForm = z.input<typeof esquemaCita>
export type CitaValida = z.output<typeof esquemaCita>
