import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"

import { NuevaCita } from "@/components/citas/acciones-cita"
import { SemanaDeCitas } from "@/components/citas/semana-de-citas"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { contarSinVincular, lunesDeParametro, semanaVecina, tituloSemana } from "@/lib/citas/semana"
import { obtenerDatos } from "@/lib/data"
import { inicioDeDiaMas } from "@/lib/dominio/fechas"
import { cn } from "@/lib/utils"

type Props = { searchParams: Promise<{ semana?: string | string[] }> }

export default function CitasPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Citas searchParams={searchParams} />
    </Suspense>
  )
}

async function Citas({ searchParams }: Props) {
  await connection()
  const { semana } = await searchParams
  const lunes = lunesDeParametro(typeof semana === "string" ? semana : undefined, new Date())
  const desde = inicioDeDiaMas(`${lunes}T12:00:00-05:00`, 0)
  const datos = await obtenerDatos()
  const [citas, pacientes] = await Promise.all([
    datos.citas.entre(desde, inicioDeDiaMas(desde, 7)),
    datos.pacientes.listar(),
  ])
  const opciones = pacientes.map(({ id, nombre, telefono }) => ({ id, nombre, telefono }))
  const sinVincular = contarSinVincular(citas)
  const enlace = cn(buttonVariants({ variant: "outline", size: "default" }))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
          <p className="text-sm text-muted-foreground">{tituloSemana(lunes)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Cambiar de semana" className="flex items-center gap-2">
            <Link href={`/citas?semana=${semanaVecina(lunes, -1)}`} className={enlace} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/citas" className={enlace}>Hoy</Link>
            <Link href={`/citas?semana=${semanaVecina(lunes, 1)}`} className={enlace} aria-label="Semana siguiente">
              <ChevronRight className="size-4" />
            </Link>
          </nav>
          <NuevaCita pacientes={opciones} />
        </div>
      </div>
      {sinVincular > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium dark:bg-amber-950/30">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          {sinVincular === 1 ? "1 cita sin vincular" : `${sinVincular} citas sin vincular`} a un paciente esta semana.
        </p>
      )}
      <SemanaDeCitas lunes={lunes} citas={citas} pacientes={opciones} />
    </div>
  )
}
