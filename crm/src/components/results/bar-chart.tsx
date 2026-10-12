"use client";

/**
 * 019 — Barras horizontales para distribuciones (motivos de escalamiento).
 * Horizontales porque las etiquetas son frases ("Ventana de 24 h cerrada") y
 * en vertical se cortarían o se girarían. El número va escrito: la barra
 * compara, no informa.
 */
export function BarChart({
  items,
  emptyText = "Sin datos en este periodo.",
}: {
  items: { key: string; label: string; count: number }[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="py-2 text-sm text-text-3">{emptyText}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 rounded-full bg-popover px-2 py-px text-xs font-semibold tabular-nums shadow-sm">
              {i.count}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-chip" aria-hidden>
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(1, (i.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
