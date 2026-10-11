"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { obtenerDatos } from "@/lib/data"
import { esquemaDatosBasicos, esquemaNuevoPaciente } from "@/lib/pacientes/esquema"
import { ETAPAS, MOTIVOS_PERDIDO, type Paciente } from "@/lib/data/tipos"

import { ejecutar, type Resultado } from "./resultado"

const esquemaMover = z
  .object({
    pacienteId: z.number().int().positive(),
    etapa: z.enum(ETAPAS),
    motivo: z.enum(MOTIVOS_PERDIDO).optional(),
  })
  .refine((v) => v.etapa !== "perdido" || v.motivo, { message: "Elige el motivo por el que se perdió." })

export async function moverEtapaAccion(entrada: z.input<typeof esquemaMover>): Promise<Resultado<Paciente>> {
  const v = esquemaMover.safeParse(entrada)
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => {
    const datos = await obtenerDatos()
    return datos.pacientes.moverEtapa(v.data.pacienteId, v.data.etapa, v.data.motivo)
  })
  if (r.ok) revalidatePath("/", "layout")
  return r
}

const esquemaActualizar = z.object({ id: z.number().int().positive(), datos: z.unknown() })

/** Edita nombre, cédula, nacimiento y correo (se valida otra vez en el servidor). */
export async function actualizarPacienteAccion(entrada: { id: number; datos: unknown }): Promise<Resultado<Paciente>> {
  const e = esquemaActualizar.safeParse(entrada)
  const d = esquemaDatosBasicos.safeParse(e.data?.datos)
  if (!e.success || !d.success) return { ok: false, error: d.error?.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => (await obtenerDatos()).pacientes.actualizar(e.data.id, d.data))
  if (r.ok) revalidatePath("/", "layout")
  return r
}

const esquemaCrear = z.object({ datos: z.unknown(), responsableId: z.number().int().positive().optional() })

export type PacienteCreado = { duplicado: boolean; paciente: { id: number; nombre: string } }

/**
 * Crea un paciente. Si el teléfono ya existe devuelve `duplicado: true` con el titular (no crea nada).
 * Con `responsableId` crea un dependiente (comparte el teléfono del responsable).
 */
export async function crearPacienteAccion(entrada: { datos: unknown; responsableId?: number }): Promise<Resultado<PacienteCreado>> {
  const e = esquemaCrear.safeParse(entrada)
  const d = esquemaNuevoPaciente.safeParse(e.data?.datos)
  if (!e.success || !d.success) return { ok: false, error: d.error?.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => {
    const datos = await obtenerDatos()
    const res = await datos.pacientes.crear({
      nombre: d.data.nombre,
      origen: d.data.origen,
      telefono: e.data.responsableId ? undefined : (d.data.telefono ?? undefined),
      cedula: d.data.cedula ?? undefined,
      fechaNacimiento: d.data.fechaNacimiento ?? undefined,
      correo: d.data.correo ?? undefined,
      responsableId: e.data.responsableId,
    })
    return { duplicado: res.duplicado, paciente: { id: res.paciente.id, nombre: res.paciente.nombre } }
  })
  if (r.ok && !r.datos.duplicado) revalidatePath("/", "layout")
  return r
}
