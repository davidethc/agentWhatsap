"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RateDto } from "@/lib/analytics";

/**
 * 019 — Contenedor de cada bloque de Resultados. Cada sección carga por su
 * cuenta: una lenta no retrasa a las demás y una rota no deja la pantalla en
 * blanco.
 *
 * Al cambiar el rango, lo anterior se queda a la vista atenuado hasta que
 * llega lo nuevo: vaciar la sección en cada cambio la haría saltar y
 * parpadear justo mientras el dueño compara.
 *
 * En el tablero cada sección es una tarjeta elevada (`card-surface`) con su
 * kicker editorial arriba del título.
 */
export function Section({
  title,
  kicker,
  hint,
  loading,
  error,
  hasData,
  empty,
  emptyText,
  right,
  children,
  id,
}: {
  title: string;
  /** Etiqueta en mono sobre el título ("01 · Ventas"). */
  kicker?: string;
  hint?: string;
  loading: boolean;
  error?: string | null;
  /** Hay datos que pintar (aunque estén recargándose). */
  hasData: boolean;
  empty?: boolean;
  emptyText?: string;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} aria-busy={loading} className="card-surface scroll-mt-4">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          {kicker && <p className="kicker mb-1.5">{kicker}</p>}
          <h3 className="text-[17px] font-bold leading-tight tracking-tight">{title}</h3>
          {hint && <p className="mt-1 text-xs leading-relaxed text-text-3">{hint}</p>}
        </div>
        {right}
      </header>
      <div
        className={cn(
          "px-4 pb-4 transition-opacity sm:px-5 sm:pb-5",
          loading && hasData && "opacity-60"
        )}
      >
        {error ? (
          <p className="rounded-lg bg-danger-tint px-4 py-6 text-center text-sm text-danger-text">
            {error}
          </p>
        ) : !hasData ? (
          <div className="rounded-lg bg-subtle px-4 py-6 text-center">
            <p className="text-sm text-text-3">Calculando…</p>
          </div>
        ) : empty ? (
          <p className="rounded-lg bg-subtle px-4 py-6 text-center text-sm text-text-3">
            {emptyText ?? "No hay datos en este periodo."}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Un panel hundido dentro de una sección: agrupa una gráfica, una tabla o una
 * lista para que el tablero se lea por bloques.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 rounded-lg bg-subtle p-3.5 sm:p-4", className)}>{children}</div>;
}

/**
 * Una tasa NUNCA se muestra sola: siempre con el número que la sostiene, y
 * marcada cuando la muestra es chica.
 */
export function Rate({
  rate,
  unit = "casos",
  className,
}: {
  rate: RateDto;
  unit?: string;
  className?: string;
}) {
  if (rate.value === null) {
    return <span className={cn("text-text-3", className)}>sin datos</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={cn("font-medium", !rate.reliable && "text-text-2")}>
        {rate.value}%
      </span>
      <span className="text-xs text-text-3">
        de {rate.sample} {unit}
        {!rate.reliable && " · muestra chica"}
      </span>
    </span>
  );
}

/** Subtítulo de un bloque dentro de una sección. */
export function Subhead({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      <span className="min-w-0">{children}</span>
    </h4>
  );
}
