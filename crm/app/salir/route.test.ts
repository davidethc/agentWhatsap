import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const signOut = vi.fn(async () => ({ error: null }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }))

import { GET, POST } from "./route"

const pedir = (metodo: string, ruta = "/salir", cabeceras: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3150${ruta}`, { method: metodo, headers: cabeceras })

describe("/salir (S-2)", () => {
  beforeEach(() => signOut.mockClear())

  it("GET NO cierra la sesión y solo manda al login", async () => {
    const r = await GET(pedir("GET"))
    expect(signOut).not.toHaveBeenCalled()
    expect(r.status).toBe(303)
    expect(new URL(r.headers.get("location")!).pathname).toBe("/login")
  })

  it("POST cierra la sesión y vuelve al login", async () => {
    const r = await POST(pedir("POST", "/salir", { origin: "http://localhost:3150" }))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(r.status).toBe(303)
    expect(new URL(r.headers.get("location")!).pathname).toBe("/login")
  })

  it("POST sin cabecera Origin (formulario del mismo sitio) también funciona", async () => {
    await POST(pedir("POST"))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("POST desde otro sitio se rechaza y no cierra la sesión", async () => {
    const r = await POST(pedir("POST", "/salir", { origin: "https://otro-sitio.example" }))
    expect(r.status).toBe(403)
    expect(signOut).not.toHaveBeenCalled()
  })

  it("conserva el aviso de «sin acceso» en el login", async () => {
    const r = await POST(pedir("POST", "/salir?error=sin-acceso"))
    expect(new URL(r.headers.get("location")!).search).toBe("?error=sin-acceso")
  })
})
