"use client";

import type { BotBlockDto } from "@/lib/analytics";
import { BarChart } from "./bar-chart";
import { Panel, Rate, Section, Subhead } from "./section";
import { RateCard, StatCard } from "./stat-card";

/**
 * 019 — El trabajo del agente: si contesta, qué tan rápido, cuándo pasa a un
 * humano y —con la agenda encendida— cómo salen las citas. Todo sobre las
 * conversaciones que empezaron en el periodo, sin las del Laboratorio.
 */
export function BotSection({
  data,
  loading,
  error,
  agenda,
}: {
  data: BotBlockDto | null;
  loading: boolean;
  error: string | null;
  /** 015 — Sin la bandera AGENDA no se habla de citas en ningún lado. */
  agenda: boolean;
}) {
  return (
    <Section
      id="agente"
      title="El agente"
      kicker="03 · Agente"
      hint={
        agenda
          ? "Si contesta, qué tan rápido, cuándo pasa a un humano y cómo salen las citas."
          : "Si contesta, qué tan rápido y cuándo pasa la conversación a un humano."
      }
      loading={loading}
      error={error}
      hasData={!!data}
      empty={!!data?.empty}
      emptyText="Todavía no hay conversaciones en este periodo."
    >
      {data && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Conversaciones nuevas" value={String(data.conversations)} />
            <RateCard
              label="Contestó el agente"
              rate={data.aiReplyRate}
              unit="con mensaje del cliente"
            />
            <StatCard
              label="Primera respuesta"
              value={
                data.firstResponseSeconds === null
                  ? "—"
                  : formatSegundos(data.firstResponseSeconds)
              }
              hint={
                data.firstResponseSample === 0
                  ? "el agente aún no ha contestado a nadie"
                  : `mediana de ${data.firstResponseSample} conversaciones`
              }
            />
            <RateCard
              label="Pasaron a un humano"
              rate={data.handoffRate}
              unit="conversaciones"
            />
          </div>

          {agenda && data.sessions && (
            <div className="pt-2">
              <Subhead>Citas del periodo</Subhead>
              {data.sessions.booked === 0 ? (
                <p className="text-sm text-text-3">Ninguna cita cae en este periodo.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                  <StatCard
                    label="Citas"
                    value={String(data.sessions.booked)}
                    hint={pendientes(data.sessions)}
                  />
                  <StatCard label="Realizadas" value={String(data.sessions.done)} />
                  <StatCard label="No llegaron" value={String(data.sessions.noShow)} />
                  <StatCard label="Canceladas" value={String(data.sessions.cancelled)} />
                  <RateCard
                    label="Asistencia"
                    rate={data.sessions.showRate}
                    unit="con desenlace"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2.5 lg:grid-cols-2">
            <Panel>
              <Subhead>Por qué pasó a un humano</Subhead>
              <BarChart
                items={data.handoffs}
                emptyText="Ninguna conversación del periodo pasó a un humano."
              />
            </Panel>

            <Panel>
              <Subhead>Ficha del paciente</Subhead>
              {data.fichaCoverage === null ? (
                // `null` NO es 0 %: es que el agente de esta instancia no escribe
                // ficha. Enseñar 0 % sería acusarlo de no hacer algo que nunca se
                // le pidió.
                <p className="text-sm text-text-3">
                  Nadie está llenando la ficha de los pacientes. La escribe un cerebro
                  externo (<code className="font-mono text-xs">PUT /api/bot/ficha</code>) o
                  tu equipo desde el panel de la conversación.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <Rate rate={data.fichaCoverage} unit="pacientes nuevos" />
                  </p>
                  <p className="mt-1 text-xs text-text-3">
                    De los pacientes que llegaron en este periodo, a cuántos les sacó datos.
                  </p>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Section>
  );
}

/** Las citas del periodo que todavía no tienen desenlace (siguen agendadas). */
function pendientes(s: NonNullable<BotBlockDto["sessions"]>): string | undefined {
  const n = s.booked - s.done - s.noShow - s.cancelled;
  if (n <= 0) return undefined;
  return n === 1 ? "1 sin desenlace todavía" : `${n} sin desenlace todavía`;
}

/** Segundos en algo que se lee de un vistazo. */
export function formatSegundos(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round((s / 3600) * 10) / 10} h`;
}
