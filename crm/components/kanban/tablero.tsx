"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from "@dnd-kit/core"
import { Search } from "lucide-react"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { moverEtapaAccion } from "@/lib/acciones/pacientes"
import { ETAPAS, type Etapa, type MotivoPerdido, type Paciente } from "@/lib/data/tipos"
import { ETAPA } from "@/lib/dominio/etiquetas"
import { filtrarPacientes } from "@/lib/pacientes/buscar"
import { cn } from "@/lib/utils"

import { DialogoPerdido } from "./dialogo-perdido"
import { EnVivo } from "./en-vivo"
import { Tarjeta } from "./tarjeta"

type Props = { pacientes: Paciente[]; ahora: string }
type Movimiento = { id: number; etapa: Etapa; motivo?: MotivoPerdido }

/** Columna «Seguimiento»: en pantalla se llama «Seguimiento / Volver». */
const TITULO: Record<Etapa, string> = { ...ETAPA, seguimiento: "Seguimiento / Volver" }

const INSTRUCCIONES: ScreenReaderInstructions = {
  draggable:
    "Para mover a este paciente, presiona la barra espaciadora. Con las flechas elige la columna y vuelve a presionar la barra para soltarlo. Escape cancela.",
}

/** Con el teclado, ← y → saltan a la columna vecina (por defecto las flechas avanzan solo 25 px). */
const saltarDeColumna: KeyboardCoordinateGetter = (evento, { context }) => {
  const { active, droppableRects, droppableContainers, collisionRect } = context
  if (!active || !collisionRect) return
  const derecha = evento.code === "ArrowRight"
  if (!derecha && evento.code !== "ArrowLeft") return
  evento.preventDefault()
  const columnas = droppableContainers
    .getEnabled()
    .flatMap((c) => {
      const rect = droppableRects.get(c.id)
      return rect ? [rect] : []
    })
    .sort((a, b) => a.left - b.left)
  const centro = collisionRect.left + collisionRect.width / 2
  const actual = columnas.findIndex((r) => centro >= r.left && centro <= r.left + r.width)
  const destino = columnas[Math.min(columnas.length - 1, Math.max(0, actual + (derecha ? 1 : -1)))]
  if (!destino) return
  return { x: destino.left + (destino.width - collisionRect.width) / 2, y: collisionRect.top }
}

export function Tablero({ pacientes, ahora }: Props) {
  const [optimistas, aplicar] = useOptimistic(pacientes, (lista, m: Movimiento) =>
    lista.map((p) =>
      p.id === m.id ? { ...p, etapa: m.etapa, motivoPerdido: m.etapa === "perdido" ? (m.motivo ?? null) : null } : p
    )
  )
  const [, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<Paciente | null>(null)
  const [pidiendoMotivo, setPidiendoMotivo] = useState<Paciente | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const visibles = filtrarPacientes(optimistas, busqueda)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: saltarDeColumna })
  )

  function mover(p: Paciente, etapa: Etapa, motivo?: MotivoPerdido) {
    empezar(async () => {
      aplicar({ id: p.id, etapa, motivo })
      const r = await moverEtapaAccion({ pacienteId: p.id, etapa, motivo })
      if (r.ok) toast.success(`${p.nombre} pasó a ${ETAPA[etapa]}.`)
      else toast.error(r.error) // al terminar la transición, la tarjeta vuelve a su columna
    })
  }

  function alSoltar({ active, over }: DragEndEvent) {
    setArrastrando(null)
    const paciente = optimistas.find((p) => p.id === active.id)
    const etapa = over?.id as Etapa | undefined
    if (!paciente || !etapa || etapa === paciente.etapa) return
    if (etapa === "perdido") setPidiendoMotivo(paciente)
    else mover(paciente, etapa)
  }

  const nombreDe = (id: unknown) => optimistas.find((p) => p.id === id)?.nombre ?? "El paciente"
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Tomaste a ${nombreDe(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nombreDe(active.id)} está sobre la columna ${TITULO[over.id as Etapa]}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Soltaste a ${nombreDe(active.id)} en ${TITULO[over.id as Etapa]}.` : `${nombreDe(active.id)} no se movió.`,
    onDragCancel: ({ active }) => `Cancelaste el movimiento de ${nombreDe(active.id)}.`,
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar paciente por nombre o teléfono"
            placeholder="Buscar por nombre o teléfono"
            className="pl-9"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          {busqueda.trim() && (
            <span role="status" className="text-sm text-muted-foreground">
              {visibles.length} {visibles.length === 1 ? "paciente" : "pacientes"}
            </span>
          )}
          <EnVivo />
        </div>
      </div>
      <DndContext
        id="tablero-pacientes" // id fijo: evita el desajuste de hidratación de dnd-kit
        sensors={sensores}
        accessibility={{ announcements: anuncios, screenReaderInstructions: INSTRUCCIONES }}
        onDragStart={({ active }: DragStartEvent) =>
          setArrastrando(optimistas.find((p) => p.id === active.id) ?? null)
        }
        onDragEnd={alSoltar}
        onDragCancel={() => setArrastrando(null)}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
          <div className="grid min-w-[1080px] grid-cols-6 gap-3">
            {ETAPAS.map((etapa) => (
              <Columna
                key={etapa}
                etapa={etapa}
                pacientes={visibles.filter((p) => p.etapa === etapa)}
                ahora={ahora}
                oculto={arrastrando?.id}
              />
            ))}
          </div>
        </div>
        <DragOverlay>{arrastrando && <Tarjeta paciente={arrastrando} ahora={ahora} flotante />}</DragOverlay>
      </DndContext>

      <DialogoPerdido
        paciente={pidiendoMotivo}
        onCancelar={() => setPidiendoMotivo(null)}
        onConfirmar={(motivo) => {
          if (pidiendoMotivo) mover(pidiendoMotivo, "perdido", motivo)
          setPidiendoMotivo(null)
        }}
      />
    </>
  )
}

function Columna({
  etapa,
  pacientes,
  ahora,
  oculto,
}: {
  etapa: Etapa
  pacientes: Paciente[]
  ahora: string
  oculto?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TITULO[etapa]}, ${pacientes.length} pacientes`}
      className={cn(
        "flex min-h-72 flex-col gap-2 rounded-lg bg-muted p-2 transition-colors",
        isOver && "bg-accent ring-2 ring-primary/40"
      )}
    >
      <h2 className="flex min-h-10 items-center justify-between gap-2 px-1">
        <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{TITULO[etapa]}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {pacientes.length}
        </span>
      </h2>
      {pacientes.map((p) => (
        <TarjetaArrastrable key={p.id} paciente={p} ahora={ahora} oculta={p.id === oculto} />
      ))}
      {pacientes.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Sin pacientes</p>}
    </section>
  )
}

function TarjetaArrastrable({ paciente, ahora, oculta }: { paciente: Paciente; ahora: string; oculta: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: paciente.id })
  return (
    <Tarjeta
      paciente={paciente}
      ahora={ahora}
      ref={setNodeRef as never}
      {...attributes}
      {...listeners}
      className={cn(oculta && "opacity-40")}
    />
  )
}
