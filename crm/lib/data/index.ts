import "server-only"

import { connection } from "next/server"

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
  // Todo acceso a datos es por petición (sesión, hora actual): nunca se prerenderiza. Sin esto, Next
  // avisa «Date.now() while prerendering» porque el cliente de Supabase mira la hora al leer la sesión.
  await connection()
  if (process.env.ELI_DATOS === "falso") return (falso ??= crearDatosFalsos())
  return crearDatosSupabase(await createClient())
}
