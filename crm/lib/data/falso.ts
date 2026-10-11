import { addDays, addMonths, format } from "date-fns"
import { TZDate } from "@date-fns/tz"

import {
  claveDia,
  diaYMinutos,
  finDelDia,
  inicioDeDiaMas,
  inicioDeSemana,
  inicioDelDia,
  ZONA,
} from "@/lib/dominio/fechas"
import { normalizarTelefono } from "@/lib/dominio/telefono"

import { ErrorDatos, type Datos } from "./interfaz"
import type {
  CambioEtapa,
  Cita,
  DatosClinicos,
  Etapa,
  Mensaje,
  Paciente,
  Resumen,
} from "./tipos"

type Opciones = { ahora?: () => Date }

/** Horario del consultorio (igual que el seed de la base): L–V 09–18, sábado 09–15. */
const HORARIO: Record<number, [number, number] | undefined> = {
  1: [540, 1080],
  2: [540, 1080],
  3: [540, 1080],
  4: [540, 1080],
  5: [540, 1080],
  6: [540, 900],
}

/**
 * Adaptador falso: datos INVENTADOS en memoria, con las mismas reglas que las funciones de la base.
 * Sirve para desarrollar sin Supabase y para las pruebas.
 */
export function crearDatosFalsos({ ahora = () => new Date() }: Opciones = {}): Datos {
  let seq = 100
  const sig = () => ++seq
  const iso = (d: Date) => d.toISOString()
  const a = (dias: number, h: number, min = 0) => {
    const base = new TZDate(inicioDeDiaMas(ahora(), dias).getTime(), ZONA)
    base.setHours(h, min, 0, 0)
    return new Date(base.getTime())
  }

  const telefonos = new Map<number, string>() // conversacionId → teléfono
  const pacientes: Paciente[] = []
  const citas: Cita[] = []
  const historial = new Map<number, CambioEtapa[]>()
  const clinicos = new Map<number, DatosClinicos>()
  const mensajes = new Map<number, Mensaje[]>()

  function nuevoPaciente(p: Partial<Paciente> & Pick<Paciente, "nombre">, telefono?: string): Paciente {
    const id = sig()
    let conversacionId = p.conversacionId ?? null
    if (telefono && conversacionId === null) {
      conversacionId = sig()
      telefonos.set(conversacionId, telefono)
    }
    const fila: Paciente = {
      id,
      telefono: conversacionId ? (telefonos.get(conversacionId) ?? null) : null,
      conversacionId,
      responsableId: null,
      cedula: null,
      fechaNacimiento: null,
      correo: null,
      origen: "whatsapp",
      etapa: "nuevo",
      motivoPerdido: null,
      volverEl: null,
      consentimientoFirmadoEn: null,
      etapaCambiadaEn: iso(ahora()),
      ...p,
    }
    pacientes.push(fila)
    historial.set(id, [
      { id: sig(), de: null, a: fila.etapa, motivoPerdido: fila.motivoPerdido, actor: "sistema", en: fila.etapaCambiadaEn },
    ])
    return fila
  }

  function paciente(id: number): Paciente {
    const p = pacientes.find((x) => x.id === id)
    if (!p) throw new ErrorDatos("Paciente no encontrado", "P0002")
    return p
  }
  function cita(id: number): Cita {
    const c = citas.find((x) => x.id === id)
    if (!c) throw new ErrorDatos("Cita no encontrada", "P0002")
    return c
  }

  function cambiarEtapa(id: number, etapa: Etapa, motivo?: Paciente["motivoPerdido"]): Paciente {
    if (etapa === "perdido" && !motivo) {
      throw new ErrorDatos("Para mover a Perdido hace falta el motivo", "22023")
    }
    const p = paciente(id)
    if (p.etapa === etapa && (p.motivoPerdido ?? null) === (etapa === "perdido" ? motivo! : null)) return p
    const de = p.etapa
    p.etapa = etapa
    p.motivoPerdido = etapa === "perdido" ? motivo! : null
    p.etapaCambiadaEn = iso(ahora())
    historial.get(id)!.push({ id: sig(), de, a: etapa, motivoPerdido: p.motivoPerdido, actor: "personal", en: p.etapaCambiadaEn })
    return { ...p }
  }

  function conNombre(c: Cita): Cita {
    return { ...c, pacienteNombre: c.pacienteId ? paciente(c.pacienteId).nombre : null }
  }

  function validarAgenda(inicia: Date, termina: Date, excluir?: number) {
    if (termina <= inicia) throw new ErrorDatos("La cita debe terminar después de empezar", "22023")
    const i = diaYMinutos(inicia)
    const f = diaYMinutos(termina)
    const h = HORARIO[i.diaSemana]
    if (claveDia(inicia) !== claveDia(termina) || !h || i.minutos < h[0] || f.minutos > h[1]) {
      throw new ErrorDatos("La cita está fuera del horario del consultorio", "22023")
    }
    const choca = citas.some(
      (c) =>
        c.estado !== "cancelada" &&
        c.id !== excluir &&
        new Date(c.iniciaEn) < termina &&
        new Date(c.terminaEn) > inicia
    )
    if (choca) throw new ErrorDatos("Ya hay otra cita en ese horario", "23P01")
  }

  // ───── Datos inventados ─────
  const A = nuevoPaciente({ nombre: "Paciente A", etapa: "agendo", origen: "whatsapp" }, "593990000001")
  const B = nuevoPaciente({ nombre: "Paciente B", etapa: "seguimiento", volverEl: format(addMonths(ahora(), 6), "yyyy-MM-dd") }, "593990000002")
  const C = nuevoPaciente({ nombre: "Paciente C", etapa: "nuevo" }, "593990000003")
  const D = nuevoPaciente({ nombre: "Paciente D", etapa: "conversando" }, "593990000004")
  nuevoPaciente({ nombre: "Paciente E", etapa: "perdido", motivoPerdido: "indeciso" }, "593990000005")
  nuevoPaciente({ nombre: "Paciente F", etapa: "nuevo", origen: "llamada" })
  nuevoPaciente(
    { nombre: "Paciente A2", responsableId: A.id, conversacionId: A.conversacionId, origen: "whatsapp" }
  )
  clinicos.set(A.id, { alergias: null, enfermedades: null, embarazo: null, miedo: "Anestesia" })

  const base = (id: number, pacienteId: number, inicia: Date, servicio: string, estado: Cita["estado"] = "agendada"): Cita => ({
    id, pacienteId, pacienteNombre: null, iniciaEn: iso(inicia),
    terminaEn: iso(new Date(inicia.getTime() + 3_600_000)), servicio, estado, origen: "eli", sync: "ok",
  })
  citas.push(
    base(sig(), A.id, a(0, 9), "Limpieza"),
    base(sig(), B.id, a(0, 11), "Control", "asistio"),
    base(sig(), C.id, a(0, 15), "Valoración"),
    base(sig(), A.id, a(2, 10), "Control")
  )

  mensajes.set(A.conversacionId!, [
    { id: sig(), direccion: "entrante", texto: "Hola, quiero una cita", enviadoEn: iso(a(-1, 10, 2)) },
    { id: sig(), direccion: "saliente", texto: "¡Hola! Claro, ¿qué día te viene bien?", enviadoEn: iso(a(-1, 10, 2)) },
    { id: sig(), direccion: "entrante", texto: "Mañana a las 9", enviadoEn: iso(a(-1, 10, 5)) },
  ])
  mensajes.set(D.conversacionId!, [
    { id: sig(), direccion: "entrante", texto: "Buenas, ¿cuánto cuesta una limpieza?", enviadoEn: iso(a(0, 8)) },
  ])

  // ───── Interfaz ─────
  return {
    pacientes: {
      async listar(filtro) {
        const t = filtro?.texto?.trim().toLowerCase()
        const d = t?.replace(/\D/g, "")
        return pacientes
          .filter(
            (p) =>
              !t || p.nombre.toLowerCase().includes(t) || (!!d && (p.telefono ?? "").includes(d))
          )
          .map((p) => ({ ...p }))
      },
      async obtener(id) {
        const p = pacientes.find((x) => x.id === id)
        if (!p) return null
        const resp = p.responsableId ? paciente(p.responsableId) : null
        return {
          paciente: { ...p },
          responsable: resp ? { id: resp.id, nombre: resp.nombre } : null,
          dependientes: pacientes.filter((x) => x.responsableId === id).map((x) => ({ id: x.id, nombre: x.nombre })),
          datosClinicos: clinicos.get(id) ?? null,
          citas: citas
            .filter((c) => c.pacienteId === id)
            .sort((x, y) => y.iniciaEn.localeCompare(x.iniciaEn))
            .map(conNombre),
          historial: [...(historial.get(id) ?? [])],
        }
      },
      async crear(entrada) {
        if (!entrada.nombre.trim()) throw new ErrorDatos("Escribe el nombre del paciente", "23514")
        if (entrada.responsableId !== undefined) {
          const resp = paciente(entrada.responsableId)
          const p = nuevoPaciente({
            nombre: entrada.nombre.trim(),
            origen: entrada.origen,
            conversacionId: resp.conversacionId,
            responsableId: resp.id,
            cedula: entrada.cedula || null,
            fechaNacimiento: entrada.fechaNacimiento ?? null,
            correo: entrada.correo || null,
          })
          return { duplicado: false, paciente: { ...p } }
        }
        let telefono: string | null
        try {
          telefono = normalizarTelefono(entrada.telefono)
        } catch (e) {
          throw new ErrorDatos((e as Error).message, "22023")
        }
        if (telefono) {
          const existente = pacientes.find((p) => p.telefono === telefono && p.responsableId === null)
          if (existente) return { duplicado: true, paciente: { ...existente } }
        }
        const p = nuevoPaciente(
          {
            nombre: entrada.nombre.trim(),
            origen: entrada.origen,
            cedula: entrada.cedula || null,
            fechaNacimiento: entrada.fechaNacimiento ?? null,
            correo: entrada.correo || null,
          },
          telefono ?? undefined
        )
        return { duplicado: false, paciente: { ...p } }
      },
      async actualizar(id, d) {
        if (!d.nombre.trim()) throw new ErrorDatos("Escribe el nombre del paciente", "23514")
        const p = paciente(id)
        Object.assign(p, {
          nombre: d.nombre.trim(),
          cedula: d.cedula,
          fechaNacimiento: d.fechaNacimiento,
          correo: d.correo,
        })
        return { ...p }
      },
      async moverEtapa(id, etapa, motivo) {
        return cambiarEtapa(id, etapa, motivo)
      },
    },

    citas: {
      async delDia(dia) {
        return this.entre(inicioDelDia(dia), new Date(finDelDia(dia).getTime() + 1))
      },
      async entre(desde, hasta) {
        return citas
          .filter((c) => new Date(c.iniciaEn) >= desde && new Date(c.iniciaEn) < hasta)
          .sort((x, y) => x.iniciaEn.localeCompare(y.iniciaEn))
          .map(conNombre)
      },
      async guardar(e) {
        const inicia = new Date(e.iniciaEn)
        const termina = e.terminaEn ? new Date(e.terminaEn) : new Date(inicia.getTime() + 3_600_000)
        paciente(e.pacienteId)
        const antes = e.citaId !== undefined ? cita(e.citaId) : null
        if (antes && antes.estado !== "agendada") {
          throw new ErrorDatos("Solo se puede editar una cita agendada", "22023")
        }
        validarAgenda(inicia, termina, e.citaId)
        const servicio = e.servicio?.trim() || null
        const cambioPaciente = !antes || antes.pacienteId !== e.pacienteId
        let resultado: Cita
        if (antes) {
          Object.assign(antes, { pacienteId: e.pacienteId, iniciaEn: iso(inicia), terminaEn: iso(termina), servicio, sync: "pendiente" })
          resultado = antes
        } else {
          resultado = { id: sig(), pacienteId: e.pacienteId, pacienteNombre: null, iniciaEn: iso(inicia), terminaEn: iso(termina), servicio, estado: "agendada", origen: "panel", sync: "pendiente" }
          citas.push(resultado)
        }
        if (cambioPaciente) cambiarEtapa(e.pacienteId, "agendo")
        return conNombre(resultado)
      },
      async cancelar(id) {
        const c = cita(id)
        if (c.estado !== "cancelada") {
          c.estado = "cancelada"
          c.sync = "pendiente"
        }
        return conNombre(c)
      },
      async marcarAsistencia(id, asistio, volverEl) {
        const c = cita(id)
        if (c.pacienteId === null) throw new ErrorDatos("La cita no está vinculada a un paciente", "22023")
        if (c.estado === "cancelada") throw new ErrorDatos("La cita está cancelada", "22023")
        c.estado = asistio ? "asistio" : "no_asistio"
        if (asistio) {
          cambiarEtapa(c.pacienteId, "seguimiento")
          // undefined = 6 meses; null = sin retorno.
          paciente(c.pacienteId).volverEl =
            volverEl === undefined ? format(addMonths(new TZDate(ahora().getTime(), ZONA), 6), "yyyy-MM-dd") : volverEl
        } else {
          cambiarEtapa(c.pacienteId, "perdido", "no_asistio")
        }
        return conNombre(c)
      },
    },

    resumen: {
      async delDia(dia) {
        const hoy = dia ?? ahora()
        const desde = inicioDeSemana(hoy)
        const hasta = inicioDeDiaMas(desde, 7)
        const enSemana = (iso: string) => new Date(iso) >= desde && new Date(iso) < hasta
        const diasSemana = Array.from({ length: 7 }, (_, i) => claveDia(addDays(new TZDate(desde.getTime(), ZONA), i)))
        const delDia = citas
          .filter((c) => claveDia(c.iniciaEn) === claveDia(hoy))
          .sort((x, y) => x.iniciaEn.localeCompare(y.iniciaEn))
          .map(conNombre)
        const semana = citas.filter((c) => enSemana(c.iniciaEn) && c.estado !== "cancelada")
        // Sin fecha de alta en el falso: «nuevos» = pacientes cuya etapa Nuevo cambió esta semana.
        const nuevos = pacientes.filter((p) => p.etapa === "nuevo" && enSemana(p.etapaCambiadaEn))
        const origenDe = (c: Cita) => (c.pacienteId ? paciente(c.pacienteId).origen : null)
        const cumples = pacientes.flatMap((p) => {
          if (!p.fechaNacimiento) return []
          const cumple = diasSemana.find((d) => d.slice(5) === p.fechaNacimiento!.slice(5))
          return cumple ? [{ id: p.id, nombre: p.nombre, fechaNacimiento: p.fechaNacimiento, cumple }] : []
        })
        const resumen: Resumen = {
          fecha: claveDia(hoy),
          semana: { desde: diasSemana[0], hasta: diasSemana[6] },
          citasHoy: delDia,
          tarjetas: {
            citasHoy: delDia.filter((c) => c.estado !== "cancelada").length,
            nuevosHoy: nuevos.filter((p) => claveDia(p.etapaCambiadaEn) === claveDia(hoy)).length,
            nuevosSemana: nuevos.length,
            agendadasSemana: semana.length,
            inasistenciasSemana: semana.filter((c) => c.estado === "no_asistio").length,
          },
          nuevosPorDia: diasSemana.map((dia) => ({
            dia,
            nuevos: nuevos.filter((p) => claveDia(p.etapaCambiadaEn) === dia).length,
          })),
          canales: (["whatsapp", "llamada", "presencial", "referido"] as const).map((origen) => ({
            origen,
            nuevos: nuevos.filter((p) => p.origen === origen).length,
            agendadas: semana.filter((c) => origenDe(c) === origen).length,
            inasistencias: semana.filter((c) => c.estado === "no_asistio" && origenDe(c) === origen).length,
          })),
          cumpleanosHoy: cumples.filter((c) => c.cumple === claveDia(hoy)),
          cumpleanosSemana: cumples.sort((x, y) => x.cumple.localeCompare(y.cumple)),
          retornos: pacientes
            .filter(
              (p) =>
                p.volverEl &&
                p.volverEl <= diasSemana[6] &&
                !citas.some((c) => c.pacienteId === p.id && c.estado === "agendada" && new Date(c.iniciaEn) >= inicioDelDia(hoy))
            )
            .map((p) => ({ id: p.id, nombre: p.nombre, etapa: p.etapa, volverEl: p.volverEl! }))
            .sort((x, y) => x.volverEl.localeCompare(y.volverEl)),
        }
        return resumen
      },
    },

    mensajes: {
      async deConversacion(id) {
        return [...(mensajes.get(id) ?? [])].sort((x, y) => x.enviadoEn.localeCompare(y.enviadoEn))
      },
    },
  }
}
