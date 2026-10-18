"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, PanelRight } from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import type { ConversationDto, MessageDto } from "@/lib/types";
import { CHANNEL_LABEL, type Channel } from "@/lib/channels";
import { ChannelBadge } from "@/components/channel-badge";
import { useEvents } from "@/components/use-events";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { Composer } from "./composer";
import { ContactPanel } from "./contact-panel";
import { ConversationActions } from "./conversation-actions";
import { UNCERTAIN_SEND } from "./send-attempt";

/**
 * Texto que ya salió del compositor pero cuyo POST todavía viaja. Existe solo
 * en el cliente: se pinta como burbuja "enviando" para que escribir el
 * siguiente renglón no espere a Meta (~1,5 s de ida y vuelta).
 */
type PendingOut = {
  id: string;
  conversationId: string;
  text: string;
  createdAt: string;
};

/**
 * `xl` es el umbral donde caben las tres columnas (lista + hilo + detalles).
 * Debajo, el panel de detalles flota sobre el hilo. Debe coincidir con el
 * breakpoint `xl:` que usan las clases de la sección de detalles.
 */
const PANEL_MEDIA_QUERY = "(min-width: 1280px)";
const isWideEnoughForPanel = () =>
  typeof window !== "undefined" && window.matchMedia(PANEL_MEDIA_QUERY).matches;

export function InboxClient({ channels }: { channels: readonly Channel[] }) {
  const multiChannel = channels.length > 1;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const accessEpoch = useRef(0);
  const listRequest = useRef(0);
  const clearAccess = useCallback(() => {
    accessEpoch.current += 1;
    setDenied(true);
    setConversations([]);
    setSelectedId(null);
    setMessages([]);
    setPending([]);
  }, []);
  const [conversations, setConversations] = useState<ConversationDto[] | null>(
    null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [pending, setPending] = useState<PendingOut[]>([]);
  // Arranca cerrado: en pantallas angostas el panel de detalles es un cajón
  // ENCIMA del hilo, así que abrirlo por defecto taparía la conversación. El
  // efecto de abajo lo abre solo si de veras hay tres columnas de ancho.
  const [panelOpen, setPanelOpen] = useState(false);
  // Se incrementa con cada evento SSE que puede cambiar la etapa/lead o el
  // estado del agente: el panel de detalles lo observa y refetch en vivo.
  const [detailRev, setDetailRev] = useState(0);

  useEffect(() => {
    if (!isWideEnoughForPanel()) return;
    setPanelOpen(localStorage.getItem("vocero.panelOpen") !== "false");
  }, []);
  const togglePanel = useCallback((open: boolean) => {
    setPanelOpen(open);
    // La preferencia es de escritorio: abrir el cajón en el teléfono no debe
    // reescribir cómo queda la Bandeja en la computadora.
    if (isWideEnoughForPanel()) {
      localStorage.setItem("vocero.panelOpen", String(open));
    }
  }, []);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const lastFetchRef = useRef<string | null>(null);
  const tmpSeq = useRef(0);
  // Los envíos salen en fila: el compositor ya no espera, pero WhatsApp debe
  // recibir "hola" antes que el renglón siguiente. Sin esta cadena, dos POST
  // simultáneos pueden llegar a Meta en desorden.
  const sendQueue = useRef<Promise<unknown>>(Promise.resolve());

  const refetchConversations = useCallback(async () => {
    const epoch = accessEpoch.current;
    const request = ++listRequest.current;
    const res = await fetch("/api/conversations", { cache: "no-store" }).catch(() => null);
    if (res?.status === 403) { clearAccess(); return; }
    if (epoch !== accessEpoch.current || request !== listRequest.current) return;
    if (!res?.ok) { setLoadError("No se pudo cargar la bandeja. Intenta de nuevo."); return; }
    setLoadError(null);
    const data = (await res.json()) as { conversations: ConversationDto[] };
    if (epoch !== accessEpoch.current || request !== listRequest.current) return;
    setConversations(data.conversations);
    if (selectedIdRef.current && !data.conversations.some((c) => c.id === selectedIdRef.current)) { setSelectedId(null); setMessages([]); setPending([]); }
    lastFetchRef.current = new Date().toISOString();
  }, [clearAccess]);

  const refetchMessages = useCallback(async (conversationId: string) => {
    const epoch = accessEpoch.current;
    setMessagesLoading(true);
    const res = await fetch(
      `/api/conversations/${conversationId}/messages`, { cache: "no-store" }
    ).catch(() => null);
    if (res?.status === 403) { clearAccess(); return; }
    if (epoch !== accessEpoch.current || selectedIdRef.current !== conversationId) return;
    setMessagesLoading(false);
    if (res?.status === 404) {
      setSelectedId(null); setMessages([]);
      setConversations((prev) => prev?.filter((c) => c.id !== conversationId) ?? []);
      return;
    }
    if (!res?.ok) { setMessages([]); setLoadError("No se pudo cargar el historial. Intenta de nuevo."); return; }
    setLoadError(null);
    const data = (await res.json()) as { messages: MessageDto[] };
    if (epoch === accessEpoch.current && selectedIdRef.current === conversationId) setMessages(data.messages);
  }, [clearAccess]);

  useEffect(() => {
    void refetchConversations();
  }, [refetchConversations]);

  const select = useCallback(
    (id: string) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      setMessages([]);
      void refetchMessages(id);
      void fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markRead: true }),
      });
    },
    [refetchMessages]
  );

  // Enlace directo desde Contactos/Pipeline: /inbox?contact=<id>
  const searchParams = useSearchParams();
  const contactParam = searchParams.get("contact");
  useEffect(() => {
    if (!contactParam || selectedIdRef.current) return;
    const match = conversations?.find((c) => c.contact.id === contactParam);
    if (match) select(match.id);
  }, [contactParam, conversations, select]);

  useEvents({
    onMessageNew: ({ conversationId, message }) => {
      if (denied) return;
      if (selectedIdRef.current === conversationId) {
        const m = message as MessageDto;
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m]
        );
        void fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markRead: true }),
        });
      }
      void refetchConversations();
      // Un entrante nuevo puede crear/mover el lead: refresca el panel.
      setDetailRev((v) => v + 1);
    },
    onMessageStatus: ({ conversationId, messageId, status, error }) => {
      if (denied || selectedIdRef.current !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                status: status as MessageDto["status"],
                error: error ?? null,
              }
            : m
        )
      );
    },
    onConversationUpdated: () => {
      void refetchConversations();
      // El agente movió de etapa o cambió el handoff: refresca el panel en vivo.
      setDetailRev((v) => v + 1);
    },
    onReconnect: () => {
      // Catch-up tras reconexión (contrato sse.md): refetch completo.
      void refetchConversations();
      if (selectedIdRef.current) void refetchMessages(selectedIdRef.current);
      setDetailRev((v) => v + 1);
    },
  });

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  /**
   * Hilo visible = lo confirmado + lo que aún viaja. El mensaje real puede
   * llegar por refetch o por SSE antes de que retiremos el provisional, así
   * que cada pendiente se empareja con UN mensaje real (no por texto suelto:
   * mandar "hola" dos veces seguidas no debe borrar la segunda burbuja).
   */
  const thread = useMemo(() => {
    const propios = pending.filter((p) => p.conversationId === selectedId);
    if (propios.length === 0) return messages;
    const emparejados = new Set<string>();
    const visibles = propios.filter((p) => {
      const real = messages.find(
        (m) =>
          !emparejados.has(m.id) &&
          m.direction === "out" &&
          m.text === p.text &&
          Date.parse(m.createdAt) >= Date.parse(p.createdAt) - 60_000
      );
      if (real) emparejados.add(real.id);
      return !real;
    });
    if (visibles.length === 0) return messages;
    return [
      ...messages,
      ...visibles.map<MessageDto>((p) => ({
        id: p.id,
        conversationId: p.conversationId,
        direction: "out",
        type: "text",
        text: p.text,
        status: "pending",
        error: null,
        aiGenerated: false,
        origin: "operator",
        media: null,
        createdAt: p.createdAt,
      })),
    ];
  }, [messages, pending, selectedId]);

  /**
   * El compositor NO espera a que esto termine: limpia su campo al instante y
   * aquí se pinta la burbuja "enviando". Si el envío falla, la burbuja se
   * retira y el error vuelve al compositor, que devuelve el texto — un mensaje
   * jamás se pierde en silencio.
   */
  const sendText = useCallback(
    async (text: string, idempotencyKey: string): Promise<string | null> => {
      const conversationId = selectedIdRef.current;
      if (!conversationId) return "Sin conversación seleccionada";

      const epoch = accessEpoch.current;
      const tmpId = `tmp_${++tmpSeq.current}`;
      setPending((prev) => [
        ...prev,
        {
          id: tmpId,
          conversationId,
          text,
          createdAt: new Date().toISOString(),
        },
      ]);
      const drop = () => setPending((prev) => prev.filter((p) => p.id !== tmpId));

      const run = async (): Promise<string | null> => {
        if (epoch !== accessEpoch.current) { drop(); return "La conversación ya no está disponible"; }
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, idempotencyKey }),
        }).catch(() => null);
        if (!res) {
          drop();
          return UNCERTAIN_SEND;
        }
        if (res.status === 403) { clearAccess(); drop(); return "Acceso denegado"; }
        if (res.status === 409) {
          const body = await res.json().catch(() => null);
          drop();
          return body?.error?.code === "human_control_required" ? "Toma la conversación para responder" : UNCERTAIN_SEND;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          drop();
          return data?.error?.message ?? "No se pudo enviar el mensaje";
        }
        // Primero traer el mensaje real, después quitar el provisional: al
        // revés, la burbuja parpadearía.
        await refetchMessages(conversationId);
        drop();
        void refetchConversations();
        return null;
      };

      const queued = sendQueue.current.then(run, run);
      sendQueue.current = queued.catch(() => null);
      return queued;
    },
    [refetchMessages, refetchConversations, clearAccess]
  );

  const patchConversation = useCallback(
    async (patch: { aiEnabled?: boolean; reactivate?: boolean }) => {
      if (!selectedIdRef.current) return;
      const res = await fetch(`/api/conversations/${selectedIdRef.current}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => null);
      if (res?.status === 403) { clearAccess(); return; }
      if (!res?.ok) throw new Error("No se pudo cambiar quién responde.");
      await refetchConversations();
    },
    [refetchConversations, clearAccess]
  );

  if (denied) return <div role="alert" className="p-6">Acceso denegado. La bandeja está disponible solo para la doctora.</div>;

  return (
    <div className="flex h-full flex-col">
      {loadError && <div role="alert" className="border-b bg-warning-tint p-3 text-warning-text">{loadError} <button className="underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { void refetchConversations(); if (selectedId) void refetchMessages(selectedId); }}>Reintentar</button></div>}
      <div className="flex min-h-0 flex-1">
      {/* Móvil: una columna a la vez. La lista cede la pantalla completa al
          hilo en cuanto hay conversación elegida (patrón maestro-detalle). */}
      <section
        className={cn(
          "w-full shrink-0 overflow-hidden border-r md:w-[300px] lg:w-[360px]",
          selected && "max-md:hidden"
        )}
      >
        <ConversationList
          conversations={conversations}
          channels={channels}
          selectedId={selectedId}
          onSelect={select}
          onSeeded={() => void refetchConversations()}
        />
      </section>

      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          !selected && "max-md:hidden"
        )}
      >
        {selected ? (
          <>
            <header className="flex items-center justify-between gap-1 border-b bg-popover px-2 py-2.5 shadow-sm md:px-4">
              {/* Volver a la lista: en móvil el hilo ocupa toda la pantalla. */}
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Volver a las conversaciones"
                className="shrink-0 rounded-md p-1.5 text-text-2 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-3 p-1">
                <span className="shrink-0 rounded-full ring-2 ring-border ring-offset-2 ring-offset-popover">
                  <ContactAvatar
                    name={selected.contact.name}
                    seed={selected.contact.id}
                    size="md"
                  />
                </span>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-tight tracking-tight">
                    {multiChannel && <ChannelBadge channel={selected.channel} />}
                    <span className="truncate">{selected.contact.name}</span>
                  </p>
                  <p
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full font-mono text-[10.5px] tracking-[0.04em]",
                      selected.windowOpen
                        ? "bg-success-tint px-2 py-px font-medium text-success-text"
                        : "text-text-3"
                    )}
                  >
                    {selected.windowOpen && (
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    )}
                    {selected.windowOpen
                      ? "ventana abierta"
                      : selected.contact.phone
                        ? formatPhone(selected.contact.phone)
                        : // Instagram no tiene teléfono: decir "Sin teléfono"
                          // sería contestar una pregunta que nadie hizo.
                          CHANNEL_LABEL[selected.channel]}
                  </p>
                </div>
              </div>
              {!panelOpen && (
                <button
                  onClick={() => togglePanel(true)}
                  aria-label="Mostrar detalles"
                  className="shrink-0 rounded-full border border-border bg-chip p-1.5 text-text-3 transition-colors hover:border-border-strong hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PanelRight className="h-4 w-4" strokeWidth={1.7} />
                </button>
              )}
            </header>
            <ConversationActions
              key={selected.id}
              conversation={selected}
              onToggle={(aiEnabled) => patchConversation({ aiEnabled })}
              onDelete={async () => {
                const id = selected.id;
                const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
                if (res.status === 403) { clearAccess(); return; }
                if (res.status !== 202 && res.status !== 404) throw new Error("No se pudo eliminar la conversación.");
                accessEpoch.current += 1;
                setMessages([]); setPending((prev) => prev.filter((p) => p.conversationId !== id));
                setSelectedId(null);
                setConversations((prev) => prev?.filter((c) => c.id !== id) ?? []);
              }}
            />
            {messagesLoading ? <p role="status" className="p-4">Cargando historial…</p> : <MessageThread messages={thread} />}
            <Composer
              key={selected.id}
              onAccessDenied={clearAccess}
              conversation={selected}
              onSend={sendText}
              onSent={() => {
                if (selectedIdRef.current)
                  void refetchMessages(selectedIdRef.current);
                void refetchConversations();
              }}
            />
          </>
        ) : (
          <div className="thread-bg flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="kicker">Bandeja · tiempo real</p>
            <p className="font-serif text-[24px] italic leading-tight text-text-2">
              Elige una conversación para ver el hilo
            </p>
          </div>
        )}
      </section>

      {/* Velo del cajón de detalles (solo donde no caben tres columnas). */}
      {panelOpen && selected && (
        <button
          aria-label="Cerrar los detalles"
          tabIndex={-1}
          onClick={() => togglePanel(false)}
          className="fixed inset-0 z-30 bg-overlay xl:hidden"
        />
      )}

      <section
        className={cn(
          "shrink-0 overflow-hidden border-l transition-[width] duration-200",
          // Debajo de xl no hay ancho para una tercera columna: el panel se
          // vuelve un cajón que entra desde la derecha, encima del hilo.
          "max-xl:fixed max-xl:inset-y-0 max-xl:right-0 max-xl:z-40 max-xl:w-auto max-xl:bg-popover max-xl:transition-transform",
          panelOpen && selected
            ? "w-[320px] max-xl:translate-x-0 max-xl:shadow-pop"
            : "w-0 border-l-0 max-xl:translate-x-full"
        )}
      >
        {selected && (
          // En escritorio el panel es una tarjeta del tablero sobre el hueco
          // hundido; como cajón (debajo de xl) ocupa el borde a borde.
          <div className="h-full w-[320px] max-xl:w-[min(320px,88vw)] xl:bg-subtle xl:p-2.5">
            <ContactPanel
              key={selected.id}
              conversation={selected}
              refreshKey={detailRev}
              onPatchConversation={patchConversation}
              onClose={() => togglePanel(false)}
            />
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
