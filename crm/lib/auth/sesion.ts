import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type Personal = { userId: string; nombre: string; rol: "doctora" | "admin" }

/**
 * Persona con sesión Y registrada en la tabla `personal`.
 * Valida con getClaims() (firma del token). Si no cumple, manda a /login.
 */
export async function requerirPersonal(): Promise<Personal> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect("/login")

  const { data: fila } = await supabase
    .from("personal")
    .select("nombre, rol")
    .eq("user_id", userId)
    .maybeSingle()

  // Una Server Component no puede borrar cookies: /salir cierra la sesión y vuelve al login.
  if (!fila) redirect("/salir?error=sin-acceso")
  return { userId, nombre: fila.nombre, rol: fila.rol }
}
