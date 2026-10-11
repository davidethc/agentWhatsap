import { describe, expect, it } from "vitest"

import { tiempoTranscurrido } from "./tiempo"

const AHORA = "2026-10-11T15:00:00Z"
const antes = (min: number) => new Date(new Date(AHORA).getTime() - min * 60_000).toISOString()

describe("tiempoTranscurrido", () => {
  it.each([
    [0, "ahora"],
    [4, "hace 4 min"],
    [59, "hace 59 min"],
    [60, "hace 1 h"],
    [5 * 60 + 30, "hace 5 h"],
    [24 * 60, "hace 1 día"],
    [3 * 24 * 60, "hace 3 días"],
    [45 * 24 * 60, "hace 45 días"],
  ])("%i min → %s", (min, esperado) => expect(tiempoTranscurrido(antes(min), AHORA)).toBe(esperado))
  it("una fecha futura se muestra como ahora", () => {
    expect(tiempoTranscurrido("2026-10-11T16:00:00Z", AHORA)).toBe("ahora")
  })
})
