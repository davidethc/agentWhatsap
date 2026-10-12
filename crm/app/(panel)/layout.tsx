import { connection } from "next/server"
import { Suspense } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requerirPersonal } from "@/lib/auth/sesion"

// La sesión es dinámica (cookies): va dentro de Suspense por Cache Components.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh" aria-busy="true" />}>
      <PanelConSesion>{children}</PanelConSesion>
    </Suspense>
  )
}

async function PanelConSesion({ children }: { children: React.ReactNode }) {
  await connection() // la sesión depende de la hora (expiración del token): siempre en cada petición
  const personal = await requerirPersonal()
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar nombre={personal.nombre} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
            <span className="font-semibold">Eli Panel</span>
          </header>
          <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
