"use client"

import { Check, X } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { marcarAsistenciaAccion } from "@/lib/acciones/citas"
import type { Cita } from "@/lib/data/tipos"
import { ESTADO_CITA } from "@/lib/dominio/etiquetas"
import { hora } from "@/lib/dominio/fechas"
import { fechaVolverEn, OPCIONES_VOLVER_EN } from "@/lib/dominio/retorno"
import { cn } from "@/lib/utils"

type Props = { citas: Cita[]; hoy: string }
type Pendiente = { cita: Cita; asistio: boolean } | null

export function CitasDeHoy({ citas, hoy }: Props) {
  const [pendiente, setPendiente] = useState<Pendiente>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas de hoy</CardTitle>
        <CardDescription>Toca «Asistió» o «No asistió» cuando termine la cita.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {citas.length === 0 && <p className="py-6 text-center text-muted-foreground">Hoy no hay citas.</p>}
        {citas.map((c) => (
          <FilaCita key={c.id} cita={c} onElegir={(asistio) => setPendiente({ cita: c, asistio })} />
        ))}
      </CardContent>
      <DialogoAsistio
        abierto={pendiente?.asistio === true}
        cita={pendiente?.cita ?? null}
        hoy={hoy}
        onCerrar={() => setPendiente(null)}
      />
      <DialogoNoAsistio abierto={pendiente?.asistio === false} cita={pendiente?.cita ?? null} onCerrar={() => setPendiente(null)} />
    </Card>
  )
}

function FilaCita({ cita, onElegir }: { cita: Cita; onElegir: (asistio: boolean) => void }) {
  const cancelada = cita.estado === "cancelada"
  const sinVincular = cita.pacienteId === null
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className={cn("w-14 font-medium tabular-nums", cancelada && "line-through text-muted-foreground")}>
        {hora(cita.iniciaEn)}
      </span>
      <span className={cn("min-w-40 flex-1", cancelada && "line-through text-muted-foreground")}>
        {cita.pacienteNombre ?? "Sin vincular a un paciente"}
        {cita.servicio && <span className="text-muted-foreground"> · {cita.servicio}</span>}
      </span>
      {cita.estado === "agendada" && !sinVincular ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onElegir(true)}>
            <Check data-icon="inline-start" />
            Asistió
          </Button>
          <Button size="sm" variant="outline" onClick={() => onElegir(false)}>
            <X data-icon="inline-start" />
            No asistió
          </Button>
        </div>
      ) : (
        <Badge variant={cita.estado === "asistio" ? "secondary" : cita.estado === "agendada" ? "outline" : "destructive"}>
          {ESTADO_CITA[cita.estado]}
        </Badge>
      )}
    </div>
  )
}

type DialogoProps = { abierto: boolean; cita: Cita | null; onCerrar: () => void }

function DialogoAsistio({ abierto, cita, hoy, onCerrar }: DialogoProps & { hoy: string }) {
  // "6" | "3" | "12" | "otra" | "ninguno"
  const [opcion, setOpcion] = useState("6")
  const [otra, setOtra] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()

  const volverEl =
    opcion === "ninguno" ? null : opcion === "otra" ? otra : fechaVolverEn(hoy, Number(opcion))

  function guardar() {
    if (!cita) return
    if (opcion === "otra" && !/^\d{4}-\d{2}-\d{2}$/.test(otra)) {
      setError("Elige la fecha en que quieres volver a ver al paciente.")
      return
    }
    setError(null)
    empezar(async () => {
      const r = await marcarAsistenciaAccion({ citaId: cita.id, asistio: true, volverEl })
      if (!r.ok) return setError(r.error)
      toast.success(`${cita.pacienteNombre ?? "Paciente"} pasó a Seguimiento.`)
      setOpcion("6")
      setOtra("")
      onCerrar()
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && !enCurso && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asistió: {cita?.pacienteNombre}</DialogTitle>
          <DialogDescription>¿Cuándo quieres volver a ver a este paciente?</DialogDescription>
        </DialogHeader>
        <RadioGroup value={opcion} onValueChange={setOpcion} className="gap-3">
          {OPCIONES_VOLVER_EN.map((o) => (
            <div key={o.meses} className="flex items-center gap-3">
              <RadioGroupItem id={`volver-${o.meses}`} value={String(o.meses)} />
              <Label htmlFor={`volver-${o.meses}`}>
                Volver en {o.etiqueta}
                {o.porDefecto && <span className="text-muted-foreground"> (recomendado)</span>}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <RadioGroupItem id="volver-otra" value="otra" />
            <Label htmlFor="volver-otra">Otra fecha</Label>
            {opcion === "otra" && (
              <Input
                type="date"
                aria-label="Fecha para volver"
                className="w-44"
                min={hoy}
                value={otra}
                onChange={(e) => setOtra(e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem id="volver-ninguno" value="ninguno" />
            <Label htmlFor="volver-ninguno">Sin fecha de retorno</Label>
          </div>
        </RadioGroup>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>Cancelar</Button>
          <Button onClick={guardar} disabled={enCurso}>{enCurso ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoNoAsistio({ abierto, cita, onCerrar }: DialogoProps) {
  const [error, setError] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()

  function confirmar() {
    if (!cita) return
    setError(null)
    empezar(async () => {
      const r = await marcarAsistenciaAccion({ citaId: cita.id, asistio: false, volverEl: null })
      if (!r.ok) return setError(r.error)
      toast.success(`${cita.pacienteNombre ?? "Paciente"} pasó a Perdido (no asistió).`)
      onCerrar()
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && !enCurso && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿{cita?.pacienteNombre} no asistió?</DialogTitle>
          <DialogDescription>
            La cita quedará como «No asistió» y el paciente pasará a Perdido.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={enCurso}>
            {enCurso ? "Guardando…" : "Sí, no asistió"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
