import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/** Cierra la sesión y vuelve al login (un Route Handler sí puede borrar cookies). */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const destino = new URL("/login", request.url)
  const error = request.nextUrl.searchParams.get("error")
  if (error === "sin-acceso") destino.searchParams.set("error", error)
  return NextResponse.redirect(destino)
}
