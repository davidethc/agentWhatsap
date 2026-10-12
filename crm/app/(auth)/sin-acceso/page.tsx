import { ShieldAlert } from "lucide-react"
import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SIN_ACCESO } from "@/lib/auth/mensajes"

export const metadata: Metadata = { title: "Sin acceso · Eli Panel" }

/**
 * Cuenta con sesión pero sin permiso (no está en `personal`). Una Server Component no puede borrar
 * cookies y /salir solo cierra sesión por POST: por eso el botón es un formulario POST.
 */
export default function SinAccesoPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" aria-hidden />
            Sin acceso
          </CardTitle>
          <CardDescription>{SIN_ACCESO}</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" action="/salir?error=sin-acceso">
            <Button type="submit" size="lg" className="h-11 w-full">
              Cerrar sesión y entrar con otra cuenta
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
