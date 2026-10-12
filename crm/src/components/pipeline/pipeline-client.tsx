"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Clock, MessageSquareText, Settings2, Trophy, XCircle } from "lucide-react";
import type { LossReason, PriorityValue, StageDto } from "@/lib/types";
import { formatMoneyCents, sumable } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/inbox/helpers";
import { StageManager } from "./stage-manager";
import { LossReasonDialog } from "./loss-reason-dialog";
import { AmountDialog } from "./amount-dialog";
import { PriorityBadge } from "./priority-picker";
import { LeadDrawer } from "./lead-drawer";

export type BoardLead = {
  id: string;
  stageId: string;
  position: number;
  lastActivityAt: string | null;
  contact: { id: string; name: string; phone: string | null };
  conversationId: string | null;
  amountCents: number | null;
  currency: string | null;
  priority: PriorityValue | null;
};

export function PipelineClient() {
  const [stages, setStages] = useState<StageDto[]>([]);
  const [currency, setCurrency] = useState("MXN");
  const [leads, setLeads] = useState<BoardLead[]>([]);
  const [activeLead, setActiveLead] = useState<BoardLead | null>(null);
  const [managing, setManaging] = useState(false);
  /** Arrastre hacia una etapa perdida, esperando el motivo. */
  const [pendingLoss, setPendingLoss] = useState<{
    leadId: string;
    stageId: string;
    name: string;
  } | null>(null);
  /** Tarjeta cuyo monto se está capturando. */
  const [editandoMonto, setEditandoMonto] = useState<BoardLead | null>(null);
  /**
   * Trato abierto en el cajón. Se guarda el ID y no el objeto: así el cajón
   * lee siempre del tablero y refleja al instante lo que se cambie desde
   * dentro, en vez de enseñar una copia que envejece.
   */
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = leads.find((l) => l.id === abiertoId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const refetch = useCallback(async () => {
    const res = await fetch("/api/pipeline/board").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as {
      stages: StageDto[];
      leads: BoardLead[];
      currency?: string;
    };
    if (data.currency) setCurrency(data.currency);
    setStages(data.stages);
    setLeads(data.leads);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function onDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  async function moverLead(
    leadId: string,
    overStage: string,
    loss?: { reason: LossReason; note: string }
  ) {
    const position = leads.filter((l) => l.stageId === overStage).length;
    // Optimista + persistencia
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stageId: overStage, position } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stageId: overStage,
        position,
        ...(loss
          ? { lossReason: loss.reason, ...(loss.note ? { lossNote: loss.note } : {}) }
          : {}),
      }),
    }).catch(() => null);
    void refetch();
  }

  async function guardarMonto(leadId: string, cents: number | null) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, amountCents: cents } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      // Sin `stageId`: esto NO mueve la tarjeta, solo escribe el importe.
      body: JSON.stringify({ amountCents: cents }),
    }).catch(() => null);
    void refetch();
  }

  async function guardarPrioridad(leadId: string, priority: PriorityValue | null) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, priority } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priority }),
    }).catch(() => null);
    void refetch();
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const leadId = String(event.active.id);
    const overStage = event.over ? String(event.over.id) : null;
    if (!overStage) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === overStage) return;

    // Perder un trato exige motivo. Se pregunta ANTES de mover: si el dueño
    // cancela, la tarjeta ni siquiera parpadea fuera de su columna.
    const destino = stages.find((s) => s.id === overStage);
    if (destino?.kind === "lost") {
      setPendingLoss({ leadId, stageId: overStage, name: lead.contact.name });
      return;
    }

    await moverLead(leadId, overStage);
  }

  /**
   * Cambiar de etapa desde el cajón. Entra por la MISMA puerta que el
   * arrastre: perder un trato exige motivo venga de donde venga, y duplicar
   * esa regla aquí sería tener dos sitios donde olvidarla.
   */
  function moverDesdeCajon(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    const destino = stages.find((s) => s.id === stageId);
    if (destino?.kind === "lost") {
      setPendingLoss({ leadId, stageId, name: lead.contact.name });
      return;
    }
    void moverLead(leadId, stageId);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p className="kicker">
            Embudo · {leads.length} {leads.length === 1 ? "trato" : "tratos"}
          </p>
          <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">Pipeline</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
          <Settings2 className="h-4 w-4" /> Gestionar etapas
        </Button>
      </header>

      {/* El tablero se arrastra en horizontal; en el teléfono cada columna
          se detiene en su sitio (snap) para no quedar a medio camino. */}
      <div className="flex-1 snap-x snap-mandatory overflow-x-auto p-3 sm:snap-none sm:p-4 lg:p-5">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <div className="flex h-full gap-3 lg:gap-4">
            {stages.map((stage, i) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                index={i}
                currency={currency}
                onEditAmount={setEditandoMonto}
                onOpen={(l) => setAbiertoId(l.id)}
                leads={leads
                  .filter((l) => l.stageId === stage.id)
                  .sort((a, b) => a.position - b.position)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <LeadCard
                lead={activeLead}
                currency={currency}
                stage={stages.find((s) => s.id === activeLead.stageId)}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {managing && (
        <StageManager
          stages={stages}
          onClose={() => setManaging(false)}
          onChanged={() => void refetch()}
        />
      )}

      {/* Va ANTES que los diálogos: con el mismo z-index, el que se pinta
          después queda encima, y el motivo de pérdida debe tapar al cajón. */}
      {abierto && (
        <LeadDrawer
          lead={abierto}
          stages={stages}
          currency={currency}
          onClose={() => setAbiertoId(null)}
          onMoveStage={(stageId) => moverDesdeCajon(abierto.id, stageId)}
          onAmount={(cents) => void guardarMonto(abierto.id, cents)}
          onPriority={(p) => void guardarPrioridad(abierto.id, p)}
        />
      )}

      {editandoMonto && (
        <AmountDialog
          leadName={editandoMonto.contact.name}
          currency={editandoMonto.currency ?? currency}
          amountCents={editandoMonto.amountCents}
          priority={editandoMonto.priority}
          onPriorityChange={(p) => {
            setEditandoMonto({ ...editandoMonto, priority: p });
            void guardarPrioridad(editandoMonto.id, p);
          }}
          onCancel={() => setEditandoMonto(null)}
          onSave={(cents) => {
            const leadId = editandoMonto.id;
            setEditandoMonto(null);
            void guardarMonto(leadId, cents);
          }}
        />
      )}

      {pendingLoss && (
        <LossReasonDialog
          leadName={pendingLoss.name}
          onCancel={() => setPendingLoss(null)}
          onConfirm={(reason, note) => {
            const { leadId, stageId } = pendingLoss;
            setPendingLoss(null);
            void moverLead(leadId, stageId, { reason, note });
          }}
        />
      )}
    </div>
  );
}

/**
 * Totales de una columna. Se calculan al pintar: un total guardado se
 * desincroniza en cuanto alguien mueve una tarjeta, y sumar unas decenas es
 * gratis. Todo en CENTAVOS enteros — el dinero jamás pasa por coma flotante.
 */
function totalesDeEtapa(leads: BoardLead[], businessCurrency: string) {
  let totalCents = 0;
  let sinMonto = 0;
  let otraMoneda = 0;

  for (const l of leads) {
    if (l.amountCents === null) {
      sinMonto++;
      continue;
    }
    if (!sumable({ amountCents: l.amountCents, currency: l.currency }, businessCurrency)) {
      otraMoneda++;
      continue;
    }
    totalCents += l.amountCents;
  }
  return { totalCents, sinMonto, otraMoneda };
}

/** Tono del chip de etapa: ganada en verde, perdida apagada, el resto con acento. */
function chipDeEtapa(kind: StageDto["kind"] | undefined) {
  if (kind === "won") return "bg-success-tint text-success-text";
  if (kind === "lost") return "bg-chip text-text-3";
  return "bg-brand-tint text-brand-text";
}

function StageColumn({
  stage,
  index,
  leads,
  currency,
  onEditAmount,
  onOpen,
}: {
  stage: StageDto;
  index: number;
  leads: BoardLead[];
  currency: string;
  onEditAmount: (lead: BoardLead) => void;
  onOpen: (lead: BoardLead) => void;
}) {
  // La columna entera es el blanco de soltar: la cabecera y el pie cuentan,
  // no solo el hueco de las tarjetas.
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const won = stage.kind === "won";
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      className="flex h-full w-[17rem] shrink-0 snap-start flex-col"
    >
      <div className="flex items-end justify-between gap-2 px-1 pb-2.5">
        <div className="min-w-0">
          <p className="kicker">Etapa {String(index + 1).padStart(2, "0")}</p>
          <span
            className={cn(
              "mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tracking-tight",
              chipDeEtapa(stage.kind)
            )}
          >
            {won && <Trophy className="h-3.5 w-3.5 shrink-0" />}
            {stage.kind === "lost" && <XCircle className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{stage.name}</span>
          </span>
        </div>
        <span
          className="kicker rounded-full bg-chip px-2 py-0.5 tabular-nums text-text-2"
          aria-label={`${leads.length} en ${stage.name}`}
        >
          {leads.length}
        </span>
      </div>

      <div
        className={cn(
          // `border-strong` y no `border`: en oscuro el hueco hundido casi se
          // funde con la página, y el borde normal no llega a separarlos.
          "board-col flex-1 border transition-[box-shadow,border-color]",
          won ? "border-success" : "border-border-strong",
          isOver && "border-brand ring-[3px] ring-brand-soft"
        )}
      >
        {leads.map((lead) => (
          <DraggableLead
            key={lead.id}
            lead={lead}
            stage={stage}
            currency={currency}
            onEditAmount={onEditAmount}
            onOpen={onOpen}
          />
        ))}
        {leads.length === 0 && (
          <p className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border-strong px-3 text-center text-xs text-text-4">
            Suelta aquí un trato
          </p>
        )}
      </div>
      <StageFooter leads={leads} currency={currency} won={won} />
    </section>
  );
}

/** Cuánto dinero hay en esta etapa, y qué quedó fuera de la cuenta. */
function StageFooter({
  leads,
  currency,
  won,
}: {
  leads: BoardLead[];
  currency: string;
  won: boolean;
}) {
  const { totalCents, sinMonto, otraMoneda } = totalesDeEtapa(leads, currency);
  const conMonto = leads.length - sinMonto - otraMoneda;

  return (
    <div className="px-1 pt-2 text-[11px]">
      {conMonto === 0 ? (
        // Un "$0.00" aquí se lee como un error del sistema, no como un dato.
        <p className="text-text-3">Sin montos capturados</p>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-text-3">
            Total{sinMonto > 0 ? ` · ${sinMonto} sin monto` : ""}
          </span>
          <span
            className={cn(
              "font-mono text-xs font-semibold tabular-nums",
              won ? "text-success-text" : "text-foreground"
            )}
          >
            {formatMoneyCents(totalCents, currency)}
          </span>
        </div>
      )}
      {otraMoneda > 0 && (
        // Descartarlos en silencio haría que el total mintiera sin que nadie
        // pudiera notarlo.
        <p className="mt-0.5 text-warning-text">
          {otraMoneda} en otra moneda, fuera del total
        </p>
      )}
    </div>
  );
}

function DraggableLead({
  lead,
  stage,
  currency,
  onEditAmount,
  onOpen,
}: {
  lead: BoardLead;
  stage: StageDto;
  currency: string;
  onEditAmount: (lead: BoardLead) => void;
  onOpen: (lead: BoardLead) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // Abrir y arrastrar conviven porque el sensor solo activa el arrastre a
      // los 6 px de movimiento: un clic quieto nunca llega a ser un arrastre.
      // Los controles de dentro de la tarjeta cortan la propagación, para que
      // tocar "+ monto" no abra además el cajón.
      onClick={() => onOpen(lead)}
      // dnd-kit ya deja el nodo con `role="button"` y `tabIndex`, pero un div
      // no dispara `click` con el teclado: sin esto, el cajón sería alcanzable
      // solo con el ratón.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      aria-label={`Abrir el trato de ${lead.contact.name}`}
      className={cn(
        "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-subtle",
        isDragging && "opacity-40"
      )}
    >
      <LeadCard
        lead={lead}
        stage={stage}
        currency={currency}
        onEditAmount={onEditAmount}
      />
    </div>
  );
}

function LeadCard({
  lead,
  stage,
  currency,
  overlay = false,
  onEditAmount,
}: {
  lead: BoardLead;
  stage?: StageDto;
  currency: string;
  overlay?: boolean;
  onEditAmount?: (lead: BoardLead) => void;
}) {
  const won = stage?.kind === "won";
  const monto =
    lead.amountCents === null
      ? null
      : formatMoneyCents(lead.amountCents, lead.currency ?? currency);
  return (
    <div
      className={cn(
        "card-surface card-surface-hover cursor-grab p-3",
        won
          ? "border-success-soft hover:border-success"
          : "hover:border-border-strong",
        overlay && "rotate-2 cursor-grabbing shadow-pop"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Un anillo fino despega el avatar del fondo de la tarjeta. */}
        <span className="flex shrink-0 rounded-full ring-2 ring-border">
          <ContactAvatar name={lead.contact.name} seed={lead.contact.id} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-semibold tracking-tight">
              {lead.contact.name}
            </p>
            {lead.priority && <PriorityBadge value={lead.priority} />}
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-3">
            <Clock className="h-3 w-3 shrink-0" />
            {lead.lastActivityAt
              ? `Actividad: ${formatTime(lead.lastActivityAt)}`
              : "Sin actividad"}
          </p>
        </div>
        {lead.conversationId && (
          <Link
            href={`/inbox?contact=${lead.contact.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Abrir conversación"
            className="rounded-full p-1.5 text-text-3 transition-colors hover:bg-brand-tint hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
          >
            <MessageSquareText className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            won ? "bg-success-tint text-success-text" : "bg-chip text-text-3"
          )}
        >
          {won && stage
            ? stage.name
            : lead.conversationId
              ? "En conversación"
              : "Sin conversación"}
        </span>
        {!overlay && onEditAmount && (
          <button
            // `stopPropagation` en pointerdown: sin esto, tocar el monto empieza
            // un arrastre y el diálogo nunca abre.
            onPointerDown={(e) => e.stopPropagation()}
            // También en `click`: sin esto, tocar el monto abriría además el
            // cajón, porque el evento sigue subiendo hasta la tarjeta.
            onClick={(e) => {
              e.stopPropagation();
              onEditAmount(lead);
            }}
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
              monto === null
                ? "border border-dashed border-border-strong text-text-3 hover:border-brand hover:text-brand-text"
                : won
                  ? "font-semibold text-success-text hover:bg-success-tint"
                  : "font-semibold text-foreground hover:bg-row-hover"
            )}
          >
            {monto ?? "+ monto"}
          </button>
        )}
        {overlay && monto !== null && (
          <p className="font-mono text-xs font-semibold tabular-nums">{monto}</p>
        )}
      </div>
    </div>
  );
}
