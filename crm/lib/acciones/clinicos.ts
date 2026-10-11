"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { obtenerDatos } from "@/lib/data"
import type { DatosClinicos, Paciente } from "@/lib/data/tipos"
import { esquemaClinicos, esquemaConsentimiento } from "@/lib/clinicos/esquema"

import { ejecutar, type Resultado } from "./resultado"

const esquemaId = z.number().int().positive()

/** Marca el consentimiento firmado con la fecha elegida (no puede ser futura). */
export async function marcarConsentimientoAccion(entrada: { id: number; fecha: string }): Promise<Resultado<Paciente>> {
  const id = esquemaId.safeParse(entrada.id)
  const f = esquemaConsentimiento.safeParse({ fecha: entrada.fecha })
  if (!id.success || !f.success) return { ok: false, error: f.error?.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => (await obtenerDatos()).pacientes.marcarConsentimiento(id.data, f.data.fecha))
  if (r.ok) revalidatePath("/", "layout")
  return r
}

/** Guarda alergias, enfermedades, embarazo y miedo. La base rechaza si falta el consentimiento. */
export async function guardarClinicosAccion(entrada: { id: number; datos: unknown }): Promise<Resultado<DatosClinicos>> {
  const id = esquemaId.safeParse(entrada.id)
  const d = esquemaClinicos.safeParse(entrada.datos)
  if (!id.success || !d.success) return { ok: false, error: d.error?.issues[0]?.message ?? "Datos no válidos" }
  const r = await ejecutar(async () => (await obtenerDatos()).pacientes.guardarClinicos(id.data, d.data))
  if (r.ok) revalidatePath("/", "layout")
  return r
}
