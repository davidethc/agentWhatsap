"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, LayoutDashboard, LogOut, Stethoscope, Users } from "lucide-react"

import { cerrarSesion } from "@/lib/auth/acciones"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const items = [
  { titulo: "Resumen", href: "/", icono: LayoutDashboard },
  { titulo: "Pacientes", href: "/pacientes", icono: Users },
  { titulo: "Citas", href: "/citas", icono: CalendarDays },
]

export function AppSidebar({ nombre }: { nombre: string }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="brand-tile flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground">
            <Stethoscope className="size-4" />
          </span>
          <span className="truncate text-base font-semibold">
            Eli <em className="font-serif font-normal italic">Panel</em>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ titulo, href, icono: Icono }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    tooltip={titulo}
                    isActive={href === "/" ? pathname === "/" : pathname.startsWith(href)}
                  >
                    <Link href={href}>
                      <Icono />
                      <span>{titulo}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <form action={cerrarSesion}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="submit" size="lg" tooltip="Cerrar sesión">
                <LogOut />
                <span className="flex flex-col text-left leading-tight">
                  <span className="truncate text-sm font-medium">{nombre}</span>
                  <span className="text-xs text-muted-foreground">Cerrar sesión</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
