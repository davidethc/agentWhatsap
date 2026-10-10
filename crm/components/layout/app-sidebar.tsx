"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, LayoutDashboard, Stethoscope, Users } from "lucide-react"

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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4" />
          </span>
          <span className="truncate text-base font-semibold">Eli Panel</span>
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
        <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          EliDental
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
