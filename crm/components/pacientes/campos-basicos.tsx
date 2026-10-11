"use client"

import { useFormContext } from "react-hook-form"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { DatosBasicosForm } from "@/lib/pacientes/esquema"

/** Campos que comparten la ficha (editar) y «Nuevo paciente». Van dentro de un FormProvider. */
export function CamposBasicos({ prefijo }: { prefijo: string }) {
  const { register, formState: { errors } } = useFormContext<DatosBasicosForm>()
  return (
    <FieldGroup>
      <Field data-invalid={!!errors.nombre}>
        <FieldLabel htmlFor={`${prefijo}-nombre`}>Nombre *</FieldLabel>
        <Input id={`${prefijo}-nombre`} autoComplete="off" aria-invalid={!!errors.nombre} {...register("nombre")} />
        <FieldError>{errors.nombre?.message}</FieldError>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.cedula}>
          <FieldLabel htmlFor={`${prefijo}-cedula`}>Cédula</FieldLabel>
          <Input id={`${prefijo}-cedula`} inputMode="numeric" autoComplete="off" aria-invalid={!!errors.cedula} {...register("cedula")} />
          <FieldError>{errors.cedula?.message}</FieldError>
        </Field>
        <Field data-invalid={!!errors.fechaNacimiento}>
          <FieldLabel htmlFor={`${prefijo}-nacimiento`}>Fecha de nacimiento</FieldLabel>
          <Input id={`${prefijo}-nacimiento`} type="date" aria-invalid={!!errors.fechaNacimiento} {...register("fechaNacimiento")} />
          <FieldError>{errors.fechaNacimiento?.message}</FieldError>
        </Field>
      </div>
      <Field data-invalid={!!errors.correo}>
        <FieldLabel htmlFor={`${prefijo}-correo`}>Correo</FieldLabel>
        <Input id={`${prefijo}-correo`} type="email" autoComplete="off" aria-invalid={!!errors.correo} {...register("correo")} />
        <FieldError>{errors.correo?.message}</FieldError>
      </Field>
    </FieldGroup>
  )
}
