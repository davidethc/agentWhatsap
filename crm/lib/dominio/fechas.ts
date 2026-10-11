import { TZDate } from "@date-fns/tz"
import { addDays, endOfDay, format, getISODay, startOfDay, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"

/** Ecuador continental: UTC-5 todo el año (sin horario de verano). */
export const ZONA = "America/Guayaquil"

const enZona = (fecha: Date | string | number) => new TZDate(new Date(fecha), ZONA)

/** Inicio del día en Guayaquil (como instante UTC). */
export function inicioDelDia(fecha: Date | string | number): Date {
  return new Date(startOfDay(enZona(fecha)).getTime())
}

/** Último instante del día en Guayaquil (como instante UTC). */
export function finDelDia(fecha: Date | string | number): Date {
  return new Date(endOfDay(enZona(fecha)).getTime())
}

/** Inicio del día, `dias` días después (puede ser negativo). */
export function inicioDeDiaMas(fecha: Date | string | number, dias: number): Date {
  return new Date(addDays(startOfDay(enZona(fecha)), dias).getTime())
}

/** «2026-10-10»: fecha en Guayaquil, útil como clave de día. */
export function claveDia(fecha: Date | string | number): string {
  return format(enZona(fecha), "yyyy-MM-dd")
}

/** «sábado 10 oct» */
export function diaLargo(fecha: Date | string | number): string {
  return format(enZona(fecha), "EEEE d MMM", { locale: es })
}

/** «09:00» */
export function hora(fecha: Date | string | number): string {
  return format(enZona(fecha), "HH:mm")
}

/** Lunes de la semana de `fecha`, a las 00:00 en Guayaquil. */
export function inicioDeSemana(fecha: Date | string | number): Date {
  return new Date(startOfWeek(enZona(fecha), { weekStartsOn: 1 }).getTime())
}

/** «dia_semana» ISO (1 = lunes … 7 = domingo) y minutos desde medianoche, en Guayaquil. */
export function diaYMinutos(fecha: Date | string | number): { diaSemana: number; minutos: number } {
  const f = enZona(fecha)
  return { diaSemana: getISODay(f), minutos: f.getHours() * 60 + f.getMinutes() }
}

/** «10 oct, 09:30» */
export function fechaHora(fecha: Date | string | number): string {
  return format(enZona(fecha), "d MMM, HH:mm", { locale: es })
}

/** «10 oct 2026» (para fechas yyyy-MM-dd de calendario, sin pasar por zonas). */
export function fechaCorta(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number)
  return format(new Date(a, m - 1, d), "d MMM yyyy", { locale: es })
}
