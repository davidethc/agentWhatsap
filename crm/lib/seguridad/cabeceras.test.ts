import { describe, expect, it } from "vitest"

import { cabecerasDeSeguridad, origenesDeSupabase } from "./cabeceras"

const valor = (c: { key: string; value: string }[], k: string) => c.find((h) => h.key === k)?.value

describe("origenesDeSupabase", () => {
  it("https → https y wss (realtime)", () => {
    expect(origenesDeSupabase("https://abc.supabase.co/")).toEqual(["https://abc.supabase.co", "wss://abc.supabase.co"])
  })
  it("http local → http y ws, con puerto", () => {
    expect(origenesDeSupabase("http://127.0.0.1:55321")).toEqual(["http://127.0.0.1:55321", "ws://127.0.0.1:55321"])
  })
  it("sin URL (o no válida) permite solo los dominios de Supabase", () => {
    expect(origenesDeSupabase(undefined)).toEqual(["https://*.supabase.co", "wss://*.supabase.co"])
    expect(origenesDeSupabase("no es una url")).toEqual(["https://*.supabase.co", "wss://*.supabase.co"])
  })
})

describe("cabecerasDeSeguridad", () => {
  const prod = cabecerasDeSeguridad({ supabaseUrl: "https://abc.supabase.co", desarrollo: false })
  const csp = valor(prod, "Content-Security-Policy")!

  it("incluye las cabeceras pedidas", () => {
    expect(valor(prod, "X-Frame-Options")).toBe("DENY")
    expect(valor(prod, "X-Content-Type-Options")).toBe("nosniff")
    expect(valor(prod, "Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(valor(prod, "Permissions-Policy")).toMatch(/camera=\(\)/)
    expect(valor(prod, "Permissions-Policy")).toMatch(/microphone=\(\)/)
    expect(valor(prod, "Permissions-Policy")).toMatch(/geolocation=\(\)/)
  })
  it("la CSP prohíbe ser embebido, objetos y base ajena, y abre Supabase por https y wss", () => {
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co")
  })
  it("en producción no permite eval; en desarrollo sí (Turbopack) y deja el websocket de recarga", () => {
    expect(csp).not.toContain("'unsafe-eval'")
    const dev = valor(cabecerasDeSeguridad({ supabaseUrl: "http://127.0.0.1:55321", desarrollo: true }), "Content-Security-Policy")!
    expect(dev).toContain("'unsafe-eval'")
    expect(dev).toMatch(/connect-src[^;]*ws:/)
  })
})
