import { addMonths, format, parseISO } from "date-fns"

/** «volver en»: suma meses a un día yyyy-MM-dd (sin zona: es solo una fecha de calendario). */
export function fechaVolverEn(desde: string, meses: number): string {
  return format(addMonths(parseISO(desde), meses), "yyyy-MM-dd")
}

export const OPCIONES_VOLVER_EN = [
  { meses: 3, etiqueta: "3 meses", porDefecto: false },
  { meses: 6, etiqueta: "6 meses", porDefecto: true },
  { meses: 12, etiqueta: "1 año", porDefecto: false },
] as const
