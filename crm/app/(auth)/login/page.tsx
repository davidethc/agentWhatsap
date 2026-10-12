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
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden className="brand-grid absolute inset-0" />
      <span aria-hidden className="brand-glow brand-glow-a" />
      <span aria-hidden className="brand-glow brand-glow-b" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="brand-tile flex size-11 items-center justify-center rounded-lg text-primary-foreground shadow-card">
            <Stethoscope className="size-6" />
          </span>
          <span className="flex flex-col">
            <span className="text-2xl font-semibold tracking-tight">
              Eli <em className="font-serif font-normal italic">Panel</em>
            </span>
            <span className="kicker">EliDental · Pacientes y citas</span>
          </span>
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
