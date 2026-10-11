import { describe, expect, it } from "vitest"

import { esquemaDatosBasicos, esquemaNuevoPaciente } from "./esquema"

describe("esquemaDatosBasicos", () => {
  it("el nombre es obligatorio y se recorta", () => {
    expect(esquemaDatosBasicos.safeParse({ nombre: "   " }).success).toBe(false)
    expect(esquemaDatosBasicos.parse({ nombre: "  Paciente A " }).nombre).toBe("Paciente A")
  })
  it("los campos vacíos pasan a null", () => {
    expect(esquemaDatosBasicos.parse({ nombre: "A", cedula: "", fechaNacimiento: "", correo: "" })).toEqual({
      nombre: "A", cedula: null, fechaNacimiento: null, correo: null,
    })
  })
  it("rechaza correo y fecha mal escritos con mensajes claros", () => {
    const r = esquemaDatosBasicos.safeParse({ nombre: "A", correo: "no-es-correo", fechaNacimiento: "10/10/1990" })
    expect(r.success).toBe(false)
    const msgs = r.error!.issues.map((i) => i.message)
    expect(msgs).toContain("Escribe un correo válido, por ejemplo nombre@correo.com")
    expect(msgs).toContain("Elige una fecha válida")
  })
  it("la fecha de nacimiento no puede ser futura", () => {
    expect(esquemaDatosBasicos.safeParse({ nombre: "A", fechaNacimiento: "2999-01-01" }).success).toBe(false)
  })
})

describe("esquemaNuevoPaciente", () => {
  it("pide origen y valida el teléfono ecuatoriano", () => {
    expect(esquemaNuevoPaciente.safeParse({ nombre: "A", origen: "llamada", telefono: "0991234567" }).success).toBe(true)
    const r = esquemaNuevoPaciente.safeParse({ nombre: "A", origen: "llamada", telefono: "123" })
    expect(r.error!.issues[0].message).toBe("El teléfono no es válido. Ejemplo: 0991234567")
  })
  it("el teléfono es opcional y el origen no puede ser WhatsApp", () => {
    expect(esquemaNuevoPaciente.parse({ nombre: "A", origen: "presencial", telefono: "" }).telefono).toBeNull()
    expect(esquemaNuevoPaciente.safeParse({ nombre: "A", origen: "whatsapp" }).success).toBe(false)
  })
})
