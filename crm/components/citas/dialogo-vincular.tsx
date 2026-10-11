"use client"

import { Link2, Search } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { guardarCitaAccion } from "@/lib/acciones/citas"
import { partesLocales } from "@/lib/citas/esquema"
import type { Cita } from "@/lib/data/tipos"
import { diaLargo, hora } from "@/lib/dominio/fechas"
import { formatearTelefono } from "@/lib/dominio/telefono"
import { cn } from "@/lib/utils"

import type { PacienteOpcion } from "./dialogo-cita"

/** Botón «Vincular» de una cita sin paciente; abre el diálogo para elegirlo. */
export function VincularCita({ cita, pacientes }: { cita: Cita; pacientes: PacienteOpcion[] }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Link2 data-icon="inline-start" />
        Vincular
      </Button>
      {abierto && <Dialogo cita={cita} pacientes={pacientes} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

function Dialogo({ cita, pacientes, onCerrar }: { cita: Cita; pacientes: PacienteOpcion[]; onCerrar: () => void }) {
  const [busqueda, setBusqueda] = useState("")
  const [elegido, setElegido] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, empezar] = useTransition()

  const coincidencias = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const digitos = t.replace(/\D/g, "")
    const lista = t
      ? pacientes.filter((p) => p.nombre.toLowerCase().includes(t) || (!!digitos && (p.telefono ?? "").includes(digitos)))
      : pacientes
    return lista.slice(0, 6)
  }, [busqueda, pacientes])

  function vincular() {
    if (elegido === null) return setError("Elige el paciente")
    setError(null)
    empezar(async () => {
      // Se conservan fecha, hora, duración y servicio de la cita; solo cambia el paciente.
      const minutos = Math.round((new Date(cita.terminaEn).getTime() - new Date(cita.iniciaEn).getTime()) / 60_000)
      const r = await guardarCitaAccion({
        citaId: cita.id,
        datos: { pacienteId: elegido, ...partesLocales(cita.iniciaEn), duracion: minutos, servicio: cita.servicio ?? "" },
      })
      if (!r.ok) return setError(r.error)
      toast.success("La cita quedó vinculada. El paciente pasó a Agendó.")
      onCerrar()
    })
  }

  return (
    <Dialog open onOpenChange={(a) => !a && !guardando && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular la cita a un paciente</DialogTitle>
          <DialogDescription>
            {diaLargo(cita.iniciaEn)} a las {hora(cita.iniciaEn)}{cita.servicio ? ` · ${cita.servicio}` : ""}.
            La fecha, la hora y el servicio no cambian.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar paciente"
              className="pl-9"
              placeholder="Busca por nombre o teléfono"
              autoComplete="off"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <ul role="listbox" aria-label="Pacientes" className="flex flex-col divide-y rounded-lg border">
            {coincidencias.map((p) => (
              <li key={p.id} role="option" aria-selected={elegido === p.id}>
                <button
                  type="button"
                  onClick={() => setElegido(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    elegido === p.id && "bg-accent font-medium"
                  )}
                >
                  <span>{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{formatearTelefono(p.telefono)}</span>
                </button>
              </li>
            ))}
            {coincidencias.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No hay pacientes con ese nombre.</li>}
          </ul>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={vincular} disabled={guardando || elegido === null}>{guardando ? "Vinculando…" : "Vincular"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
