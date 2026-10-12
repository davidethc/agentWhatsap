"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldAlert } from "lucide-react"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { guardarClinicosAccion, marcarConsentimientoAccion } from "@/lib/acciones/clinicos"
import { esquemaClinicos, type ClinicosForm, type ClinicosValidos } from "@/lib/clinicos/esquema"
import type { DatosClinicos } from "@/lib/data/tipos"
import { claveDia, fechaCorta } from "@/lib/dominio/fechas"

type Props = {
  pacienteId: number
  /** ISO con hora; null = todavía no firmó. */
  consentimientoFirmadoEn: string | null
  datosClinicos: DatosClinicos | null
}

const aTexto = (e: boolean | null | undefined): "" | "si" | "no" => (e === true ? "si" : e === false ? "no" : "")

export function DatosClinicosFicha({ pacienteId, consentimientoFirmadoEn, datosClinicos }: Props) {
  const firmado = consentimientoFirmadoEn !== null
  const [error, setError] = useState<string | null>(null)
  const [guardando, empezar] = useTransition()

  const form = useForm<ClinicosForm, unknown, ClinicosValidos>({
    resolver: zodResolver(esquemaClinicos),
    defaultValues: {
      alergias: datosClinicos?.alergias ?? "",
      enfermedades: datosClinicos?.enfermedades ?? "",
      embarazo: aTexto(datosClinicos?.embarazo),
      miedo: datosClinicos?.miedo ?? "",
    },
  })
  const { register, control, formState } = form

  // Se manda el valor del formulario (embarazo: "", "si", "no"); el servidor valida y transforma.
  function guardar() {
    const datos = form.getValues()
    setError(null)
    empezar(async () => {
      const r = await guardarClinicosAccion({ id: pacienteId, datos })
      if (!r.ok) return setError(r.error)
      toast.success("Datos clínicos guardados.")
    })
  }

  return (
    <Card className="card-surface-hover">
      <CardHeader>
        <CardTitle>Datos clínicos</CardTitle>
        <CardDescription>
          {firmado
            ? `Consentimiento firmado el ${fechaCorta(claveDia(consentimientoFirmadoEn))}.`
            : "Información de salud del paciente. Solo se llena con su consentimiento."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!firmado && <AvisoSinConsentimiento pacienteId={pacienteId} />}

        <form onSubmit={form.handleSubmit(guardar)} noValidate>
          <fieldset disabled={!firmado || guardando} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
            <FieldGroup>
              <Field data-invalid={!!formState.errors.alergias}>
                <FieldLabel htmlFor="clin-alergias">Alergias</FieldLabel>
                <Textarea id="clin-alergias" rows={2} placeholder="Ej.: penicilina, látex" {...register("alergias")} />
                <FieldError>{formState.errors.alergias?.message}</FieldError>
              </Field>
              <Field data-invalid={!!formState.errors.enfermedades}>
                <FieldLabel htmlFor="clin-enfermedades">Enfermedades</FieldLabel>
                <Textarea id="clin-enfermedades" rows={2} placeholder="Ej.: diabetes, presión alta" {...register("enfermedades")} />
                <FieldError>{formState.errors.enfermedades?.message}</FieldError>
              </Field>
              <Field data-invalid={!!formState.errors.embarazo}>
                <FieldLabel id="clin-embarazo-etiqueta">¿Está embarazada?</FieldLabel>
                <Controller
                  control={control}
                  name="embarazo"
                  render={({ field }) => (
                    <RadioGroup
                      aria-labelledby="clin-embarazo-etiqueta"
                      value={(field.value as string | undefined) || "sin"}
                      onValueChange={(v) => field.onChange(v === "sin" ? "" : v)}
                      className="flex flex-wrap gap-x-6 gap-y-2"
                    >
                      {[
                        ["sin", "Sin dato"],
                        ["no", "No"],
                        ["si", "Sí"],
                      ].map(([valor, texto]) => (
                        <div key={valor} className="flex items-center gap-2">
                          <RadioGroupItem value={valor} id={`clin-embarazo-${valor}`} />
                          <Label htmlFor={`clin-embarazo-${valor}`}>{texto}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
                <FieldError>{formState.errors.embarazo?.message}</FieldError>
              </Field>
              <Field data-invalid={!!formState.errors.miedo}>
                <FieldLabel htmlFor="clin-miedo">Miedos o ansiedad</FieldLabel>
                <Textarea id="clin-miedo" rows={2} placeholder="Ej.: miedo a las agujas" {...register("miedo")} />
                <FieldError>{formState.errors.miedo?.message}</FieldError>
              </Field>
            </FieldGroup>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={!firmado || guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}

function AvisoSinConsentimiento({ pacienteId }: { pacienteId: number }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, empezar] = useTransition()
  const hoy = claveDia(new Date())

  function abrir() {
    setFecha(hoy)
    setError(null)
    setAbierto(true)
  }

  function confirmar() {
    setError(null)
    empezar(async () => {
      const r = await marcarConsentimientoAccion({ id: pacienteId, fecha })
      if (!r.ok) return setError(r.error)
      toast.success("Consentimiento marcado. Ya puedes llenar los datos clínicos.")
      setAbierto(false)
    })
  }

  return (
    <>
      <Alert>
        <ShieldAlert />
        <AlertTitle>Falta el consentimiento firmado</AlertTitle>
        <AlertDescription>
          <p>Para guardar datos de salud, el paciente debe haber firmado el consentimiento.</p>
          <Button size="sm" className="mt-2 w-fit" onClick={abrir}>Marcar consentimiento firmado</Button>
        </AlertDescription>
      </Alert>

      <Dialog open={abierto} onOpenChange={(o) => !guardando && setAbierto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consentimiento firmado</DialogTitle>
            <DialogDescription>¿Qué día firmó el paciente el consentimiento?</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="clin-fecha-consentimiento">Fecha de la firma</FieldLabel>
            <Input
              id="clin-fecha-consentimiento"
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={confirmar} disabled={guardando || !fecha}>{guardando ? "Guardando…" : "Marcar como firmado"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
