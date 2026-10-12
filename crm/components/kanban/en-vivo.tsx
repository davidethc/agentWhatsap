"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/**
 * Escucha los cambios de la tabla `pacientes` (Realtime de Supabase, con la sesión de la doctora: la RLS
 * decide qué llega) y pide los datos de nuevo, sin recargar la página. Muestra si está conectado.
 */
export function EnVivo() {
  const router = useRouter()
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let espera: ReturnType<typeof setTimeout> | undefined
    const canal = supabase
      .channel("kanban-pacientes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pacientes" }, () => {
        // Varios cambios seguidos (p. ej. un evento de Eli) se juntan en una sola actualización.
        clearTimeout(espera)
        espera = setTimeout(() => router.refresh(), 300)
      })
      .subscribe((estado) => setConectado(estado === "SUBSCRIBED"))
    return () => {
      clearTimeout(espera)
      void supabase.removeChannel(canal)
    }
  }, [router])

  return (
    <span
      role="status"
      title={conectado ? "Los cambios aparecen solos" : "Sin conexión en vivo: recarga la página para ver cambios"}
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span className={cn("size-2 rounded-full", conectado ? "bg-success" : "bg-muted-foreground/40")} aria-hidden />
      {conectado ? "En vivo" : "Sin conexión en vivo"}
    </span>
  )
}
