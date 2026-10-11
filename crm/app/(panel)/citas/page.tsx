import { connection } from "next/server"
import { Suspense } from "react"

import { NuevaCita } from "@/components/citas/acciones-cita"
import { ListaDeCitas } from "@/components/citas/lista-de-citas"
import { Skeleton } from "@/components/ui/skeleton"
import { obtenerDatos } from "@/lib/data"
import { inicioDeDiaMas } from "@/lib/dominio/fechas"

export default function CitasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Citas />
    </Suspense>
  )
}

async function Citas() {
  await connection()
  const datos = await obtenerDatos()
  const hoy = new Date()
  const [citas, pacientes] = await Promise.all([
    datos.citas.entre(inicioDeDiaMas(hoy, 0), inicioDeDiaMas(hoy, 60)),
    datos.pacientes.listar(),
  ])
  const opciones = pacientes.map(({ id, nombre, telefono }) => ({ id, nombre, telefono }))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
          <p className="text-sm text-muted-foreground">De hoy a los próximos 60 días.</p>
        </div>
        <NuevaCita pacientes={opciones} />
      </div>
      <ListaDeCitas citas={citas} pacientes={opciones} />
    </div>
  )
}
