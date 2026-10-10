import { CalendarCheck, UserPlus, Users, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Página de prueba del scaffold (TK-21). Los datos son inventados.
const tarjetas = [
  { titulo: "Citas hoy", valor: 4, icono: CalendarCheck },
  { titulo: "Nuevos (semana)", valor: 6, icono: UserPlus },
  { titulo: "Agendados (semana)", valor: 9, icono: Users },
  { titulo: "No asistieron (semana)", valor: 1, icono: UserX },
]

const citas = [
  { hora: "09:00", paciente: "Paciente A", motivo: "Limpieza", estado: "Agendada" },
  { hora: "11:00", paciente: "Paciente B", motivo: "Control", estado: "Asistió" },
  { hora: "15:30", paciente: "Paciente C", motivo: "Valoración", estado: "Agendada" },
]

export default function ResumenPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen del día</h1>
          <p className="text-sm text-muted-foreground">Página de prueba del diseño base</p>
        </div>
        <Button size="lg">
          <UserPlus data-icon="inline-start" />
          Nuevo paciente
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map(({ titulo, valor, icono: Icono }) => (
          <Card key={titulo}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icono className="size-4 text-primary" />
                {titulo}
              </CardDescription>
              <CardTitle className="text-3xl">{valor}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citas de hoy</CardTitle>
          <CardDescription>Toca «Asistió» o «No asistió» cuando termine la cita.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {citas.map((c) => (
            <div key={c.hora} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-14 font-medium tabular-nums">{c.hora}</span>
              <span className="flex-1">
                {c.paciente} · <span className="text-muted-foreground">{c.motivo}</span>
              </span>
              {c.estado === "Asistió" ? (
                <Badge variant="secondary">Asistió</Badge>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm">Asistió</Button>
                  <Button size="sm" variant="outline">
                    No asistió
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
