"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { obtenerDatos } from "@/lib/data"
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
