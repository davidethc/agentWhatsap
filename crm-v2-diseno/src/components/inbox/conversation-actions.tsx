"use client";

import { useRef, useState } from "react";
import type { ConversationDto } from "@/lib/types";
import { Button } from "@/components/ui/button";

/** Controles confirmados por servidor; nunca anuncia la pausa de forma optimista. */
export function ConversationActions({ conversation, onToggle, onDelete }: {
  conversation: ConversationDto;
  onToggle: (enabled: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const human = !conversation.aiEnabled || Boolean(conversation.handoffAt);
  async function run(action: () => Promise<void>) {
    setPending(true); setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la acción."); }
    finally { setPending(false); }
  }
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  return <section aria-label="Atención de la conversación" className="border-b bg-popover px-4 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="mr-auto text-sm font-medium">{human ? "Eli pausada · atención humana" : "Eli atiende esta conversación"}</p>
      <Button size="sm" disabled={pending} onClick={() => void run(() => onToggle(human))}>
        {pending ? "Procesando…" : human ? "Devolver a Eli" : "Tomar conversación"}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={(event) => { trigger.current = event.currentTarget; setDialogOpen(true); dialog.current?.showModal(); }}>Eliminar conversación</Button>
    </div>
    <p className="mt-2 text-xs text-text-3">El historial y los adjuntos se conservan 90 días desde la última actividad. Una respuesta ya aceptada por el proveedor no puede cancelarse retroactivamente.</p>
    {error && !dialogOpen && <p role="alert" className="mt-2 text-sm text-danger-text">{error}</p>}
    <dialog ref={dialog} aria-labelledby="delete-conversation-title" aria-describedby="delete-conversation-description" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => { setDialogOpen(false); trigger.current?.focus(); }} className="max-w-md rounded-xl border bg-popover p-6 text-foreground shadow-pop backdrop:bg-overlay">
      <h2 id="delete-conversation-title" className="text-lg font-semibold">¿Eliminar conversación?</h2>
      <p id="delete-conversation-description" className="my-4 text-sm text-text-2">Se eliminarán el historial y los adjuntos de esta conversación. La ficha del paciente se conserva. Esta acción no se puede deshacer.</p>
      {error && <p role="alert" className="mb-4 text-sm text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button autoFocus variant="outline" disabled={pending} onClick={close}>Cancelar</Button>
        <Button disabled={pending} onClick={() => void run(async () => { await onDelete(); close(); })}>{pending ? "Eliminando…" : "Eliminar conversación"}</Button>
      </div>
    </dialog>
  </section>;
}
