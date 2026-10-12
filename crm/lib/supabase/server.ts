import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { supabaseEnv } from "./env"

/** Cliente del servidor (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  const { url, key } = supabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Llamado desde un Server Component: no se pueden escribir cookies.
          // El proxy ya refresca la sesión, así que se ignora.
        }
      },
    },
  })
}
