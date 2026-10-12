import { Badge } from "@/components/ui/badge"
import type { Cita } from "@/lib/data/tipos"
import { ESTADO_CITA } from "@/lib/dominio/etiquetas"
import { claveDia, diaLargo, hora } from "@/lib/dominio/fechas"
import { agruparPorDia, sePuedeVincular } from "@/lib/citas/semana"
import { cn } from "@/lib/utils"

import { AccionesCita } from "./acciones-cita"
import type { PacienteOpcion } from "./dialogo-cita"
import { VincularCita } from "./dialogo-vincular"

/** Semana de lunes a domingo: 7 columnas en pantalla grande, 2 en tablet y 1 en celular. */
export function SemanaDeCitas({ lunes, citas, pacientes }: { lunes: string; citas: Cita[]; pacientes: PacienteOpcion[] }) {
  const dias = agruparPorDia(lunes, citas)
  const hoy = claveDia(new Date())
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {dias.map(({ dia, citas: delDia }) => (
          <section key={dia} aria-labelledby={`dia-${dia}`} className="flex flex-col gap-2">
            <h2
              id={`dia-${dia}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold first-letter:uppercase",
                dia === hoy ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {diaLargo(`${dia}T12:00:00-05:00`)}
            </h2>
            {delDia.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Sin citas</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {delDia.map((c) => <TarjetaCita key={c.id} cita={c} pacientes={pacientes} />)}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function TarjetaCita({ cita: c, pacientes }: { cita: Cita; pacientes: PacienteOpcion[] }) {
  const cancelada = c.estado === "cancelada"
  const sinVincular = sePuedeVincular(c)
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3",
        sinVincular && "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
      )}
    >
      <div className={cn("flex flex-col gap-0.5", cancelada && "text-muted-foreground line-through")}>
        <span className="font-semibold tabular-nums">{hora(c.iniciaEn)}–{hora(c.terminaEn)}</span>
        <span className="font-medium">{c.pacienteNombre ?? "Sin vincular a un paciente"}</span>
        <span className="text-sm text-muted-foreground">{c.servicio ?? "Sin servicio"}</span>
      </div>
      <div>
        <Badge variant={c.estado === "agendada" ? "outline" : c.estado === "asistio" ? "secondary" : "destructive"}>
          {ESTADO_CITA[c.estado]}
        </Badge>
      </div>
      {sinVincular ? (
        <div className="flex flex-wrap gap-2">
          <VincularCita cita={c} pacientes={pacientes} />
        </div>
      ) : null}
      <AccionesCita cita={c} pacientes={pacientes} />
    </li>
  )
}
