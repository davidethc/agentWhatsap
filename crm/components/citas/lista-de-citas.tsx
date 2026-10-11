import { Badge } from "@/components/ui/badge"
import type { Cita } from "@/lib/data/tipos"
import { ESTADO_CITA } from "@/lib/dominio/etiquetas"
import { claveDia, diaLargo, hora } from "@/lib/dominio/fechas"
import { cn } from "@/lib/utils"

import { AccionesCita } from "./acciones-cita"
import type { PacienteOpcion } from "./dialogo-cita"

const SYNC: Record<Cita["sync"], string | null> = {
  ok: null,
  pendiente: "Sincronizando con Google Calendar…",
  error: "No se pudo sincronizar con Google Calendar",
}

/** Citas agrupadas por día. */
export function ListaDeCitas({ citas, pacientes }: { citas: Cita[]; pacientes: PacienteOpcion[] }) {
  if (citas.length === 0) {
    return <p className="rounded-xl border p-8 text-center text-muted-foreground">No hay citas próximas.</p>
  }
  const dias = Map.groupBy(citas, (c) => claveDia(c.iniciaEn))
  return (
    <div className="flex flex-col gap-6">
      {[...dias].map(([dia, delDia]) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="flex flex-col gap-2">
          <h2 id={`dia-${dia}`} className="text-sm font-semibold first-letter:uppercase">{diaLargo(delDia[0].iniciaEn)}</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {delDia.map((c) => {
              const cancelada = c.estado === "cancelada"
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={cn("w-32 font-medium tabular-nums whitespace-nowrap", cancelada && "text-muted-foreground line-through")}>
                    {hora(c.iniciaEn)}–{hora(c.terminaEn)}
                  </span>
                  <div className={cn("min-w-48 flex-1", cancelada && "text-muted-foreground line-through")}>
                    <p className="font-medium">{c.pacienteNombre ?? "Sin vincular a un paciente"}</p>
                    <p className="text-sm text-muted-foreground">{c.servicio ?? "Sin servicio"}</p>
                    {SYNC[c.sync] && !cancelada && <p className="text-xs text-muted-foreground">{SYNC[c.sync]}</p>}
                  </div>
                  <Badge variant={c.estado === "agendada" ? "outline" : c.estado === "asistio" ? "secondary" : "destructive"}>
                    {ESTADO_CITA[c.estado]}
                  </Badge>
                  <AccionesCita cita={c} pacientes={pacientes} />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
