"use client"

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { Resumen } from "@/lib/data/tipos"
import { datosBarras, datosDona } from "@/lib/resumen/graficos"

const COLORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export function Graficos({ nuevosPorDia, canales }: Pick<Resumen, "nuevosPorDia" | "canales">) {
  const barras = datosBarras(nuevosPorDia)
  const dona = datosDona(canales)
  const totalNuevos = dona.reduce((s, c) => s + c.nuevos, 0)

  const configBarras = { nuevos: { label: "Nuevos", color: "var(--chart-1)" } } satisfies ChartConfig
  const configDona: ChartConfig = Object.fromEntries(
    dona.map((c, i) => [c.origen, { label: c.nombre, color: COLORES[i % COLORES.length] }])
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pacientes nuevos por día</CardTitle>
          <CardDescription>Esta semana, de lunes a domingo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={configBarras} className="h-56 w-full" role="img" aria-label="Pacientes nuevos por día">
            <BarChart data={barras} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="nuevos" fill="var(--color-nuevos)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por dónde llegan</CardTitle>
          <CardDescription>Pacientes nuevos de la semana, según el canal.</CardDescription>
        </CardHeader>
        <CardContent>
          {dona.length === 0 ? (
            <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Esta semana todavía no hay pacientes nuevos.
            </p>
          ) : (
            <ChartContainer config={configDona} className="h-56 w-full" role="img" aria-label="Canales de los pacientes nuevos">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="origen" />} />
                <Pie data={dona} dataKey="nuevos" nameKey="origen" innerRadius={52} outerRadius={80} strokeWidth={2}>
                  {dona.map((c, i) => (
                    <Cell key={c.origen} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="origen" />} />
                <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-2xl font-semibold">
                  {totalNuevos}
                </text>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
