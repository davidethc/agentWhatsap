import { createBrowserClient } from "@supabase/ssr"

import { supabaseEnv } from "./env"

/** Cliente del navegador (componentes "use client", p. ej. tiempo real). */
export function createClient() {
  const { url, key } = supabaseEnv()
  return createBrowserClient(url, key)
}
