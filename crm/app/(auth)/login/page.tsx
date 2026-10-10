import { Stethoscope } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { SIN_ACCESO } from "@/lib/auth/mensajes"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar · Eli Panel" }

async function FormularioConAviso({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorInicial =
    error === "sin-acceso"
      ? SIN_ACCESO
      : undefined
  return <LoginForm errorInicial={errorInicial} />
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-6" />
          </span>
          <span className="text-2xl font-semibold tracking-tight">Eli Panel</span>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Usa el correo y la clave de tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoginForm />}>
              <FormularioConAviso searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Sin registro: las cuentas las crea quien administra Eli.
        </p>
      </div>
    </main>
  )
}
