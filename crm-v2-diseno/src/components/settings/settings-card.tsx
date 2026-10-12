import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de una sección de Ajustes: la misma `Card` de siempre vestida de
 * tarjeta del tablero (`card-surface`), para que cada grupo de opciones se
 * lea como una pieza sobre el lienzo hundido del layout.
 *
 * Todas las secciones son `CardHeader` + `CardContent`; aquí se igualan sin
 * tocar cada pantalla: cabecera separada por una línea, mismo aire arriba
 * del contenido y la descripción con el mismo interlineado.
 */
export function SettingsCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn(
        "card-surface overflow-hidden border-border bg-popover",
        "[&>div:first-child]:border-b [&>div:first-child]:pb-4",
        "[&>div:first-child_p]:leading-relaxed",
        "[&>div:nth-child(2)]:pt-5",
        className
      )}
      {...props}
    />
  );
}
