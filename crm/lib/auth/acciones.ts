"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

import { esquemaLogin } from "./esquema"
import { SIN_ACCESO, SIN_RED } from "./mensajes"

export type EstadoLogin = {
  error?: string
  campos?: { correo?: string; clave?: string }
  correo?: string
} | null


/** Server Action del formulario de login (funciona incluso antes de que cargue JS). */
export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const correoCrudo = String(formData.get("correo") ?? "")
  const validado = esquemaLogin.safeParse({
    correo: correoCrudo,
    clave: String(formData.get("clave") ?? ""),
  })
  if (!validado.success) {
    const campos = validado.error.flatten().fieldErrors
    return {
      correo: correoCrudo,
      campos: { correo: campos.correo?.[0], clave: campos.clave?.[0] },
    }
  }

  const supabase = await createClient()
  let error
  let userId: string | undefined
  try {
    const respuesta = await supabase.auth.signInWithPassword({
      email: validado.data.correo,
      password: validado.data.clave,
    })
    error = respuesta.error
    userId = respuesta.data.user?.id
  } catch {
    return { correo: validado.data.correo, error: SIN_RED }
  }
  if (error) {
    const sinRed = !error.status // 0 o indefinido: no hubo respuesta del servidor
    return {
      correo: validado.data.correo,
      error: sinRed ? SIN_RED : "Correo o clave incorrectos. Revisa y vuelve a intentar.",
    }
  }

  // Tener cuenta no basta: debe estar en `personal` (si no, RLS devuelve 0 filas).
  const { data: fila } = await supabase.from("personal")
    .select("user_id")
    .eq("user_id", userId ?? "")
    .maybeSingle()
  if (!fila) {
    await supabase.auth.signOut()
    return { correo: validado.data.correo, error: SIN_ACCESO }
  }
  redirect("/")
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
