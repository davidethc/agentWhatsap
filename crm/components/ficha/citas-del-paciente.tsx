import { AccionesCita, NuevaCita } from "@/components/citas/acciones-cita"
import type { PacienteOpcion } from "@/components/citas/dialogo-cita"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Cita } from "@/lib/data/tipos"
import { ESTADO_CITA } from "@/lib/dominio/etiquetas"
import { fechaHora } from "@/lib/dominio/fechas"
import { cn } from "@/lib/utils"

export function CitasDelPaciente({ citas, paciente }: { citas: Cita[]; paciente: PacienteOpcion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas</CardTitle>
        <CardAction>
          <NuevaCita variante="outline" pacientes={[paciente]} pacienteIdFijo={paciente.id} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {citas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene citas.</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {citas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className={cn("w-28 tabular-nums", c.estado === "cancelada" && "text-muted-foreground line-through")}>
                  {fechaHora(c.iniciaEn)}
                </span>
                <span className="flex-1">{c.servicio ?? "Sin servicio"}</span>
                <Badge variant={c.estado === "agendada" ? "outline" : c.estado === "asistio" ? "secondary" : "destructive"}>
                  {ESTADO_CITA[c.estado]}
                </Badge>
                <AccionesCita cita={c} pacientes={[paciente]} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
