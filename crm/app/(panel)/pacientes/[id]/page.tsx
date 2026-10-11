import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CitasDelPaciente } from "@/components/ficha/citas-del-paciente"
import { DatosBasicos } from "@/components/ficha/datos-basicos"
import { Encabezado } from "@/components/ficha/encabezado"
import { HistorialEtapas } from "@/components/ficha/historial-etapas"
import { Skeleton } from "@/components/ui/skeleton"
import { obtenerDatos } from "@/lib/data"

export default function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/pacientes" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Pacientes
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Ficha params={params} />
      </Suspense>
    </div>
  )
}

async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const datos = await obtenerDatos()
  const ficha = await datos.pacientes.obtener(Number(id))
  if (!ficha) notFound()
  return (
    <>
      <Encabezado ficha={ficha} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <DatosBasicos key={JSON.stringify([ficha.paciente.id, ficha.paciente.nombre, ficha.paciente.cedula, ficha.paciente.fechaNacimiento, ficha.paciente.correo])} paciente={ficha.paciente} />
          <CitasDelPaciente citas={ficha.citas} />
        </div>
        <HistorialEtapas historial={ficha.historial} />
      </div>
    </>
  )
}
