"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  MessageSquareText,
  Search,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import type { ContactDto } from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SOURCE_LABELS } from "@/server/contact-source";
import { priorityRank } from "@/server/leads/priority";
import { PriorityBadge } from "@/components/pipeline/priority-picker";
import { NewContactDialog } from "./new-contact-dialog";
import { StartConversation } from "./start-conversation";

export function ContactsClient() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactDto[]>([]);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [stages, setStages] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ContactDto | null>(null);
  const [creando, setCreando] = useState(false);
  const [escribiendo, setEscribiendo] = useState<ContactDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mismo rescate que en la Bandeja: lo tecleado antes de que hidrate el JS
  // se perdía en silencio. Ver conversation-list.tsx.
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed) setQuery(typed);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pipeline/stages").catch(() => null);
      if (!res?.ok) return;
      const data = (await res.json()) as { stages: { name: string }[] };
      setStages(data.stages.map((s) => s.name));
    })();
  }, []);

  const refetch = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (stage !== "all") params.set("stage", stage);
    if (showArchived) params.set("archived", "true");
    const res = await fetch(`/api/contacts?${params}`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { contacts: ContactDto[] };
    // A quién llamar primero: alta arriba, sin prioridad al final. El orden lo
    // decide esta lista, no el servidor, porque es una preferencia de trabajo y
    // no un dato del contacto.
    setContacts(
      [...data.contacts].sort(
        (a, b) => priorityRank(a.priority ?? null) - priorityRank(b.priority ?? null)
      )
    );
  }, [query, stage, showArchived]);

  useEffect(() => {
    const t = setTimeout(() => void refetch(), 250);
    return () => clearTimeout(t);
  }, [refetch]);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    void refetch();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="board-head mb-0 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="kicker">
              Directorio{contacts.length > 0 ? ` · ${contacts.length}` : ""}
            </p>
            <h2 className="text-[17px] font-bold tracking-tight">Pacientes</h2>
          </div>
          <Button size="sm" onClick={() => setCreando(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" strokeWidth={1.8} />
            Nuevo paciente
          </Button>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <label className="flex items-center gap-2 rounded-full border bg-subtle px-3 py-1.5 text-xs text-text-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-primary"
            />
            Ver archivados
          </label>
          {stages.length > 0 && (
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label="Filtrar por etapa del embudo"
              className="h-9 rounded-full border border-input bg-popover px-3 text-sm"
            >
              <option value="all">Toda etapa</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-3" />
            <Input
              ref={inputRef}
              placeholder="Buscar por nombre o teléfono…"
              aria-label="Buscar paciente"
              defaultValue=""
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-popover pl-8 sm:w-72"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2 pb-4 sm:px-4 sm:pb-6">
        {contacts.length === 0 ? (
          <div className="board-col h-full">
            {query.trim() || stage !== "all" ? (
              <EmptyState
                icon={Search}
                className="h-full"
                title="Sin resultados"
                description={
                  <>
                    Nadie coincide con
                    {query.trim() ? ` «${query.trim()}»` : ""}
                    {query.trim() && stage !== "all" ? " en" : ""}
                    {stage !== "all" ? ` la etapa «${stage}»` : ""}.
                  </>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                className="h-full"
                title="Sin pacientes"
                description="Cada persona que escriba a tu WhatsApp quedará registrada aquí automáticamente."
              />
            )}
          </div>
        ) : (
          <ul className="board-col grid overflow-visible sm:grid-cols-2 2xl:grid-cols-3">
            {contacts.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "card-surface card-surface-hover flex flex-col gap-3 p-3.5 focus-within:border-brand-soft hover:border-border-strong",
                  c.archivedAt && "opacity-75"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full ring-2 ring-brand-soft ring-offset-2 ring-offset-popover">
                    <ContactAvatar name={c.name} seed={c.id} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {c.name}
                      </span>
                      {c.priority && <PriorityBadge value={c.priority} />}
                    </div>
                    <p className="truncate font-mono text-[12px] text-text-3">
                      {formatPhone(c.phone)}
                    </p>
                  </div>
                </div>

                {(c.stageName ||
                  c.archivedAt ||
                  c.source?.source === "capturada") && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.stageName && (
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-text">
                        {c.stageName}
                      </span>
                    )}
                    {c.archivedAt && (
                      <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-text-2">
                        Archivado
                      </span>
                    )}
                    {/* Solo la fuente que alguien capturó: presentar una
                        deducción como dato la volvería un número inventado en
                        cuanto se cuente por fuente. */}
                    {c.source?.source === "capturada" && (
                      <span className="rounded-full bg-info-tint px-2 py-0.5 text-[11px] font-medium text-info-text">
                        {SOURCE_LABELS[c.source.value]}
                      </span>
                    )}
                  </div>
                )}

                {c.notes && (
                  <p className="line-clamp-2 text-xs text-text-2">
                    {c.notes.slice(0, 160)}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-1 border-t pt-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(c)}
                  >
                    Editar
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    {/* A quien nunca escribió hay que abrirle la conversación con
                        una plantilla: es regla de Meta, no del CRM. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Escribir primero"
                      title="Escribir primero (con plantilla)"
                      onClick={() => setEscribiendo(c)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Link href={`/inbox?contact=${c.id}`}>
                      <Button variant="ghost" size="icon" aria-label="Abrir conversación">
                        <MessageSquareText className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={c.archivedAt ? "Desarchivar" : "Archivar"}
                      onClick={() => void patch(c.id, { archived: !c.archivedAt })}
                    >
                      {c.archivedAt ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditDialog
          contact={editing}
          onClose={() => setEditing(null)}
          onSave={async (patchBody) => {
            await patch(editing.id, patchBody);
            setEditing(null);
          }}
        />
      )}

      {escribiendo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Escribir primero"
        >
          <div className="w-full max-w-md rounded-lg border bg-popover p-4 shadow-pop">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                Escribir a {escribiendo.name}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setEscribiendo(null)}>
                Cerrar
              </Button>
            </div>
            <StartConversation
              contactId={escribiendo.id}
              onStarted={() => {
                const contactId = escribiendo.id;
                setEscribiendo(null);
                // La Bandeja resuelve por CONTACTO (`?contact=`), no por
                // conversación: con `?conversation=` no seleccionaría nada.
                router.push(`/inbox?contact=${contactId}`);
              }}
            />
          </div>
        </div>
      )}

      {creando && (
        <NewContactDialog
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            void refetch();
          }}
          onOpenExisting={(contactId) => {
            setCreando(false);
            router.push(`/inbox?contact=${contactId}`);
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  contact,
  onClose,
  onSave,
}: {
  contact: ContactDto;
  onClose: () => void;
  onSave: (patch: { name: string; notes: string }) => Promise<void>;
}) {
  const [name, setName] = useState(contact.name);
  const [notes, setNotes] = useState(contact.notes ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-overlay p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-lg border bg-popover p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-semibold">Editar paciente</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="edit-name">
              Nombre
            </label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="edit-notes">
              Notas
            </label>
            <Textarea
              id="edit-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => void onSave({ name: name.trim(), notes })}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
