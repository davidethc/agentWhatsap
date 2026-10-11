import { describe, expect, it } from "vitest"

import { claveDia } from "@/lib/dominio/fechas"

import { esquemaClinicos, esquemaConsentimiento } from "./esquema"

describe("esquemaClinicos", () => {
  it("vacío se guarda como sin dato", () => {
    const r = esquemaClinicos.parse({ alergias: "  ", enfermedades: "", embarazo: "", miedo: "" })
    expect(r).toEqual({ alergias: null, enfermedades: null, embarazo: null, miedo: null })
  })
  it("recorta el texto y convierte embarazo a verdadero/falso", () => {
    expect(esquemaClinicos.parse({ alergias: " Penicilina ", enfermedades: "Asma", embarazo: "si", miedo: "Agujas" })).toEqual({
      alergias: "Penicilina",
      enfermedades: "Asma",
      embarazo: true,
      miedo: "Agujas",
    })
    expect(esquemaClinicos.parse({ embarazo: "no" }).embarazo).toBe(false)
  })
  it("rechaza textos demasiado largos y valores raros de embarazo", () => {
    expect(esquemaClinicos.safeParse({ alergias: "a".repeat(1001) }).error?.issues[0]?.message).toMatch(/demasiado largo/)
    expect(esquemaClinicos.safeParse({ embarazo: "tal vez" }).success).toBe(false)
  })
})

describe("esquemaConsentimiento", () => {
  it("acepta hoy y días pasados", () => {
    expect(esquemaConsentimiento.safeParse({ fecha: claveDia(new Date()) }).success).toBe(true)
    expect(esquemaConsentimiento.safeParse({ fecha: "2026-01-05" }).success).toBe(true)
  })
  it("rechaza futura, vacía o con mal formato", () => {
    expect(esquemaConsentimiento.safeParse({ fecha: "2999-01-01" }).error?.issues[0]?.message).toMatch(/futura/)
    expect(esquemaConsentimiento.safeParse({ fecha: "" }).success).toBe(false)
    expect(esquemaConsentimiento.safeParse({ fecha: "05/01/2026" }).success).toBe(false)
  })
})
