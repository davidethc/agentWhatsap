import { hasOperationalAccess } from "@/server/privacy/access";
import { notFound, redirect } from "next/navigation";
import { BookingsClient } from "@/components/bookings/bookings-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { clampListTo, isCalendarView, isIsoDate } from "@/lib/time/calendar";
import { todayInTz } from "@/lib/time/slots";
import { agendaEnabled } from "@/server/agenda/flag";
import { getSettings } from "@/server/agenda/settings";

export const dynamic = "force-dynamic";

type Params = { vista?: string; fecha?: string; desde?: string; hasta?: string };

/**
 * 215 — Citas en calendario. La vista y la fecha viven en la URL
 * (`?vista=semana&fecha=2026-09-18`, o `desde`/`hasta` en la Lista) para que
 * recargar o compartir el enlace abra en el mismo sitio.
 *
 * "Hoy" se decide aquí, en la zona del NEGOCIO: el navegador de quien mira
 * puede estar en otra.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  // Sin la bandera esta pantalla no existe en esta instancia.
  if (!agendaEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (!(await hasOperationalAccess(session))) {
    return (
      <main className="mx-auto max-w-lg p-8" aria-labelledby="acceso-restringido">
        <h1 id="acceso-restringido" className="text-xl font-semibold">Acceso restringido</h1>
        <p className="mt-3">Solo la cuenta habilitada de la doctora puede consultar conversaciones y atender pacientes.</p>
      </main>
    );
  }

  const settings = await getSettings(session.organizationId);
  const params = await searchParams;
  const view = isCalendarView(params.vista) ? params.vista : null;
  const listFrom = isIsoDate(params.desde) ? params.desde : null;
  const date =
    view === "lista" && listFrom
      ? listFrom
      : isIsoDate(params.fecha)
        ? params.fecha
        : todayInTz(new Date(), settings.timezone);

  return (
    <BookingsClient
      initialView={view}
      initialDate={date}
      initialListTo={
        view === "lista" && isIsoDate(params.hasta)
          ? clampListTo(date, params.hasta)
          : null
      }
      timezone={settings.timezone}
      weeklyHours={settings.weeklyHours}
    />
  );
}
