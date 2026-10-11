import { addDays, format, isValid, parse } from "date-fns"
import { es } from "date-fns/locale"

import type { Cita } from "@/lib/data/tipos"
import { claveDia, inicioDeSemana } from "@/lib/dominio/fechas"

const FORMATO = "yyyy-MM-dd"
const aFecha = (clave: string) => parse(clave, FORMATO, new Date(2000, 0, 1))
const aClave = (f: Date) => format(f, FORMATO)

/** Lunes (yyyy-MM-dd) de la semana pedida; si el parámetro falta o no sirve, la semana de `hoy`. */
export function lunesDeParametro(parametro: string | undefined, hoy: Date): string {
  if (parametro && /^\d{4}-\d{2}-\d{2}$/.test(parametro)) {
    const f = aFecha(parametro)
    if (isValid(f) && aClave(f) === parametro) return aClave(addDays(f, -((f.getDay() + 6) % 7)))
  }
  return claveDia(inicioDeSemana(hoy))
}

export function semanaVecina(lunes: string, semanas: number): string {
  return aClave(addDays(aFecha(lunes), semanas * 7))
}

/** Las 7 claves de día, de lunes a domingo. */
export function diasDeSemana(lunes: string): string[] {
  const base = aFecha(lunes)
  return Array.from({ length: 7 }, (_, i) => aClave(addDays(base, i)))
}

/** «Semana 5–11 oct» o «Semana 26 oct–1 nov». */
export function tituloSemana(lunes: string): string {
  const ini = aFecha(lunes)
  const fin = addDays(ini, 6)
  if (ini.getMonth() === fin.getMonth()) return `Semana ${ini.getDate()}–${format(fin, "d MMM", { locale: es })}`
  return `Semana ${format(ini, "d MMM", { locale: es })}–${format(fin, "d MMM", { locale: es })}`
}

export type DiaDeSemana = { dia: string; citas: Cita[] }

/** Los 7 días con sus citas (día local de Guayaquil), ordenadas por hora. */
export function agruparPorDia(lunes: string, citas: Cita[]): DiaDeSemana[] {
  const ordenadas = [...citas].sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn))
  return diasDeSemana(lunes).map((dia) => ({ dia, citas: ordenadas.filter((c) => claveDia(c.iniciaEn) === dia) }))
}

/** Citas agendadas que aún no tienen paciente. */
export function contarSinVincular(citas: Cita[]): number {
  return citas.filter((c) => c.pacienteId === null && c.estado === "agendada").length
}
