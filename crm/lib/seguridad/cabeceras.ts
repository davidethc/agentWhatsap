/**
 * Cabeceras de seguridad del panel (datos de salud). Se aplican a todas las rutas desde next.config.ts.
 * Función pura para poder probarla; no importa nada de la app (next.config.ts la carga con ruta relativa).
 */

export type Cabecera = { key: string; value: string }

/** Origen https/http y el de websocket (Realtime) de la URL de Supabase. */
export function origenesDeSupabase(url: string | undefined): [string, string] {
  try {
    const u = new URL(url ?? "")
    const ws = u.protocol === "https:" ? "wss:" : "ws:"
    return [u.origin, `${ws}//${u.host}`]
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"]
  }
}

export function cabecerasDeSeguridad({
  supabaseUrl,
  desarrollo,
}: {
  supabaseUrl: string | undefined
  desarrollo: boolean
}): Cabecera[] {
  const [http, ws] = origenesDeSupabase(supabaseUrl)

  const csp = [
    "default-src 'self'",
    // Next inserta scripts y estilos en línea (hidratación, Tailwind, gráficos). En desarrollo,
    // Turbopack necesita eval.
    `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${http} ${ws}${desarrollo ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
  ]
}
