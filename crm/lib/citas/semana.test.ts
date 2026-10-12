import { describe, expect, it } from "vitest"

import type { Cita } from "@/lib/data/tipos"

import { agruparPorDia, contarSinVincular, diasDeSemana, lunesDeParametro, sePuedeVincular, semanaVecina, tituloSemana } from "./semana"

const cita = (id: number, iniciaEn: string, extra: Partial<Cita> = {}): Cita => ({
  id, pacienteId: 1, pacienteNombre: "Paciente Uno", iniciaEn, terminaEn: iniciaEn,
  servicio: null, estado: "agendada", origen: "panel", sync: "ok", ...extra,
})

describe("lunesDeParametro", () => {
  it("lleva cualquier día al lunes de su semana", () => {
    expect(lunesDeParametro("2026-10-08", new Date("2026-10-20T12:00:00Z"))).toBe("2026-10-05")
    expect(lunesDeParametro("2026-10-11", new Date())).toBe("2026-10-05")
  })
  it("sin parámetro o inválido usa la semana de hoy", () => {
    const hoy = new Date("2026-10-14T15:00:00Z")
    expect(lunesDeParametro(undefined, hoy)).toBe("2026-10-12")
    expect(lunesDeParametro("basura", hoy)).toBe("2026-10-12")
    expect(lunesDeParametro("2026-02-31", hoy)).toBe("2026-10-12")
  })
})

describe("semanaVecina", () => {
  it("suma y resta 7 días", () => {
    expect(semanaVecina("2026-10-05", 1)).toBe("2026-10-12")
    expect(semanaVecina("2026-10-05", -1)).toBe("2026-09-28")
  })
})

describe("diasDeSemana", () => {
  it("devuelve 7 claves de lunes a domingo", () => {
    const d = diasDeSemana("2026-10-26")
    expect(d).toHaveLength(7)
    expect(d[0]).toBe("2026-10-26")
    expect(d[6]).toBe("2026-11-01")
  })
})

describe("tituloSemana", () => {
  it("mismo mes", () => expect(tituloSemana("2026-10-05")).toBe("Semana 5–11 oct"))
  it("cruza de mes", () => expect(tituloSemana("2026-10-26")).toBe("Semana 26 oct–1 nov"))
})

describe("agruparPorDia", () => {
  it("pone cada cita en su día local, ordenada por hora, con los 7 días", () => {
    const g = agruparPorDia("2026-10-05", [
      cita(2, "2026-10-10T20:00:00Z"),
      cita(1, "2026-10-10T14:00:00Z"),
      cita(3, "2026-10-12T03:00:00Z"), // domingo 11 22:00 en Guayaquil
    ])
    expect(g).toHaveLength(7)
    expect(g[5].citas.map((c) => c.id)).toEqual([1, 2])
    expect(g[6].citas.map((c) => c.id)).toEqual([3])
    expect(g[0].citas).toEqual([])
  })
})

describe("contarSinVincular", () => {
  it("cuenta las agendadas sin paciente, no las canceladas", () => {
    expect(contarSinVincular([
      cita(1, "2026-10-10T14:00:00Z", { pacienteId: null }),
      cita(2, "2026-10-10T15:00:00Z", { pacienteId: null, estado: "cancelada" }),
      cita(3, "2026-10-10T16:00:00Z"),
    ])).toBe(1)
  })
})

describe("sePuedeVincular (F-5)", () => {
  it.each([
    [null, "agendada", true],
    [null, "asistio", false],
    [null, "no_asistio", false],
    [null, "cancelada", false],
    [7, "agendada", false],
    [7, "asistio", false],
  ] as const)("paciente %s y estado %s → %s", (pacienteId, estado, esperado) => {
    expect(sePuedeVincular({ pacienteId, estado })).toBe(esperado)
  })
})
