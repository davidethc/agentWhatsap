import { describe, expect, it, vi } from "vitest"

import { obtenerDatos } from "./index"

const orden: string[] = []

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({
  connection: async () => {
    orden.push("connection")
  },
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    orden.push("createClient")
    return { from: () => ({}), rpc: () => ({}) }
  },
}))

/**
 * Regresión de F-1 (login intermitente): el cliente de Supabase lee la hora al cargar la sesión
 * (`Date.now()` en `__loadSession`). Si eso pasa mientras Next prerenderiza la página, el render falla y
 * el login puede quedarse en «Entrando…». Por eso `obtenerDatos()` debe esperar `connection()`
 * (acceso dinámico) ANTES de crear el cliente.
 */
describe("obtenerDatos", () => {
  it("espera connection() antes de crear el cliente de Supabase", async () => {
    await obtenerDatos()
    expect(orden).toEqual(["connection", "createClient"])
  })
})
