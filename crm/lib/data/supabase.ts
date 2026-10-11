import type { SupabaseClient } from "@supabase/supabase-js"

import { claveDia, finDelDia, inicioDelDia } from "@/lib/dominio/fechas"

import { ErrorDatos, type Datos } from "./interfaz"
import type {
  CambioEtapa,
  Cita,
  DatosClinicos,
  OrigenPaciente,
  Paciente,
  Resumen,
} from "./tipos"

/*
 * Adaptador real. Reglas:
 *  - LEE de las tablas (la RLS deja ver solo al personal).
 *  - ESCRIBE solo llamando a las funciones de la base (mover_etapa, crear_paciente, guardar_cita,
 *    cancelar_cita, marcar_asistencia): ahí viven las reglas del embudo.
 *
 * TODO(TK-8..11): cuando exista `database.types.ts`, tipar el cliente con `SupabaseClient<Database>`
 * y reemplazar las Fila* de abajo por los tipos generados.
 */

type FilaPaciente = {
  id: number
  nombre: string
  conversacion_id: number | null
  responsable_id: number | null
  cedula: string | null
  fecha_nacimiento: string | null
  correo: string | null
  origen: Paciente["origen"]
  etapa: Paciente["etapa"]
  motivo_perdido: Paciente["motivoPerdido"]
  volver_el: string | null
  consentimiento_firmado_en: string | null
  etapa_cambiada_en: string
  conversaciones?: { telefono: string } | null
}

type FilaCita = {
  id: number
  paciente_id: number | null
  inicia_en: string
  termina_en: string
  servicio: string | null
  estado: Cita["estado"]
  origen: Cita["origen"]
  sync: Cita["sync"]
  pacientes?: { nombre: string } | null
}

const PACIENTE_SELECT = "*, conversaciones(telefono)"
const CITA_SELECT = "*, pacientes(nombre)"

const aPaciente = (f: FilaPaciente): Paciente => ({
  id: f.id,
  nombre: f.nombre,
  telefono: f.conversaciones?.telefono ?? null,
  conversacionId: f.conversacion_id,
  responsableId: f.responsable_id,
  cedula: f.cedula,
  fechaNacimiento: f.fecha_nacimiento,
  correo: f.correo,
  origen: f.origen,
  etapa: f.etapa,
  motivoPerdido: f.motivo_perdido,
  volverEl: f.volver_el,
  consentimientoFirmadoEn: f.consentimiento_firmado_en,
  etapaCambiadaEn: f.etapa_cambiada_en,
})

const aCita = (f: FilaCita): Cita => ({
  id: f.id,
  pacienteId: f.paciente_id,
  pacienteNombre: f.pacientes?.nombre ?? null,
  iniciaEn: f.inicia_en,
  terminaEn: f.termina_en,
  servicio: f.servicio,
  estado: f.estado,
  origen: f.origen,
  sync: f.sync,
})

type FilaCumple = { id: number; nombre: string; fecha_nacimiento: string; cumple: string }

type FilaResumen = {
  fecha: string
  semana: { desde: string; hasta: string }
  citas_hoy: {
    id: number
    inicia_en: string
    termina_en: string
    servicio: string | null
    estado: Cita["estado"]
    origen: Cita["origen"]
    paciente_id: number | null
    paciente_nombre: string | null
  }[]
  numeros: {
    citas_hoy: number
    nuevos_hoy: number
    nuevos_semana: number
    agendadas_semana: number
    inasistencias_semana: number
  }
  nuevos_por_dia: { dia: string; nuevos: number }[]
  canales: { origen: OrigenPaciente; nuevos: number; agendadas: number; inasistencias: number }[]
  cumpleanos_hoy: FilaCumple[]
  cumpleanos_semana: FilaCumple[]
  retornos: { id: number; nombre: string; etapa: Paciente["etapa"]; volver_el: string }[]
}

const aCumple = (c: FilaCumple) => ({
  id: c.id,
  nombre: c.nombre,
  fechaNacimiento: c.fecha_nacimiento,
  cumple: c.cumple,
})

/** La función no devuelve `sync`: en el resumen se muestra como «ok». */
export const aResumen = (f: FilaResumen): Resumen => ({
  fecha: f.fecha,
  semana: f.semana,
  citasHoy: f.citas_hoy.map((c) => ({
    id: c.id,
    pacienteId: c.paciente_id,
    pacienteNombre: c.paciente_nombre,
    iniciaEn: c.inicia_en,
    terminaEn: c.termina_en,
    servicio: c.servicio,
    estado: c.estado,
    origen: c.origen,
    sync: "ok",
  })),
  tarjetas: {
    citasHoy: f.numeros.citas_hoy,
    nuevosHoy: f.numeros.nuevos_hoy,
    nuevosSemana: f.numeros.nuevos_semana,
    agendadasSemana: f.numeros.agendadas_semana,
    inasistenciasSemana: f.numeros.inasistencias_semana,
  },
  nuevosPorDia: f.nuevos_por_dia,
  canales: f.canales,
  cumpleanosHoy: f.cumpleanos_hoy.map(aCumple),
  cumpleanosSemana: f.cumpleanos_semana.map(aCumple),
  retornos: f.retornos.map((r) => ({ id: r.id, nombre: r.nombre, etapa: r.etapa, volverEl: r.volver_el })),
})

type ErrorPostgrest = { message: string; code?: string } | null

/** Los mensajes de las funciones de la base ya están en español: se muestran tal cual. */
function lanzar(error: ErrorPostgrest, porDefecto: string): never {
  const propio = error?.code && /^(22023|23P01|P0002|42501|23514|23505)$/.test(error.code)
  throw new ErrorDatos(propio ? error.message : porDefecto, error?.code)
}

function comprobar<T>(r: { data: T | null; error: ErrorPostgrest }, porDefecto: string): T {
  if (r.error) lanzar(r.error, porDefecto)
  return r.data as T
}

export function crearDatosSupabase(supabase: SupabaseClient): Datos {
  async function pacientePorId(id: number): Promise<Paciente> {
    const r = await supabase.from("pacientes").select(PACIENTE_SELECT).eq("id", id).maybeSingle()
    const fila = comprobar(r, "No se pudo cargar el paciente. Intenta de nuevo.")
    if (!fila) throw new ErrorDatos("Paciente no encontrado", "P0002")
    return aPaciente(fila as unknown as FilaPaciente)
  }

  async function citaPorId(id: number): Promise<Cita> {
    const r = await supabase.from("citas").select(CITA_SELECT).eq("id", id).maybeSingle()
    const fila = comprobar(r, "No se pudo cargar la cita. Intenta de nuevo.")
    if (!fila) throw new ErrorDatos("Cita no encontrada", "P0002")
    return aCita(fila as unknown as FilaCita)
  }

  return {
    pacientes: {
      async listar(filtro) {
        let q = supabase.from("pacientes").select(PACIENTE_SELECT).order("etapa_cambiada_en", { ascending: false })
        const texto = filtro?.texto?.replace(/[%,()*\\]/g, " ").trim()
        if (texto) {
          const condiciones = [`nombre.ilike.%${texto}%`]
          const digitos = texto.replace(/\D/g, "")
          if (digitos.length >= 3) {
            const conv = await supabase.from("conversaciones").select("id").like("telefono", `%${digitos}%`)
            const ids = (comprobar(conv, "No se pudo buscar. Intenta de nuevo.") as { id: number }[]).map((c) => c.id)
            if (ids.length) condiciones.push(`conversacion_id.in.(${ids.join(",")})`)
          }
          q = q.or(condiciones.join(","))
        }
        const filas = comprobar(await q, "No se pudo cargar los pacientes. Intenta de nuevo.")
        return (filas as unknown as FilaPaciente[]).map(aPaciente)
      },

      async obtener(id) {
        const r = await supabase.from("pacientes").select(PACIENTE_SELECT).eq("id", id).maybeSingle()
        const fila = comprobar(r, "No se pudo cargar el paciente. Intenta de nuevo.")
        if (!fila) return null
        const paciente = aPaciente(fila as unknown as FilaPaciente)

        const [resp, deps, clin, cts, hist] = await Promise.all([
          paciente.responsableId
            ? supabase.from("pacientes").select("id, nombre").eq("id", paciente.responsableId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from("pacientes").select("id, nombre").eq("responsable_id", id).order("nombre"),
          supabase.from("datos_clinicos").select("alergias, enfermedades, embarazo, miedo").eq("paciente_id", id).maybeSingle(),
          supabase.from("citas").select(CITA_SELECT).eq("paciente_id", id).order("inicia_en", { ascending: false }),
          supabase.from("cambios_etapa").select("id, de, a, motivo_perdido, actor, en").eq("paciente_id", id).order("en"),
        ])
        const msg = "No se pudo cargar la ficha. Intenta de nuevo."
        return {
          paciente,
          responsable: comprobar(resp as never, msg) as { id: number; nombre: string } | null,
          dependientes: comprobar(deps, msg) as { id: number; nombre: string }[],
          datosClinicos: comprobar(clin, msg) as DatosClinicos | null,
          citas: (comprobar(cts, msg) as unknown as FilaCita[]).map(aCita),
          historial: (
            comprobar(hist, msg) as unknown as (Omit<CambioEtapa, "motivoPerdido"> & { motivo_perdido: CambioEtapa["motivoPerdido"] })[]
          ).map(({ motivo_perdido, ...resto }) => ({ ...resto, motivoPerdido: motivo_perdido })),
        }
      },

      async crear(e) {
        const r = await supabase.rpc("crear_paciente", {
          p_nombre: e.nombre,
          p_origen: e.origen,
          p_telefono: e.telefono ?? null,
          p_cedula: e.cedula ?? null,
          p_fecha_nacimiento: e.fechaNacimiento ?? null,
          p_correo: e.correo ?? null,
          p_responsable_id: e.responsableId ?? null,
        })
        const res = comprobar(r, "No se pudo crear el paciente. Intenta de nuevo.") as {
          duplicado: boolean
          paciente: FilaPaciente
        }
        // La función devuelve la fila sin el teléfono: se vuelve a leer completa.
        return { duplicado: res.duplicado, paciente: await pacientePorId(res.paciente.id) }
      },

      async actualizar(id, d) {
        const r = await supabase
          .from("pacientes")
          .update({
            nombre: d.nombre,
            cedula: d.cedula,
            fecha_nacimiento: d.fechaNacimiento,
            correo: d.correo,
          })
          .eq("id", id)
          .select("id")
          .maybeSingle()
        const fila = comprobar(r, "No se pudo guardar los datos. Intenta de nuevo.")
        if (!fila) throw new ErrorDatos("No se pudo guardar los datos. Intenta de nuevo.", "42501")
        return pacientePorId(id)
      },

      async marcarConsentimiento(id, fecha) {
        // Escritura directa (no hay función de la base): mediodía en Guayaquil para que el día no se corra.
        const r = await supabase
          .from("pacientes")
          .update({ consentimiento_firmado_en: `${fecha}T12:00:00-05:00` })
          .eq("id", id)
          .select("id")
          .maybeSingle()
        const fila = comprobar(r, "No se pudo guardar el consentimiento. Intenta de nuevo.")
        if (!fila) throw new ErrorDatos("No se pudo guardar el consentimiento. Intenta de nuevo.", "42501")
        return pacientePorId(id)
      },

      async guardarClinicos(id, d) {
        // Escritura directa (no hay función de la base). No se usa upsert: ese también reescribe
        // paciente_id y el permiso por columna solo deja cambiar los 4 datos clínicos.
        // El trigger de la base responde P0001 si falta el consentimiento: se traduce a un mensaje claro.
        const existe = comprobar(
          await supabase.from("datos_clinicos").select("paciente_id").eq("paciente_id", id).maybeSingle(),
          "No se pudo guardar los datos clínicos. Intenta de nuevo."
        )
        const campos = { alergias: d.alergias, enfermedades: d.enfermedades, embarazo: d.embarazo, miedo: d.miedo }
        const consulta = existe
          ? supabase.from("datos_clinicos").update(campos).eq("paciente_id", id)
          : supabase.from("datos_clinicos").insert({ paciente_id: id, ...campos })
        const r = await consulta.select("alergias, enfermedades, embarazo, miedo").maybeSingle()
        if (r.error?.code === "P0001") {
          throw new ErrorDatos(
            "Falta el consentimiento firmado del paciente. Márcalo en la ficha antes de guardar datos clínicos.",
            "P0001"
          )
        }
        const fila = comprobar(r, "No se pudo guardar los datos clínicos. Intenta de nuevo.")
        if (!fila) throw new ErrorDatos("No se pudo guardar los datos clínicos. Intenta de nuevo.", "42501")
        return fila as DatosClinicos
      },

      async moverEtapa(id, etapa, motivo) {
        const r = await supabase.rpc("mover_etapa", {
          p_paciente_id: id,
          p_etapa: etapa,
          p_motivo: motivo ?? null,
        })
        comprobar(r, "No se pudo mover al paciente. Intenta de nuevo.")
        return pacientePorId(id)
      },
    },

    citas: {
      async delDia(dia) {
        return this.entre(inicioDelDia(dia), new Date(finDelDia(dia).getTime() + 1))
      },

      async entre(desde, hasta) {
        const r = await supabase
          .from("citas")
          .select(CITA_SELECT)
          .gte("inicia_en", desde.toISOString())
          .lt("inicia_en", hasta.toISOString())
          .order("inicia_en")
        return (comprobar(r, "No se pudo cargar las citas. Intenta de nuevo.") as unknown as FilaCita[]).map(aCita)
      },

      async guardar(e) {
        const r = await supabase.rpc("guardar_cita", {
          p_paciente_id: e.pacienteId,
          p_inicia_en: e.iniciaEn,
          p_termina_en: e.terminaEn ?? null,
          p_servicio: e.servicio ?? null,
          p_cita_id: e.citaId ?? null,
        })
        const fila = comprobar(r, "No se pudo guardar la cita. Intenta de nuevo.") as { id: number }
        return citaPorId(fila.id)
      },

      async cancelar(citaId) {
        const r = await supabase.rpc("cancelar_cita", { p_cita_id: citaId })
        comprobar(r, "No se pudo cancelar la cita. Intenta de nuevo.")
        return citaPorId(citaId)
      },

      async marcarAsistencia(citaId, asistio, volverEl) {
        const r = await supabase.rpc("marcar_asistencia", {
          p_cita_id: citaId,
          p_asistio: asistio,
          // omitido = la base usa 6 meses; null = sin retorno.
          ...(asistio && volverEl !== undefined ? { p_volver_el: volverEl } : {}),
        })
        comprobar(r, "No se pudo guardar la asistencia. Intenta de nuevo.")
        return citaPorId(citaId)
      },
    },

    resumen: {
      async delDia(dia) {
        const r = await supabase.rpc("resumen_del_dia", dia ? { p_fecha: claveDia(dia) } : {})
        return aResumen(comprobar(r, "No se pudo cargar el resumen. Intenta de nuevo.") as unknown as FilaResumen)
      },
    },

  }
}
