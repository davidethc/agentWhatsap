import { Suspense } from "react"
import { connection } from "next/server"

import { Tablero } from "@/components/kanban/tablero"
import { Skeleton } from "@/components/ui/skeleton"
import { obtenerDatos } from "@/lib/data"

export default function PacientesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra una tarjeta a otra columna para cambiar la etapa del paciente.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Embudo />
      </Suspense>
    </div>
  )
}

async function Embudo() {
  await connection()
  const ahora = new Date().toISOString()
  const datos = await obtenerDatos()
  const pacientes = await datos.pacientes.listar()
  return <Tablero pacientes={pacientes} ahora={ahora} />
}
