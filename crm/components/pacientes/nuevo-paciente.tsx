"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, FormProvider, useForm, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { crearPacienteAccion } from "@/lib/acciones/pacientes"
import { ORIGEN_PACIENTE } from "@/lib/dominio/etiquetas"
import {
  esquemaNuevoPaciente, ORIGENES_MANUALES, type NuevoPacienteForm, type NuevoPacienteValido,
} from "@/lib/pacientes/esquema"

import { CamposBasicos } from "./campos-basicos"

type Existente = { id: number; nombre: string }

const VACIO: NuevoPacienteForm = { nombre: "", telefono: "", cedula: "", fechaNacimiento: "", correo: "", origen: undefined as never }

export function NuevoPaciente({ className }: { className?: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [existente, setExistente] = useState<Existente | null>(null)
  const [responsable, setResponsable] = useState<Existente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, empezar] = useTransition()

  const form = useForm<NuevoPacienteForm, unknown, NuevoPacienteValido>({
    resolver: zodResolver(esquemaNuevoPaciente),
    defaultValues: VACIO,
  })

  function cerrar() {
    setAbierto(false)
    setExistente(null)
    setResponsable(null)
    setError(null)
    form.reset(VACIO)
  }

  function guardar(datos: NuevoPacienteValido) {
    setError(null)
    empezar(async () => {
      const r = await crearPacienteAccion({ datos, responsableId: responsable?.id })
      if (!r.ok) return setError(r.error)
      if (r.datos.duplicado) return setExistente(r.datos.paciente)
      const { id, nombre } = r.datos.paciente
      toast.success(`${nombre} se agregó a Nuevo.`, {
        action: { label: "Abrir ficha", onClick: () => router.push(`/pacientes/${id}`) },
      })
      cerrar()
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={(a) => (a ? setAbierto(true) : !guardando && cerrar())}>
      <DialogTrigger asChild>
        <Button size="lg" className={className}>
          <UserPlus data-icon="inline-start" />
          Nuevo paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{responsable ? `Dependiente de ${responsable.nombre}` : "Nuevo paciente"}</DialogTitle>
          <DialogDescription>
            {responsable
              ? "Comparte el teléfono y la conversación de su responsable."
              : "Para quien llamó o llegó al consultorio. Los de WhatsApp los agrega Eli sola."}
          </DialogDescription>
        </DialogHeader>

        {existente && !responsable && (
          <Alert role="alert">
            <AlertTitle>Ya existe {existente.nombre} con ese teléfono</AlertTitle>
            <AlertDescription>
              <p>¿Quieres abrir su ficha o crear a esta persona como dependiente suya (por ejemplo, un hijo)?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/pacientes/${existente.id}`} onClick={cerrar}>Abrir ficha</Link>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setResponsable(existente)
                    setExistente(null)
                  }}
                >
                  Crear dependiente de {existente.nombre}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <FormProvider {...(form as unknown as UseFormReturn<NuevoPacienteForm>)}>
          <form onSubmit={form.handleSubmit(guardar)} noValidate className="flex flex-col gap-4">
            <CamposBasicos
              prefijo="nuevo"
              despuesDelNombre={
                <>
                  {!responsable && (
                    <Field data-invalid={!!form.formState.errors.telefono}>
                      <FieldLabel htmlFor="nuevo-telefono">Teléfono</FieldLabel>
                      <Input
                        id="nuevo-telefono"
                        type="tel"
                        inputMode="tel"
                        placeholder="0991234567"
                        autoComplete="off"
                        aria-invalid={!!form.formState.errors.telefono}
                        {...form.register("telefono")}
                      />
                      <FieldError>{form.formState.errors.telefono?.message}</FieldError>
                    </Field>
                  )}
                  <Field data-invalid={!!form.formState.errors.origen}>
                    <FieldLabel>Cómo llegó *</FieldLabel>
                    <Controller
                      control={form.control}
                      name="origen"
                      render={({ field }) => (
                        <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="flex flex-wrap gap-5">
                          {ORIGENES_MANUALES.map((o) => (
                            <div key={o} className="flex items-center gap-2">
                              <RadioGroupItem id={`origen-${o}`} value={o} />
                              <Label htmlFor={`origen-${o}`}>{ORIGEN_PACIENTE[o]}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    />
                    <FieldError>{form.formState.errors.origen?.message}</FieldError>
                  </Field>
                </>
              }
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrar} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar paciente"}</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
