"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { aInstante, esquemaCita, terminaEn } from "@/lib/citas/esquema"
import { obtenerDatos } from "@/lib/data"
import type { Cita } from "@/lib/data/tipos"

import { ejecutar, type Resultado } from "./resultado"

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")

const esquemaAsistencia = z.object({
  citaId: z.number().int().positive(),
  asistio: z.boolean(),
  /** Solo si asistió: fecha, o null = sin retorno. */
  volverEl: fecha.nullable(),
})

export async function marcarAsistenciaAccion(entrada: z.input<typeof esquemaAsistencia>): Promise<Resultado> {
  const v = esquemaAsistencia.safeParse(entrada)
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => {
    const datos = await obtenerDatos()
    await datos.citas.marcarAsistencia(v.data.citaId, v.data.asistio, v.data.asistio ? v.data.volverEl : undefined)
  })
  if (r.ok) revalidatePath("/", "layout")
  return r.ok ? { ok: true, datos: undefined } : r
}

const esquemaGuardar = z.object({ citaId: z.number().int().positive().optional(), datos: z.unknown() })

/** Crea una cita (o edita una agendada). El horario y los choques los valida la base. */
export async function guardarCitaAccion(entrada: { citaId?: number; datos: unknown }): Promise<Resultado<Cita>> {
  const e = esquemaGuardar.safeParse(entrada)
  const d = esquemaCita.safeParse(e.data?.datos)
  if (!e.success || !d.success) return { ok: false, error: d.error?.issues[0]?.message ?? "Datos no válidos" }
  const iniciaEn = aInstante(d.data.fecha, d.data.hora)
  const r = await ejecutar(async () =>
    (await obtenerDatos()).citas.guardar({
      citaId: e.data.citaId,
      pacienteId: d.data.pacienteId,
      iniciaEn,
      terminaEn: terminaEn(iniciaEn, d.data.duracion),
      servicio: d.data.servicio ?? undefined,
    })
  )
  if (r.ok) revalidatePath("/", "layout")
  return r
}

export async function cancelarCitaAccion(citaId: number): Promise<Resultado<Cita>> {
  const v = z.number().int().positive().safeParse(citaId)
  if (!v.success) return { ok: false, error: "Cita no válida" }
  const r = await ejecutar(async () => (await obtenerDatos()).citas.cancelar(v.data))
  if (r.ok) revalidatePath("/", "layout")
  return r
}
