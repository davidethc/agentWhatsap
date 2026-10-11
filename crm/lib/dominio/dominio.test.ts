import { describe, expect, it } from "vitest"

import { claveDia, finDelDia, hora, inicioDeSemana, inicioDelDia } from "./fechas"
import { formatearTelefono, normalizarTelefono } from "./telefono"

describe("normalizarTelefono", () => {
  it.each([
    ["0991234567", "593991234567"],
    ["099 123 4567", "593991234567"],
    ["+593 99 123 4567", "593991234567"],
    ["00593991234567", "593991234567"],
    ["991234567", "593991234567"],
    ["042345678", "59342345678"],
  ])("%s → %s", (entrada, esperado) => expect(normalizarTelefono(entrada)).toBe(esperado))
  it("vacío → null", () => expect(normalizarTelefono("  ")).toBeNull())
  it("inválido lanza sin mostrar el número", () => {
    expect(() => normalizarTelefono("12345")).toThrow("Teléfono no válido")
  })
})

describe("formatearTelefono", () => {
  it("formatea y maneja null", () => {
    expect(formatearTelefono("593991234567")).toBe("+593 99 123 4567")
    expect(formatearTelefono(null)).toBe("Sin teléfono")
  })
})

describe("fechas (America/Guayaquil, UTC-5)", () => {
  const t = "2026-10-11T03:30:00Z" // sáb 10 oct 22:30 en Guayaquil
  it("el día es el de Guayaquil, no el UTC", () => {
    expect(claveDia(t)).toBe("2026-10-10")
    expect(inicioDelDia(t).toISOString()).toBe("2026-10-10T05:00:00.000Z")
    expect(finDelDia(t).toISOString()).toBe("2026-10-11T04:59:59.999Z")
  })
  it("hora local", () => expect(hora("2026-10-10T14:00:00Z")).toBe("09:00"))
  it("la semana empieza el lunes", () => {
    expect(claveDia(inicioDeSemana(t))).toBe("2026-10-05")
  })
})
