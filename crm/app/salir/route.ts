import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/** Mismo origen: el navegador manda `Origin` en los POST; si viene de otro sitio, no se cierra la sesión. */
function esMismoOrigen(request: NextRequest): boolean {
  const origen = request.headers.get("origin")
  return origen === null || origen === request.nextUrl.origin
}

/**
 * Cerrar sesión SOLO por POST (como `cerrarSesion`). Un GET no cambia nada: así otra página no puede
 * cerrarle la sesión a la doctora con un enlace o una imagen (S-2). Un Route Handler sí puede borrar cookies.
 */
export async function POST(request: NextRequest) {
  if (!esMismoOrigen(request)) return new NextResponse("Origen no permitido", { status: 403 })
  const supabase = await createClient()
  await supabase.auth.signOut()
  const destino = new URL("/login", request.url)
  if (request.nextUrl.searchParams.get("error") === "sin-acceso") destino.searchParams.set("error", "sin-acceso")
  // 303: el navegador pide /login con GET.
  return NextResponse.redirect(destino, 303)
}

/** GET no cierra sesión: solo lleva al login (un enlace viejo a /salir no hace daño). */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url), 303)
}
