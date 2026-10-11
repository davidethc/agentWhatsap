import "server-only"

import { createClient } from "@/lib/supabase/server"

import { crearDatosFalsos } from "./falso"
import type { Datos } from "./interfaz"
import { crearDatosSupabase } from "./supabase"

export { ErrorDatos } from "./interfaz"
export type { Datos } from "./interfaz"
export * from "./tipos"

let falso: Datos | undefined

/**
 * Punto de entrada para Server Components y Server Actions.
 * `ELI_DATOS=falso` (en .env.local) usa datos inventados en memoria, sin Supabase.
 */
export async function obtenerDatos(): Promise<Datos> {
  if (process.env.ELI_DATOS === "falso") return (falso ??= crearDatosFalsos())
  return crearDatosSupabase(await createClient())
}
