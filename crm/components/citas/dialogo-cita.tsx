"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Search } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { guardarCitaAccion } from "@/lib/acciones/citas"
import {
  DURACIONES, esquemaCita, partesLocales, SERVICIOS, type CitaForm, type CitaValida,
} from "@/lib/citas/esquema"
import type { Cita } from "@/lib/data/tipos"
import { formatearTelefono } from "@/lib/dominio/telefono"
import { cn } from "@/lib/utils"

export type PacienteOpcion = { id: number; nombre: string; telefono: string | null }

type Props = {
  abierto: boolean
  onCerrar: () => void
  pacientes: PacienteOpcion[]
  /** Si viene, se edita esa cita. */
  cita?: Cita
  /** Para crear desde la ficha: el paciente ya está elegido y no se cambia. */
  pacienteIdFijo?: number
}

const duracionDe = (c: Cita) => Math.round((new Date(c.terminaEn).getTime() - new Date(c.iniciaEn).getTime()) / 60_000)
const DURACION_DEFECTO = DURACIONES.find((d) => d.porDefecto)!.minutos

function valoresIniciales(cita: Cita | undefined, pacienteIdFijo: number | undefined): CitaForm {
  if (cita) {
    return {
      pacienteId: cita.pacienteId ?? (undefined as never),
      ...partesLocales(cita.iniciaEn),
      duracion: duracionDe(cita),
      servicio: cita.servicio ?? "",
    }
  }
  return { pacienteId: pacienteIdFijo ?? (undefined as never), fecha: "", hora: "", duracion: DURACION_DEFECTO, servicio: "" }
}

/** Crear o editar una cita. Los errores de horario y choque vienen de la base, ya en español. */
export function DialogoCita(props: Props) {
  // Se remonta al abrir para que el formulario siempre empiece con los datos de la cita.
  return props.abierto ? <Contenido {...props} /> : null
}

function Contenido({ onCerrar, pacientes, cita, pacienteIdFijo }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [guardando, empezar] = useTransition()

  const form = useForm<CitaForm, unknown, CitaValida>({
    resolver: zodResolver(esquemaCita),
    defaultValues: valoresIniciales(cita, pacienteIdFijo),
  })
  const { errors } = form.formState
  const elegido = useWatch({ control: form.control, name: "pacienteId" })

  const coincidencias = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const digitos = t.replace(/\D/g, "")
    const lista = t
      ? pacientes.filter((p) => p.nombre.toLowerCase().includes(t) || (!!digitos && (p.telefono ?? "").includes(digitos)))
      : pacientes
    return lista.slice(0, 6)
  }, [busqueda, pacientes])

  const fijo = pacientes.find((p) => p.id === (pacienteIdFijo ?? -1))

  function guardar(datos: CitaValida) {
    setError(null)
    empezar(async () => {
      const r = await guardarCitaAccion({ citaId: cita?.id, datos })
      if (!r.ok) return setError(r.error)
      toast.success(cita ? "Cita actualizada." : "Cita creada. El paciente pasó a Agendó.")
      onCerrar()
    })
  }

  return (
    <Dialog open onOpenChange={(a) => !a && !guardando && onCerrar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{cita ? "Cambiar cita" : "Nueva cita"}</DialogTitle>
          <DialogDescription>El horario del consultorio y los choques se revisan al guardar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(guardar)} noValidate className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!errors.pacienteId}>
              <FieldLabel htmlFor="cita-buscar">Paciente *</FieldLabel>
              {fijo ? (
                <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium">{fijo.nombre}</p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cita-buscar"
                      className="pl-9"
                      placeholder="Busca por nombre o teléfono"
                      autoComplete="off"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>
                  <Controller
                    control={form.control}
                    name="pacienteId"
                    render={({ field }) => (
                      <ul role="listbox" aria-label="Pacientes" className="flex flex-col divide-y rounded-lg border">
                        {coincidencias.map((p) => (
                          <li key={p.id} role="option" aria-selected={elegido === p.id}>
                            <button
                              type="button"
                              onClick={() => field.onChange(p.id)}
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
                        {coincidencias.length === 0 && (
                          <li className="px-3 py-2 text-sm text-muted-foreground">No hay pacientes con ese nombre.</li>
                        )}
                      </ul>
                    )}
                  />
                </>
              )}
              <FieldError>{errors.pacienteId?.message}</FieldError>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.fecha}>
                <FieldLabel htmlFor="cita-fecha">Fecha *</FieldLabel>
                <Input id="cita-fecha" type="date" aria-invalid={!!errors.fecha} {...form.register("fecha")} />
                <FieldError>{errors.fecha?.message}</FieldError>
              </Field>
              <Field data-invalid={!!errors.hora}>
                <FieldLabel htmlFor="cita-hora">Hora *</FieldLabel>
                <Input id="cita-hora" type="time" step={900} aria-invalid={!!errors.hora} {...form.register("hora")} />
                <FieldError>{errors.hora?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="cita-duracion">Duración</FieldLabel>
                <Controller
                  control={form.control}
                  name="duracion"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger id="cita-duracion" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURACIONES.map((d) => (
                          <SelectItem key={d.minutos} value={String(d.minutos)}>{d.etiqueta}</SelectItem>
                        ))}
                        {!DURACIONES.some((d) => d.minutos === field.value) && (
                          <SelectItem value={String(field.value)}>{field.value} minutos</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field data-invalid={!!errors.servicio}>
              <FieldLabel htmlFor="cita-servicio">Servicio</FieldLabel>
              <Input id="cita-servicio" list="servicios-sugeridos" autoComplete="off" {...form.register("servicio")} />
              <datalist id="servicios-sugeridos">
                {SERVICIOS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <FieldError>{errors.servicio?.message}</FieldError>
            </Field>
          </FieldGroup>

          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : cita ? "Guardar cambios" : "Crear cita"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
