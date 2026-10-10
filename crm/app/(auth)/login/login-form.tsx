"use client"

import { AlertCircle } from "lucide-react"
import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { iniciarSesion, type EstadoLogin } from "@/lib/auth/acciones"

export function LoginForm({ errorInicial }: { errorInicial?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(iniciarSesion, null)
  const error = estado?.error ?? errorInicial
  const campos = estado?.campos

  return (
    <form action={accion} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!campos?.correo}>
          <FieldLabel htmlFor="correo">Correo</FieldLabel>
          <Input
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            autoFocus
            defaultValue={estado?.correo}
            aria-invalid={!!campos?.correo}
            className="h-11"
          />
          <FieldError>{campos?.correo}</FieldError>
        </Field>
        <Field data-invalid={!!campos?.clave}>
          <FieldLabel htmlFor="clave">Clave</FieldLabel>
          <Input
            id="clave"
            name="clave"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!campos?.clave}
            className="h-11"
          />
          <FieldError>{campos?.clave}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pendiente}>
          {pendiente && <Spinner data-icon="inline-start" />}
          {pendiente ? "Entrando…" : "Entrar"}
        </Button>
      </FieldGroup>
    </form>
  )
}
