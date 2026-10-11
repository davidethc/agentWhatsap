import { describe, expect, it } from "vitest"

import { aInstante, DURACIONES, esquemaCita, partesLocales, terminaEn } from "./esquema"

describe("fecha y hora de Guayaquil ↔ instante", () => {
  it("09:30 en Guayaquil son las 14:30 UTC", () => {
    expect(aInstante("2026-10-12", "09:30")).toBe("2026-10-12T14:30:00.000Z")
  })
  it("partesLocales es la operación inversa", () => {
    expect(partesLocales("2026-10-12T14:30:00Z")).toEqual({ fecha: "2026-10-12", hora: "09:30" })
  })
  it("una cita de las 20:00 sigue en el mismo día local aunque en UTC sea el siguiente", () => {
    expect(partesLocales("2026-10-13T01:00:00Z")).toEqual({ fecha: "2026-10-12", hora: "20:00" })
  })
  it("terminaEn suma la duración en minutos", () => {
    expect(terminaEn("2026-10-12T14:30:00.000Z", 90)).toBe("2026-10-12T16:00:00.000Z")
  })
  it("la duración por defecto es 1 h", () => {
    expect(DURACIONES.find((d) => d.porDefecto)?.minutos).toBe(60)
  })
})

describe("esquemaCita", () => {
  const ok = { pacienteId: 3, fecha: "2026-10-12", hora: "09:00", duracion: 60, servicio: "Limpieza" }
  it("acepta una cita completa", () => expect(esquemaCita.safeParse(ok).success).toBe(true))
  it("pide paciente, fecha y hora con mensajes claros", () => {
    const r = esquemaCita.safeParse({ ...ok, pacienteId: undefined, fecha: "", hora: "" })
    const msgs = r.error!.issues.map((i) => i.message)
    expect(msgs).toEqual(expect.arrayContaining(["Elige el paciente", "Elige la fecha", "Elige la hora"]))
  })
  it("el servicio es opcional y vacío pasa a null", () => {
    expect(esquemaCita.parse({ ...ok, servicio: "  " }).servicio).toBeNull()
  })
})
