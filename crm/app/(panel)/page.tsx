import { Suspense } from "react"

import { CitasDeHoy } from "@/components/resumen/citas-de-hoy"
import { Skeleton } from "@/components/ui/skeleton"
import { obtenerDatos } from "@/lib/data"
import { diaLargo } from "@/lib/dominio/fechas"

export default function ResumenPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ResumenDelDia />
      </Suspense>
    </div>
  )
}

async function ResumenDelDia() {
  const datos = await obtenerDatos()
  const resumen = await datos.resumen.delDia()
  const dia = diaLargo(`${resumen.fecha}T12:00:00-05:00`)
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen del día</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{dia}</p>
      </div>
      <CitasDeHoy citas={resumen.citasHoy} hoy={resumen.fecha} />
    </>
  )
}
