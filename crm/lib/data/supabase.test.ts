import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { ErrorDatos } from "./interfaz"
import { aResumen, crearDatosSupabase } from "./supabase"

const filaPaciente = {
  id: 7, nombre: "Paciente Q", conversacion_id: 3, responsable_id: null, cedula: null,
  fecha_nacimiento: null, correo: null, origen: "llamada", etapa: "nuevo", motivo_perdido: null,
  volver_el: null, consentimiento_firmado_en: null, etapa_cambiada_en: "2026-10-10T13:00:00Z",
  conversaciones: { telefono: "593990000009" },
}

/** Cliente simulado: registra rpc/insert/update/delete y responde `maybeSingle` con la fila dada. */
function clienteSimulado(rpcRespuesta: unknown = { data: null, error: null }) {
  const escrituras: string[] = []
  const consulta: Record<string, unknown> = {}
  for (const m of ["select", "eq", "order", "gte", "lt", "like", "or"]) consulta[m] = () => consulta
  consulta.maybeSingle = async () => ({ data: filaPaciente, error: null })
  consulta.then = (ok: (v: unknown) => unknown) => ok({ data: [filaPaciente], error: null })
  const from = vi.fn(() => ({
    ...consulta,
    insert: () => escrituras.push("insert"),
    update: () => escrituras.push("update"),
    upsert: () => escrituras.push("upsert"),
    delete: () => escrituras.push("delete"),
  }))
  const rpc = vi.fn(async () => rpcRespuesta)
  return { cliente: { from, rpc } as unknown as SupabaseClient, rpc, escrituras }
}

describe("adaptador Supabase", () => {
  it("las escrituras llaman a funciones de la base con los parámetros correctos", async () => {
    const { cliente, rpc, escrituras } = clienteSimulado({
      data: { duplicado: false, paciente: filaPaciente },
      error: null,
    })
    const datos = crearDatosSupabase(cliente)

    const r = await datos.pacientes.crear({ nombre: "Paciente Q", origen: "llamada", telefono: "0990000009" })
    expect(rpc).toHaveBeenCalledWith("crear_paciente", expect.objectContaining({ p_nombre: "Paciente Q", p_origen: "llamada", p_telefono: "0990000009", p_responsable_id: null }))
    expect(r.paciente).toMatchObject({ id: 7, telefono: "593990000009" })

    await datos.pacientes.moverEtapa(7, "perdido", "indeciso")
    expect(rpc).toHaveBeenCalledWith("mover_etapa", { p_paciente_id: 7, p_etapa: "perdido", p_motivo: "indeciso" })

    expect(escrituras).toEqual([]) // nunca insert/update/delete directos
  })

  it("actualizar edita solo los 4 datos básicos (y falla claro si la RLS no deja)", async () => {
    const llamadas: unknown[] = []
    const consulta: Record<string, unknown> = {}
    for (const m of ["select", "eq", "order"]) consulta[m] = () => consulta
    consulta.maybeSingle = async () => ({ data: { id: 7 }, error: null })
    const cliente = {
      from: () => ({ ...consulta, update: (v: unknown) => (llamadas.push(v), consulta) }),
      rpc: vi.fn(),
    } as unknown as SupabaseClient
    await crearDatosSupabase(cliente)
      .pacientes.actualizar(7, { nombre: "Q", cedula: null, fechaNacimiento: "1990-01-02", correo: null })
      .catch(() => {})
    expect(llamadas).toEqual([{ nombre: "Q", cedula: null, fecha_nacimiento: "1990-01-02", correo: null }])

    consulta.maybeSingle = async () => ({ data: null, error: null }) // 0 filas: la RLS no dejó
    await expect(
      crearDatosSupabase(cliente).pacientes.actualizar(7, { nombre: "Q", cedula: null, fechaNacimiento: null, correo: null })
    ).rejects.toThrow("No se pudo guardar los datos")
  })

  it("citas: guardar, cancelar y marcar asistencia usan sus funciones", async () => {
    const { cliente, rpc, escrituras } = clienteSimulado({ data: { id: 7 }, error: null })
    const datos = crearDatosSupabase(cliente)
    // citaPorId usa maybeSingle: la fila simulada alcanza para el mapeo.
    await datos.citas.guardar({ pacienteId: 7, iniciaEn: "2026-10-12T15:00:00Z", servicio: "Limpieza" }).catch(() => {})
    expect(rpc).toHaveBeenCalledWith("guardar_cita", { p_paciente_id: 7, p_inicia_en: "2026-10-12T15:00:00Z", p_termina_en: null, p_servicio: "Limpieza", p_cita_id: null })
    await datos.citas.cancelar(7).catch(() => {})
    expect(rpc).toHaveBeenCalledWith("cancelar_cita", { p_cita_id: 7 })
    await datos.citas.marcarAsistencia(7, true, "2027-01-15").catch(() => {})
    expect(rpc).toHaveBeenCalledWith("marcar_asistencia", { p_cita_id: 7, p_asistio: true, p_volver_el: "2027-01-15" })
    await datos.citas.marcarAsistencia(7, false).catch(() => {})
    expect(rpc).toHaveBeenLastCalledWith("marcar_asistencia", { p_cita_id: 7, p_asistio: false })
    await datos.citas.marcarAsistencia(7, true, null).catch(() => {})
    expect(rpc).toHaveBeenLastCalledWith("marcar_asistencia", { p_cita_id: 7, p_asistio: true, p_volver_el: null })
    await datos.citas.marcarAsistencia(7, true).catch(() => {})
    expect(rpc).toHaveBeenLastCalledWith("marcar_asistencia", { p_cita_id: 7, p_asistio: true })
    expect(escrituras).toEqual([])
  })

  it("muestra tal cual los mensajes de las funciones (en español) y oculta los técnicos", async () => {
    const propio = clienteSimulado({ data: null, error: { message: "Ya hay otra cita en ese horario", code: "23P01" } })
    await expect(crearDatosSupabase(propio.cliente).citas.cancelar(1)).rejects.toThrow("Ya hay otra cita en ese horario")

    const tecnico = clienteSimulado({ data: null, error: { message: 'relation "x" does not exist', code: "42P01" } })
    const err = await crearDatosSupabase(tecnico.cliente).citas.cancelar(1).catch((e) => e)
    expect(err).toBeInstanceOf(ErrorDatos)
    expect(err.message).toBe("No se pudo cancelar la cita. Intenta de nuevo.")
  })

  it("resumen: llama a resumen_del_dia y pasa la forma de la base a camelCase", async () => {
    const json = {
      fecha: "2026-10-14",
      semana: { desde: "2026-10-12", hasta: "2026-10-18" },
      citas_hoy: [
        { id: 1, inicia_en: "2026-10-14T14:00:00Z", termina_en: "2026-10-14T15:00:00Z", servicio: "Limpieza", estado: "agendada", origen: "eli", paciente_id: 7, paciente_nombre: "Paciente Q" },
      ],
      numeros: { citas_hoy: 1, nuevos_hoy: 0, nuevos_semana: 2, agendadas_semana: 3, inasistencias_semana: 1 },
      nuevos_por_dia: [{ dia: "2026-10-12", nuevos: 2 }],
      canales: [{ origen: "whatsapp", nuevos: 2, agendadas: 3, inasistencias: 1 }],
      cumpleanos_hoy: [],
      cumpleanos_semana: [{ id: 7, nombre: "Paciente Q", fecha_nacimiento: "1990-10-15", cumple: "2026-10-15" }],
      retornos: [{ id: 8, nombre: "Paciente R", etapa: "seguimiento", volver_el: "2026-10-16" }],
    }
    const { cliente, rpc } = clienteSimulado({ data: json, error: null })
    const r = await crearDatosSupabase(cliente).resumen.delDia()
    expect(rpc).toHaveBeenCalledWith("resumen_del_dia", {})
    expect(r.citasHoy[0]).toMatchObject({ id: 1, pacienteNombre: "Paciente Q", iniciaEn: "2026-10-14T14:00:00Z" })
    expect(r.tarjetas).toEqual({ citasHoy: 1, nuevosHoy: 0, nuevosSemana: 2, agendadasSemana: 3, inasistenciasSemana: 1 })
    expect(r.cumpleanosSemana[0]).toEqual({ id: 7, nombre: "Paciente Q", fechaNacimiento: "1990-10-15", cumple: "2026-10-15" })
    expect(r.retornos[0]).toEqual({ id: 8, nombre: "Paciente R", etapa: "seguimiento", volverEl: "2026-10-16" })
    expect(aResumen(json as never).canales).toEqual(json.canales)
  })

  it("resumen: un error técnico se muestra con mensaje claro", async () => {
    const { cliente } = clienteSimulado({ data: null, error: { message: "boom", code: "XX000" } })
    await expect(crearDatosSupabase(cliente).resumen.delDia()).rejects.toThrow("No se pudo cargar el resumen")
  })
})
