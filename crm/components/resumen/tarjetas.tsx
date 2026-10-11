import { CalendarCheck, CalendarPlus, UserPlus, UserX, type LucideIcon } from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Resumen } from "@/lib/data/tipos"

type Item = { titulo: string; ayuda: string; valor: number; icono: LucideIcon }

/** Los 4 números de la semana (HU-3). Salen de `resumen_del_dia`: no se calculan en la pantalla. */
export function Tarjetas({ numeros }: { numeros: Resumen["tarjetas"] }) {
  const items: Item[] = [
    { titulo: "Citas hoy", ayuda: "sin contar canceladas", valor: numeros.citasHoy, icono: CalendarCheck },
    { titulo: "Nuevos", ayuda: "esta semana", valor: numeros.nuevosSemana, icono: UserPlus },
    { titulo: "Agendadas", ayuda: "esta semana", valor: numeros.agendadasSemana, icono: CalendarPlus },
    { titulo: "No asistieron", ayuda: "esta semana", valor: numeros.inasistenciasSemana, icono: UserX },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(({ titulo, ayuda, valor, icono: Icono }) => (
        <Card key={titulo}>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Icono className="size-4 text-primary" aria-hidden />
              {titulo}
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
            <p className="text-xs text-muted-foreground">{ayuda}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
