import { z } from "zod"

import { claveDia } from "@/lib/dominio/fechas"
import { normalizarTelefono } from "@/lib/dominio/telefono"

/** Texto opcional: el campo vacío se guarda como null. */
const opcional = <T extends z.ZodType<string>>(esquema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), esquema.nullable().optional().default(null))

const HOY = () => claveDia(new Date())

export const esquemaDatosBasicos = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del paciente"),
  cedula: opcional(
    z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, "La cédula debe tener entre 5 y 20 letras o números")
  ),
  fechaNacimiento: opcional(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida")
      .refine((f) => f <= HOY(), "La fecha de nacimiento no puede ser futura")
  ),
  correo: opcional(z.string().trim().email("Escribe un correo válido, por ejemplo nombre@correo.com")),
})
export type DatosBasicosForm = z.input<typeof esquemaDatosBasicos>
export type DatosBasicosValidos = z.output<typeof esquemaDatosBasicos>

/** Orígenes que se eligen a mano: WhatsApp lo pone Eli sola. */
export const ORIGENES_MANUALES = ["llamada", "presencial", "referido"] as const

export const esquemaNuevoPaciente = esquemaDatosBasicos.extend({
  origen: z.enum(ORIGENES_MANUALES, { error: "Elige cómo llegó el paciente" }),
  telefono: opcional(
    z.string().refine((t) => {
      try {
        return normalizarTelefono(t) !== null
      } catch {
        return false
      }
    }, "El teléfono no es válido. Ejemplo: 0991234567")
  ),
})
export type NuevoPacienteForm = z.input<typeof esquemaNuevoPaciente>
export type NuevoPacienteValido = z.output<typeof esquemaNuevoPaciente>
