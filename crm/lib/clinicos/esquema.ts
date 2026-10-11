import { z } from "zod"

import { claveDia } from "@/lib/dominio/fechas"

const texto = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(1000, "El texto es demasiado largo (máximo 1000 letras)").nullable().optional().default(null)
)

/** Embarazo en el formulario: "" = sin dato, "si", "no". Se guarda como true / false / null. */
const embarazo = z
  .preprocess((v) => (v === undefined || v === null ? "" : v), z.enum(["", "si", "no"], { error: "Elige una opción" }))
  .transform((v) => (v === "" ? null : v === "si"))

export const esquemaClinicos = z.object({
  alergias: texto,
  enfermedades: texto,
  embarazo,
  miedo: texto,
})
export type ClinicosForm = z.input<typeof esquemaClinicos>
export type ClinicosValidos = z.output<typeof esquemaClinicos>

export const esquemaConsentimiento = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha en que el paciente firmó")
    .refine((f) => f <= claveDia(new Date()), "La fecha de la firma no puede ser futura"),
})
export type ConsentimientoForm = z.input<typeof esquemaConsentimiento>
