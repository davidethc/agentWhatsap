import { Cake, Undo2 } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Resumen } from "@/lib/data/tipos"
import { ETAPA } from "@/lib/dominio/etiquetas"
import { diaLargo } from "@/lib/dominio/fechas"
import { textoRetorno } from "@/lib/resumen/graficos"

const enlace = "font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded"

type Props = Pick<Resumen, "cumpleanosHoy" | "cumpleanosSemana" | "retornos"> & { hoy: string }

/** Listas para que la doctora salude o llame ella misma: no hay botón para enviar mensajes. */
export function CumpleanosYRetornos({ cumpleanosHoy, cumpleanosSemana, retornos, hoy }: Props) {
  const esteSemana = cumpleanosSemana.filter((c) => c.cumple !== hoy)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="size-4 text-primary" aria-hidden />
            Cumpleaños
          </CardTitle>
          <CardDescription>De hoy y del resto de la semana.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <section aria-label="Cumpleaños de hoy">
            <h3 className="mb-1 font-semibold">Hoy</h3>
            {cumpleanosHoy.length === 0 ? (
              <p className="text-muted-foreground">Hoy no cumple nadie.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {cumpleanosHoy.map((c) => (
                  <li key={c.id}>
                    <Link href={`/pacientes/${c.id}`} className={enlace}>{c.nombre}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Cumpleaños del resto de la semana">
            <h3 className="mb-1 font-semibold">Esta semana</h3>
            {esteSemana.length === 0 ? (
              <p className="text-muted-foreground">No hay más cumpleaños esta semana.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {esteSemana.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <Link href={`/pacientes/${c.id}`} className={enlace}>{c.nombre}</Link>
                    <span className="text-muted-foreground first-letter:uppercase">{diaLargo(`${c.cumple}T12:00:00-05:00`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="size-4 text-primary" aria-hidden />
            Retornos
          </CardTitle>
          <CardDescription>Pacientes que quieres volver a ver esta semana (o antes) y no tienen cita.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {retornos.length === 0 ? (
            <p className="text-muted-foreground">No hay retornos pendientes.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {retornos.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 py-2">
                  <Link href={`/pacientes/${r.id}`} className={enlace}>{r.nombre}</Link>
                  <span className="text-muted-foreground">
                    {textoRetorno(r.volverEl, hoy)} · {ETAPA[r.etapa]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
