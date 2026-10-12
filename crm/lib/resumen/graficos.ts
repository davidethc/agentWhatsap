import type { Resumen } from "@/lib/data/tipos"
import { ORIGEN_PACIENTE } from "@/lib/dominio/etiquetas"
import { fechaCorta } from "@/lib/dominio/fechas"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const dia = (d: string) => {
  const [a, m, n] = d.split("-").map(Number)
  return new Date(a, m - 1, n)
}

/** «lun 12» para el eje de las barras. */
export function datosBarras(nuevosPorDia: Resumen["nuevosPorDia"]) {
  return nuevosPorDia.map((x) => ({
    dia: x.dia,
    etiqueta: format(dia(x.dia), "EEE d", { locale: es }),
    nuevos: x.nuevos,
  }))
}

/** Solo los canales que tuvieron pacientes nuevos esta semana. */
export function datosDona(canales: Resumen["canales"]) {
  return canales
    .filter((c) => c.nuevos > 0)
    .map((c) => ({ origen: c.origen, nombre: ORIGEN_PACIENTE[c.origen], nuevos: c.nuevos }))
}

/** «Hoy», «Desde el 9 oct» (ya pasó) o «El 14 oct». */
export function textoRetorno(volverEl: string, hoy: string): string {
  const corta = fechaCorta(volverEl).replace(/ \d{4}$/, "")
  if (volverEl === hoy) return "Hoy"
  return volverEl < hoy ? `Desde el ${corta}` : `El ${corta}`
}
