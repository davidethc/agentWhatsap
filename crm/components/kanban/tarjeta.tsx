import { ExternalLink } from "lucide-react"
import Link from "next/link"

import type { Paciente } from "@/lib/data/tipos"
import { MOTIVO_PERDIDO, ORIGEN_PACIENTE } from "@/lib/dominio/etiquetas"
import { tiempoTranscurrido } from "@/lib/dominio/tiempo"
import { cn } from "@/lib/utils"

/** Lo que dice la tarjeta debajo del nombre, según la etapa. */
function detalle(p: Paciente, ahora: string): string {
  if (p.etapa === "perdido" && p.motivoPerdido) return MOTIVO_PERDIDO[p.motivoPerdido]
  if (p.etapa === "seguimiento" && p.volverEl) return `Vuelve el ${p.volverEl.split("-").reverse().join("/")}`
  return tiempoTranscurrido(p.etapaCambiadaEn, ahora)
}

type Props = { paciente: Paciente; ahora: string; flotante?: boolean } & React.ComponentProps<"div">

/** Tarjeta de un paciente. Los props de dnd-kit (arrastrar) llegan en `...resto`. */
export function Tarjeta({ paciente, ahora, flotante, className, children, ...resto }: Props) {
  return (
    <div
      {...resto}
      className={cn(
        "card-surface card-surface-hover group flex flex-col gap-1 p-3 text-sm",
        "cursor-grab touch-manipulation focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        flotante && "rotate-1 shadow-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-snug">{paciente.nombre}</span>
        <Link
          href={`/pacientes/${paciente.id}`}
          aria-label={`Abrir la ficha de ${paciente.nombre}`}
          className="-m-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          // Para que tocar el enlace no empiece un arrastre.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>
      <span className="text-xs text-muted-foreground">
        {ORIGEN_PACIENTE[paciente.origen]} · {detalle(paciente, ahora)}
      </span>
      {children}
    </div>
  )
}
