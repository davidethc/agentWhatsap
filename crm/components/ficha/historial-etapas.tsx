import { ArrowRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CambioEtapa } from "@/lib/data/tipos"
import { ETAPA, MOTIVO_PERDIDO } from "@/lib/dominio/etiquetas"
import { fechaHora } from "@/lib/dominio/fechas"

const QUIEN: Record<CambioEtapa["actor"], string> = {
  personal: "Tú",
  eli: "Eli",
  sistema: "Automático",
  calendario: "Google Calendar",
}

export function HistorialEtapas({ historial }: { historial: CambioEtapa[] }) {
  return (
    <Card className="card-surface-hover">
      <CardHeader>
        <CardTitle>Historial de etapas</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y text-sm">
          {[...historial].reverse().map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-28 text-muted-foreground tabular-nums">{fechaHora(c.en)}</span>
              <span className="flex items-center gap-1.5 font-medium">
                {c.de ? ETAPA[c.de] : "Alta"}
                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="pasó a" />
                {ETAPA[c.a]}
              </span>
              {c.motivoPerdido && <span>Motivo: {MOTIVO_PERDIDO[c.motivoPerdido].toLowerCase()}</span>}
              <span className="ml-auto text-muted-foreground">{QUIEN[c.actor]}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
