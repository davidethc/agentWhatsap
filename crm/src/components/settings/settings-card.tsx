import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de una sección de Ajustes: la misma `Card` de siempre vestida de
 * tarjeta del tablero (`card-surface`), para que cada grupo de opciones se
 * lea como una pieza sobre el lienzo hundido del layout.
 */
export function SettingsCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("card-surface border-border bg-popover", className)} {...props} />;
}
