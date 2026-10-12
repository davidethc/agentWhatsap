"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { delta, type Comparable, type RateDto } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * El marco común de las tarjetas de indicador: kicker arriba, número grande
 * en medio y la referencia abajo. Vive dentro de una sección elevada, así que
 * va hundida (`bg-subtle`) y se aclara un poco al pasar el cursor.
 */
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card-surface-hover flex min-w-0 flex-col rounded-lg border border-transparent bg-subtle px-3.5 py-3 hover:border-border hover:bg-popover">
      <p className="kicker truncate" title={label}>
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * 019 — Tarjeta de indicador. Todo número comparable viaja con el mismo número
 * del periodo anterior: sin esa referencia, "12 tratos" no dice si el mes va
 * bien o mal. La dirección se lee por la flecha y el signo, no solo por el
 * color.
 */
export function StatCard({
  label,
  value,
  compare,
  hint,
  /** true = subir es peor (tratos perdidos, por ejemplo). */
  inverted = false,
}: {
  label: string;
  value: string;
  compare?: Comparable;
  hint?: string;
  inverted?: boolean;
}) {
  const d = compare ? delta(compare) : null;
  const mejor = d === null || d === 0 ? null : inverted ? d < 0 : d > 0;
  const Icon = d === null || d === 0 ? ArrowRight : d > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Tile label={label}>
      <p className="mt-2 truncate text-[26px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {compare && (
        <p
          className={cn(
            "mt-2.5 inline-flex max-w-full items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-medium",
            mejor === null
              ? "bg-chip text-text-3"
              : mejor
                ? "bg-success-tint text-success-text"
                : "bg-danger-tint text-danger-text"
          )}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {d === null ? (
            <span className="truncate">sin base previa ({compare.previous})</span>
          ) : (
            <span className="truncate">
              {d > 0 ? "+" : ""}
              {d}% vs. {compare.previous} antes
            </span>
          )}
        </p>
      )}
      {hint && <p className="mt-2 text-[11px] leading-snug text-text-3">{hint}</p>}
    </Tile>
  );
}

/** Tarjeta de una tasa: el porcentaje grande y, debajo, de cuántos casos. */
export function RateCard({
  label,
  rate,
  unit,
}: {
  label: string;
  rate: RateDto;
  unit: string;
}) {
  return (
    <Tile label={label}>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
        {rate.value === null ? "—" : `${rate.value}%`}
      </p>
      <p className="mt-2.5 text-[11px] leading-snug">
        {rate.value === null ? (
          <span className="text-text-3">sin casos en el periodo</span>
        ) : (
          <span className="text-text-3">
            de {rate.sample} {unit}
            {!rate.reliable && <span className="text-warning-text"> · muestra chica</span>}
          </span>
        )}
      </p>
    </Tile>
  );
}
