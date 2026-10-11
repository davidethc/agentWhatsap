"use client"

import { CalendarClock } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { DialogoPerdido } from "@/components/kanban/dialogo-perdido"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { moverEtapaAccion } from "@/lib/acciones/pacientes"
import { ETAPAS, type Etapa, type FichaPaciente, type MotivoPerdido } from "@/lib/data/tipos"
import { ETAPA, MOTIVO_PERDIDO } from "@/lib/dominio/etiquetas"
import { fechaCorta } from "@/lib/dominio/fechas"
import { formatearTelefono } from "@/lib/dominio/telefono"

export function Encabezado({ ficha }: { ficha: FichaPaciente }) {
  const { paciente, responsable, dependientes } = ficha
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [, empezar] = useTransition()

  function mover(etapa: Etapa, motivo?: MotivoPerdido) {
    empezar(async () => {
      const r = await moverEtapaAccion({ pacienteId: paciente.id, etapa, motivo })
      if (r.ok) toast.success(`${paciente.nombre} pasó a ${ETAPA[etapa]}.`)
      else toast.error(r.error)
    })
  }

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paciente.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {formatearTelefono(paciente.telefono)}
            {paciente.motivoPerdido && ` · Perdido: ${MOTIVO_PERDIDO[paciente.motivoPerdido].toLowerCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="etapa" className="text-sm text-muted-foreground">Etapa</label>
          <Select
            value={paciente.etapa}
            onValueChange={(v) => (v === "perdido" ? setPidiendoMotivo(true) : mover(v as Etapa))}
          >
            <SelectTrigger id="etapa" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETAPAS.map((e) => (
                <SelectItem key={e} value={e}>{ETAPA[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {paciente.volverEl && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4 text-primary" />
            Volver el <strong>{fechaCorta(paciente.volverEl)}</strong>
          </span>
        )}
        {responsable && (
          <span>
            Responsable:{" "}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/pacientes/${responsable.id}`}>
              {responsable.nombre}
            </Link>
          </span>
        )}
        {dependientes.length > 0 && (
          <span>
            Dependientes:{" "}
            {dependientes.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/pacientes/${d.id}`}>
                  {d.nombre}
                </Link>
              </span>
            ))}
          </span>
        )}
      </div>

      <DialogoPerdido
        paciente={pidiendoMotivo ? paciente : null}
        onCancelar={() => setPidiendoMotivo(false)}
        onConfirmar={(motivo) => {
          setPidiendoMotivo(false)
          mover("perdido", motivo)
        }}
      />
    </header>
  )
}
