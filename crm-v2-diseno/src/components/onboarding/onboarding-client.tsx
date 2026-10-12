"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Power } from "lucide-react";
import type { Guide } from "@/server/onboarding/guide";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * La primera pantalla (issue #86): los pasos con su avance y, al final, el
 * botón que enciende el agente. Todo lo que afirma viene del servidor
 * (`guide`); aquí solo se pinta y se enciende.
 */
export function OnboardingClient({
  guide,
  agentName,
}: {
  guide: Guide;
  agentName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = guide.steps.length;
  const done = guide.steps.filter((s) => s.done).length;
  const current = guide.steps.find((s) => !s.done)?.key ?? null;
  // Antes del paso 1 el nombre es el de fábrica («Asistente») y se lee como
  // una palabra suelta, no como el nombre de alguien: se dice «tu agente».
  const agentReady = guide.steps.find((s) => s.key === "agent")?.done ?? false;
  const agente = (agentReady && agentName) || "tu agente";

  async function encender() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/agent/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(
        data?.error?.message ?? "No pudimos encender el agente. Inténtalo de nuevo."
      );
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  // Foco visible de los enlaces de texto: el mismo anillo del tablero.
  const foco =
    "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="h-full overflow-y-auto bg-subtle">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <header className="board-head mb-0 flex-col">
          <p className="kicker">Guía de inicio</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            Deja listo tu CRM en {total} pasos
          </h1>
          <p className="max-w-xl text-[14px] text-text-2">
            Hazlos en orden: cada botón te lleva a la pantalla que toca. Al
            volver aquí verás tu avance.
          </p>
        </header>

        <div aria-label="Avance" className="card-surface px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <span className="kicker">Avance</span>
              <span className="text-sm font-semibold">
                {done} de {total} listos
              </span>
            </span>
            {guide.complete && (
              <span className="rounded-full bg-success-tint px-2.5 py-0.5 text-[12px] font-semibold text-success-text">
                ¡Completo!
              </span>
            )}
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-chip">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>

        {/* El riel de la izquierda une los pasos: se lee de arriba abajo, en
            verde lo hecho y el paso que toca resaltado con el acento. */}
        <ol>
          {guide.steps.map((step, i) => {
            const isCurrent = step.key === current;
            const last = i === total - 1;
            return (
              <li key={step.key} className="relative flex gap-3 pb-3 last:pb-0 sm:gap-4">
                <div className="flex shrink-0 flex-col items-center pt-4 sm:pt-5">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      // Verde de estado con su propio texto: legible en los dos
                      // temas sin un blanco cableado.
                      step.done
                        ? "bg-success-tint text-success-text"
                        : isCurrent
                          ? "bg-brand text-brand-fg ring-4 ring-brand-soft"
                          : "border border-border-strong bg-popover text-text-3"
                    )}
                  >
                    {step.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                  </span>
                  {!last && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -bottom-4 left-4 top-12 w-px sm:-bottom-5 sm:top-[52px]",
                        step.done ? "bg-success" : "bg-border-strong"
                      )}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "card-surface min-w-0 flex-1 p-4 sm:p-5",
                    isCurrent && "border-ring shadow-md ring-1 ring-ring",
                    step.done && "shadow-none"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      className={cn(
                        "font-semibold tracking-tight",
                        step.done && "text-text-2"
                      )}
                    >
                      {step.title}
                      <span className="sr-only">{step.done ? " (listo)" : " (pendiente)"}</span>
                    </h2>
                    {isCurrent && (
                      <span aria-hidden className="kicker shrink-0 text-brand-ink">
                        Ahora
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-3">{step.description}</p>
                  {!step.done && step.hint && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-text-3">
                      <span
                        aria-hidden
                        className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                      />
                      {step.hint}
                    </p>
                  )}
                  <div className="mt-3">
                    {step.done ? (
                      <Link
                        href={step.href}
                        className={cn(
                          "text-sm text-text-3 underline underline-offset-2 hover:text-foreground",
                          foco
                        )}
                      >
                        Listo · revisar
                      </Link>
                    ) : (
                      <Link
                        href={step.href}
                        className={buttonVariants({
                          size: "sm",
                          variant: isCurrent ? "default" : "outline",
                        })}
                      >
                        {step.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <section
          className={cn(
            "card-surface p-5",
            guide.complete && !guide.enabled && "border-ring bg-brand-tint ring-1 ring-ring"
          )}
        >
          {guide.enabled ? (
            <>
              <p className="kicker text-success-text">Agente encendido</p>
              <h2 className="mt-1 font-semibold tracking-tight">
                {agentReady && agentName
                  ? `${agentName} ya está contestando`
                  : "Tu agente ya está contestando"}
              </h2>
              <p className="mt-1 text-sm text-text-3">
                El agente está encendido y atiende a tus clientes por WhatsApp.
                Puedes apagarlo cuando quieras desde Agente.
              </p>
              <Link href="/inbox" className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
                Ir a la Bandeja <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : guide.complete ? (
            <>
              <h2 className="font-semibold tracking-tight">¡Todo listo! Enciende a {agente}</h2>
              <p className="mt-1 text-sm text-text-2">
                Desde ese momento contestará a tus clientes por WhatsApp. Puedes
                apagarlo cuando quieras desde Agente.
              </p>
              <Button className="mt-3" disabled={busy} onClick={() => void encender()}>
                <Power className="h-4 w-4" />
                {busy ? "Encendiendo…" : `Encender a ${agente}`}
              </Button>
              {error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                <Power className="h-4 w-4 text-text-3" />
                Al final: encender a {agente}
              </h2>
              <p className="mt-1 text-sm text-text-3">
                Tu agente empieza apagado: mientras no lo enciendas no le
                contesta a nadie y los mensajes que lleguen los atiendes tú desde
                la Bandeja. Cuando completes los {total} pasos, aquí aparece el
                botón para encenderlo.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
