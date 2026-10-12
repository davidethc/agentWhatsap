"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil } from "lucide-react"
import { useState, useTransition } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"

import { CamposBasicos } from "@/components/pacientes/campos-basicos"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { actualizarPacienteAccion } from "@/lib/acciones/pacientes"
import type { Paciente } from "@/lib/data/tipos"
import { fechaCorta } from "@/lib/dominio/fechas"
import { formatearTelefono } from "@/lib/dominio/telefono"
import { esquemaDatosBasicos, type DatosBasicosForm, type DatosBasicosValidos } from "@/lib/pacientes/esquema"

export function DatosBasicos({ paciente }: { paciente: Paciente }) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, empezar] = useTransition()

  const form = useForm<DatosBasicosForm, unknown, DatosBasicosValidos>({
    resolver: zodResolver(esquemaDatosBasicos),
    defaultValues: {
      nombre: paciente.nombre,
      cedula: paciente.cedula ?? "",
      fechaNacimiento: paciente.fechaNacimiento ?? "",
      correo: paciente.correo ?? "",
    },
  })

  function guardar(datos: DatosBasicosValidos) {
    setError(null)
    empezar(async () => {
      const r = await actualizarPacienteAccion({ id: paciente.id, datos })
      if (!r.ok) return setError(r.error)
      toast.success("Datos guardados.")
      setEditando(false)
    })
  }

  function cancelar() {
    form.reset()
    setError(null)
    setEditando(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos básicos</CardTitle>
        {!editando && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editando ? (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(guardar)} noValidate className="flex flex-col gap-4">
              <CamposBasicos prefijo="ficha" />
              <p className="text-sm text-muted-foreground">
                Teléfono: {formatearTelefono(paciente.telefono)} (el teléfono no se cambia aquí).
              </p>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelar} disabled={guardando}>Cancelar</Button>
                <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </FormProvider>
        ) : (
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Dato titulo="Nombre" valor={paciente.nombre} />
            <Dato titulo="Teléfono" valor={formatearTelefono(paciente.telefono)} />
            <Dato titulo="Cédula" valor={paciente.cedula} />
            <Dato titulo="Fecha de nacimiento" valor={paciente.fechaNacimiento && fechaCorta(paciente.fechaNacimiento)} />
            <Dato titulo="Correo" valor={paciente.correo} />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="font-medium">{valor || <span className="font-normal text-muted-foreground">Sin dato</span>}</dd>
    </div>
  )
}
