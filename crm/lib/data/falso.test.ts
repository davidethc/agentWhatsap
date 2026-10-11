import { beforeEach, describe, expect, it } from "vitest"

import { ErrorDatos, type Datos } from "./interfaz"
import { crearDatosFalsos } from "./falso"

// Sábado 10 oct 2026, 08:00 en Guayaquil (UTC-5) = 13:00 UTC.
const AHORA = new Date("2026-10-10T13:00:00Z")
let datos: Datos

beforeEach(() => {
  datos = crearDatosFalsos({ ahora: () => AHORA })
})

async function porNombre(nombre: string) {
  const lista = await datos.pacientes.listar()
  const p = lista.find((x) => x.nombre === nombre)
  if (!p) throw new Error(`falta ${nombre}`)
  return p
}

describe("pacientes.listar", () => {
  it("busca por nombre sin importar mayúsculas", async () => {
    const r = await datos.pacientes.listar({ texto: "paciente b" })
    expect(r.map((p) => p.nombre)).toEqual(["Paciente B"])
  })
  it("busca por teléfono ignorando espacios y símbolos", async () => {
    const r = await datos.pacientes.listar({ texto: "+593 99 000 0003" })
    expect(r.map((p) => p.nombre)).toEqual(["Paciente C"])
  })
  it("sin filtro devuelve todos", async () => {
    expect((await datos.pacientes.listar()).length).toBeGreaterThanOrEqual(7)
  })
})

describe("pacientes.crear", () => {
  it("crea en Nuevo y normaliza el teléfono a 593", async () => {
    const r = await datos.pacientes.crear({ nombre: " Paciente Z ", origen: "llamada", telefono: "0991112223" })
    expect(r.duplicado).toBe(false)
    expect(r.paciente).toMatchObject({ nombre: "Paciente Z", etapa: "nuevo", telefono: "593991112223" })
  })
  it("teléfono repetido → duplicado y no crea nada", async () => {
    const antes = (await datos.pacientes.listar()).length
    const r = await datos.pacientes.crear({ nombre: "Otro", origen: "llamada", telefono: "099 000 0001" })
    expect(r.duplicado).toBe(true)
    expect(r.paciente.nombre).toBe("Paciente A")
    expect((await datos.pacientes.listar()).length).toBe(antes)
  })
  it("dependiente comparte la conversación del responsable", async () => {
    const a = await porNombre("Paciente A")
    const r = await datos.pacientes.crear({ nombre: "Hijo", origen: "whatsapp", responsableId: a.id })
    expect(r.paciente).toMatchObject({ responsableId: a.id, conversacionId: a.conversacionId, telefono: a.telefono })
  })
  it("rechaza teléfono inválido y nombre vacío con mensaje en español", async () => {
    await expect(datos.pacientes.crear({ nombre: "X", origen: "llamada", telefono: "123" })).rejects.toThrow("Teléfono no válido")
    await expect(datos.pacientes.crear({ nombre: "  ", origen: "llamada" })).rejects.toBeInstanceOf(ErrorDatos)
  })
  it("sin teléfono es válido", async () => {
    const r = await datos.pacientes.crear({ nombre: "Sin tel", origen: "presencial" })
    expect(r.paciente.telefono).toBeNull()
  })
})

describe("pacientes.moverEtapa", () => {
  it("Perdido exige motivo", async () => {
    const c = await porNombre("Paciente C")
    await expect(datos.pacientes.moverEtapa(c.id, "perdido")).rejects.toThrow("hace falta el motivo")
  })
  it("mueve, guarda el motivo y registra el historial", async () => {
    const c = await porNombre("Paciente C")
    const r = await datos.pacientes.moverEtapa(c.id, "perdido", "no_respondio")
    expect(r).toMatchObject({ etapa: "perdido", motivoPerdido: "no_respondio" })
    const ficha = await datos.pacientes.obtener(c.id)
    expect(ficha!.historial.at(-1)).toMatchObject({ de: "nuevo", a: "perdido", actor: "personal" })
  })
  it("al salir de Perdido se borra el motivo", async () => {
    const c = await porNombre("Paciente C")
    await datos.pacientes.moverEtapa(c.id, "perdido", "indeciso")
    const r = await datos.pacientes.moverEtapa(c.id, "conversando")
    expect(r.motivoPerdido).toBeNull()
  })
})

describe("citas", () => {
  it("delDia devuelve solo las de hoy, ordenadas, con nombre", async () => {
    const r = await datos.citas.delDia(AHORA)
    expect(r.map((c) => c.pacienteNombre)).toEqual(["Paciente A", "Paciente B", "Paciente C"])
  })
  it("guardar crea con 1 h por defecto, origen panel y pasa al paciente a Agendó", async () => {
    const d = await porNombre("Paciente D")
    const c = await datos.citas.guardar({ pacienteId: d.id, iniciaEn: "2026-10-12T16:00:00Z" }) // lun 11:00
    expect(new Date(c.terminaEn).getTime() - new Date(c.iniciaEn).getTime()).toBe(3_600_000)
    expect(c).toMatchObject({ origen: "panel", estado: "agendada", sync: "pendiente" })
    expect((await datos.pacientes.obtener(d.id))!.paciente.etapa).toBe("agendo")
  })
  it("rechaza fuera de horario y choques", async () => {
    const d = await porNombre("Paciente D")
    await expect(datos.citas.guardar({ pacienteId: d.id, iniciaEn: "2026-10-12T11:00:00Z" })).rejects.toThrow("fuera del horario") // 06:00
    await expect(datos.citas.guardar({ pacienteId: d.id, iniciaEn: "2026-10-11T15:00:00Z" })).rejects.toThrow("fuera del horario") // domingo
    await expect(datos.citas.guardar({ pacienteId: d.id, iniciaEn: "2026-10-10T14:30:00Z" })).rejects.toThrow("otra cita") // sáb 09:30 vs 09:00
  })
  it("sábado cierra a las 15:00", async () => {
    const d = await porNombre("Paciente D")
    await expect(datos.citas.guardar({ pacienteId: d.id, iniciaEn: "2026-10-17T19:30:00Z" })).rejects.toThrow("fuera del horario") // 14:30–15:30
  })
  it("editar mueve la cita sin duplicarla y no choca consigo misma", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    const e = await datos.citas.guardar({ pacienteId: primera.pacienteId!, iniciaEn: "2026-10-10T14:30:00Z", citaId: primera.id })
    expect(e.id).toBe(primera.id)
    expect((await datos.citas.delDia(AHORA)).length).toBe(3)
  })
  it("cancelar es repetible y la cita editada ya no se puede cambiar", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    expect((await datos.citas.cancelar(primera.id)).estado).toBe("cancelada")
    expect((await datos.citas.cancelar(primera.id)).estado).toBe("cancelada")
    await expect(
      datos.citas.guardar({ pacienteId: primera.pacienteId!, iniciaEn: "2026-10-12T15:00:00Z", citaId: primera.id })
    ).rejects.toThrow("Solo se puede editar una cita agendada")
  })
  it("Asistió → cita asistio, paciente en Seguimiento con volver_el en 6 meses", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    const c = await datos.citas.marcarAsistencia(primera.id, true)
    expect(c.estado).toBe("asistio")
    const p = (await datos.pacientes.obtener(primera.pacienteId!))!.paciente
    expect(p).toMatchObject({ etapa: "seguimiento", volverEl: "2027-04-10" })
  })
  it("Asistió con fecha propia", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    await datos.citas.marcarAsistencia(primera.id, true, "2027-01-15")
    expect((await datos.pacientes.obtener(primera.pacienteId!))!.paciente.volverEl).toBe("2027-01-15")
  })
  it("Asistió sin retorno (null) deja volver_el vacío", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    await datos.citas.marcarAsistencia(primera.id, true, null)
    expect((await datos.pacientes.obtener(primera.pacienteId!))!.paciente.volverEl).toBeNull()
  })
  it("No asistió → paciente Perdido (no_asistio)", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    await datos.citas.marcarAsistencia(primera.id, false)
    expect((await datos.pacientes.obtener(primera.pacienteId!))!.paciente).toMatchObject({
      etapa: "perdido",
      motivoPerdido: "no_asistio",
    })
  })
  it("no se marca asistencia en una cita cancelada", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    await datos.citas.cancelar(primera.id)
    await expect(datos.citas.marcarAsistencia(primera.id, true)).rejects.toThrow("cancelada")
  })
})

describe("actualizar datos básicos", () => {
  it("cambia nombre, cédula, nacimiento y correo, y no toca la etapa", async () => {
    const a = await porNombre("Paciente A")
    const r = await datos.pacientes.actualizar(a.id, {
      nombre: " Paciente A Editado ", cedula: "0999999999", fechaNacimiento: "1990-05-06", correo: "a@ejemplo.test",
    })
    expect(r).toMatchObject({ nombre: "Paciente A Editado", cedula: "0999999999", etapa: a.etapa })
    expect((await datos.pacientes.obtener(a.id))!.paciente.correo).toBe("a@ejemplo.test")
  })
  it("no deja guardar sin nombre", async () => {
    const a = await porNombre("Paciente A")
    await expect(
      datos.pacientes.actualizar(a.id, { nombre: "  ", cedula: null, fechaNacimiento: null, correo: null })
    ).rejects.toThrow("Escribe el nombre")
  })
})

describe("resumen y mensajes", () => {
  it("resumen: citas de hoy y tarjetas coherentes", async () => {
    const r = await datos.resumen.delDia()
    expect(r.citasHoy).toHaveLength(3)
    expect(r.tarjetas.citasHoy).toBe(3)
    expect(r.nuevosPorDia).toHaveLength(7)
    expect(r.nuevosPorDia[0].dia).toBe("2026-10-05") // lunes de esa semana
    expect(r.semana).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" })
    expect(r.canales.map((c) => c.origen)).toEqual(["whatsapp", "llamada", "presencial", "referido"])
  })
  it("resumen: una cita cancelada sigue en la lista pero no cuenta en la tarjeta", async () => {
    const [primera] = await datos.citas.delDia(AHORA)
    await datos.citas.cancelar(primera.id)
    const r = await datos.resumen.delDia()
    expect(r.citasHoy).toHaveLength(3)
    expect(r.tarjetas.citasHoy).toBe(2)
  })
  it("mensajes de una conversación, en orden", async () => {
    const a = await porNombre("Paciente A")
    const m = await datos.mensajes.deConversacion(a.conversacionId!)
    expect(m.map((x) => x.direccion)).toEqual(["entrante", "saliente", "entrante"])
    expect(await datos.mensajes.deConversacion(999999)).toEqual([])
  })
  it("ficha: dependientes y responsable", async () => {
    const a = await porNombre("Paciente A")
    const ficha = (await datos.pacientes.obtener(a.id))!
    expect(ficha.dependientes.map((d) => d.nombre)).toEqual(["Paciente A2"])
    expect(await datos.pacientes.obtener(424242)).toBeNull()
  })
})
