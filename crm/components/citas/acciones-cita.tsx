"use client"

import { CalendarPlus, Pencil, X } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cancelarCitaAccion } from "@/lib/acciones/citas"
import type { Cita } from "@/lib/data/tipos"
import { diaLargo, hora } from "@/lib/dominio/fechas"

import { DialogoCita, type PacienteOpcion } from "./dialogo-cita"

/** Botón «Nueva cita». Desde la ficha, `pacienteIdFijo` deja elegido al paciente. */
export function NuevaCita({
  pacientes, pacienteIdFijo, variante = "default",
}: { pacientes: PacienteOpcion[]; pacienteIdFijo?: number; variante?: "default" | "outline" }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button variant={variante} size={variante === "default" ? "lg" : "sm"} onClick={() => setAbierto(true)}>
        <CalendarPlus data-icon="inline-start" />
        Nueva cita
      </Button>
      <DialogoCita abierto={abierto} onCerrar={() => setAbierto(false)} pacientes={pacientes} pacienteIdFijo={pacienteIdFijo} />
    </>
  )
}

/** «Cambiar» y «Cancelar» de una cita agendada (cancelar pide confirmación). */
export function AccionesCita({ cita, pacientes }: { cita: Cita; pacientes: PacienteOpcion[] }) {
  const [editando, setEditando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()

  if (cita.estado !== "agendada") return null

  function cancelar() {
    setError(null)
    empezar(async () => {
      const r = await cancelarCitaAccion(cita.id)
      if (!r.ok) return setError(r.error)
      toast.success("La cita se canceló.")
      setCancelando(false)
    })
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
        <Pencil data-icon="inline-start" />
        Cambiar
      </Button>
      <Button size="sm" variant="outline" onClick={() => setCancelando(true)}>
        <X data-icon="inline-start" />
        Cancelar
      </Button>

      <DialogoCita abierto={editando} onCerrar={() => setEditando(false)} pacientes={pacientes} cita={cita} />

      <Dialog open={cancelando} onOpenChange={(a) => !a && !enCurso && setCancelando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar la cita?</DialogTitle>
            <DialogDescription>
              {cita.pacienteNombre ?? "Cita sin paciente"} · {diaLargo(cita.iniciaEn)} a las {hora(cita.iniciaEn)}.
              Se quitará también de Google Calendar.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelando(false)} disabled={enCurso}>No, volver</Button>
            <Button variant="destructive" onClick={cancelar} disabled={enCurso}>
              {enCurso ? "Cancelando…" : "Sí, cancelar la cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
