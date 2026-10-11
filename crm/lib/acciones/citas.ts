"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { obtenerDatos } from "@/lib/data"

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
