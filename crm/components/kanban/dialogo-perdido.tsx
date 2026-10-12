"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { MOTIVOS_PERDIDO, type MotivoPerdido, type Paciente } from "@/lib/data/tipos"
import { MOTIVO_PERDIDO } from "@/lib/dominio/etiquetas"

type Props = {
  paciente: Paciente | null
  onCancelar: () => void
  onConfirmar: (motivo: MotivoPerdido) => void
}

/** Al soltar en Perdido hay que decir por qué (regla del embudo). */
export function DialogoPerdido({ paciente, onCancelar, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState<MotivoPerdido | "">("")
  return (
    <Dialog open={paciente !== null} onOpenChange={(abierto) => !abierto && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Por qué se perdió {paciente?.nombre}?</DialogTitle>
          <DialogDescription>Elige el motivo para llevarlo a Perdido.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={motivo} onValueChange={(v) => setMotivo(v as MotivoPerdido)} className="gap-3">
          {MOTIVOS_PERDIDO.map((m) => (
            <div key={m} className="flex items-center gap-3">
              <RadioGroupItem id={`motivo-${m}`} value={m} />
              <Label htmlFor={`motivo-${m}`}>{MOTIVO_PERDIDO[m]}</Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button
            disabled={!motivo}
            onClick={() => {
              if (motivo) onConfirmar(motivo)
              setMotivo("")
            }}
          >
            Pasar a Perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
