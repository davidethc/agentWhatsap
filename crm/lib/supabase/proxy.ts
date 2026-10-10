import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { supabaseEnv } from "./env"

const RUTAS_PUBLICAS = ["/login"]

/**
 * Refresca la sesión y aplica la regla de acceso:
 * sin sesión → /login; con sesión en /login → /.
 * Usa getClaims() (valida la firma del token), no getSession().
 */
export async function actualizarSesion(request: NextRequest) {
  const { url, key } = supabaseEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const haySesion = Boolean(data?.claims)
  const { pathname } = request.nextUrl
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (!haySesion && !esPublica) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/login"
    destino.search = ""
    return NextResponse.redirect(destino)
  }
  if (haySesion && esPublica) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/"
    destino.search = ""
    return NextResponse.redirect(destino)
  }
  return response
}
