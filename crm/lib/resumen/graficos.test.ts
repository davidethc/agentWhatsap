import { describe, expect, it } from "vitest"

import { datosBarras, datosDona, textoRetorno } from "./graficos"

describe("datosBarras", () => {
  it("etiqueta cada día con su abreviatura en español", () => {
    const r = datosBarras([
      { dia: "2026-10-12", nuevos: 2 },
      { dia: "2026-10-18", nuevos: 0 },
    ])
    expect(r).toEqual([
      { dia: "2026-10-12", etiqueta: "lun 12", nuevos: 2 },
      { dia: "2026-10-18", etiqueta: "dom 18", nuevos: 0 },
    ])
  })
})

describe("datosDona", () => {
  const canales = [
    { origen: "whatsapp", nuevos: 3, agendadas: 0, inasistencias: 0 },
    { origen: "llamada", nuevos: 0, agendadas: 0, inasistencias: 0 },
    { origen: "presencial", nuevos: 1, agendadas: 0, inasistencias: 0 },
    { origen: "referido", nuevos: 0, agendadas: 0, inasistencias: 0 },
  ] as const
  it("deja solo los canales con nuevos y usa los nombres en español", () => {
    expect(datosDona([...canales])).toEqual([
      { origen: "whatsapp", nombre: "WhatsApp", nuevos: 3 },
      { origen: "presencial", nombre: "Presencial", nuevos: 1 },
    ])
  })
  it("sin nuevos devuelve una lista vacía", () => {
    expect(datosDona(canales.map((c) => ({ ...c, nuevos: 0 })))).toEqual([])
  })
})

describe("textoRetorno", () => {
  it("avisa si ya pasó, es hoy o es después", () => {
    expect(textoRetorno("2026-10-09", "2026-10-11")).toBe("Desde el 9 oct")
    expect(textoRetorno("2026-10-11", "2026-10-11")).toBe("Hoy")
    expect(textoRetorno("2026-10-14", "2026-10-11")).toBe("El 14 oct")
  })
})
