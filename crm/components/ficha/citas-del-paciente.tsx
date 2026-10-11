import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Cita } from "@/lib/data/tipos"
import { ESTADO_CITA } from "@/lib/dominio/etiquetas"
import { fechaHora } from "@/lib/dominio/fechas"
import { cn } from "@/lib/utils"

export function CitasDelPaciente({ citas }: { citas: Cita[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas</CardTitle>
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
