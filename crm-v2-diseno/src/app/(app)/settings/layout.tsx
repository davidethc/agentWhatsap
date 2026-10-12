import { SettingsNav } from "@/components/settings/settings-nav";
import { agendaEnabled } from "@/server/agenda/flag";
import { atribucionEnabled } from "@/server/attribution/flag";
import { isChannelEnabled } from "@/server/channels/enabled";

// La bandera se lee en cada petición: si esto se resolviera al construir, la
// imagen quedaría con la agenda apagada para siempre y encenderla en la
// plataforma no haría nada.
export const dynamic = "force-dynamic";

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full flex-col bg-subtle">
      <header className="board-head mb-0 border-b bg-background px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="kicker mb-1.5">Ajustes · instancia</p>
          <h2 className="text-[20px] font-bold leading-tight tracking-tight">Configuración</h2>
        </div>
      </header>
      {/* En móvil las pestañas van arriba (en fila), no como columna lateral. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-0 sm:flex-row sm:gap-4 sm:p-6">
        <SettingsNav
          agenda={agendaEnabled()}
          atribucion={atribucionEnabled()}
          messenger={isChannelEnabled("messenger")}
        />
        <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-0">{children}</div>
      </div>
    </div>
  );
}
