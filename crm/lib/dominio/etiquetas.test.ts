import { describe, expect, it } from "vitest"

import { ETAPAS } from "@/lib/data/tipos"

import { ESTADO_CITA, ETAPA, MOTIVO_PERDIDO, ORIGEN_PACIENTE } from "./etiquetas"
import { fechaVolverEn, OPCIONES_VOLVER_EN } from "./retorno"

describe("etiquetas en español", () => {
  it("cada etapa tiene nombre", () => {
    expect(ETAPAS.map((e) => ETAPA[e])).toEqual([
      "Nuevo", "Conversando", "Agendó", "Asistió", "Seguimiento", "Perdido",
    ])
  })
  it("motivos, estados y orígenes", () => {
    expect(MOTIVO_PERDIDO.no_respondio).toBe("No respondió")
    expect(ESTADO_CITA.no_asistio).toBe("No asistió")
    expect(ORIGEN_PACIENTE.whatsapp).toBe("WhatsApp")
  })
})

describe("fechaVolverEn", () => {
  it("suma meses desde el día dado", () => {
    expect(fechaVolverEn("2026-10-10", 6)).toBe("2027-04-10")
    expect(fechaVolverEn("2026-10-10", 12)).toBe("2027-10-10")
  })
  it("fin de mes no se pasa al mes siguiente", () => {
    expect(fechaVolverEn("2026-08-31", 6)).toBe("2027-02-28")
  })
  it("6 meses es la opción por defecto", () => {
    expect(OPCIONES_VOLVER_EN.find((o) => o.porDefecto)?.meses).toBe(6)
  })
})
