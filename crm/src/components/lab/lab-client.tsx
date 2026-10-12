"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Play,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { ContactAvatar } from "@/components/avatar";
import { useEvents } from "@/components/use-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Run = {
  id: string;
  status: "running" | "done" | "failed";
  score: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  delta: number | null;
};

type Hallazgo = {
  tipo: "alucinacion" | "fuera_de_kb" | "debio_escalar" | "tono";
  evidencia: string;
  sugerencia?: { pregunta: string; respuesta: string };
};

type Case = {
  id: string;
  persona: string;
  personaLabel: string;
  status: string;
  veredicto: "verde" | "amarillo" | "rojo" | null;
  hallazgos: Hallazgo[];
  transcript: { role: "cliente" | "agente"; text: string }[];
};

const TIPO_LABELS: Record<Hallazgo["tipo"], string> = {
  alucinacion: "Alucinación",
  fuera_de_kb: "Fuera del conocimiento",
  debio_escalar: "Debió escalar",
  tono: "Tono",
};

export function LabClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ run: Run; cases: Case[] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchRuns = useCallback(async () => {
    const res = await fetch("/api/lab/runs").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { runs: Run[]; aiConfigured: boolean };
    setRuns(data.runs);
    setAiConfigured(data.aiConfigured);
    if (!selectedRunId && data.runs[0]) setSelectedRunId(data.runs[0].id);
  }, [selectedRunId]);

  const refetchDetail = useCallback(async (runId: string) => {
    const res = await fetch(`/api/lab/runs/${runId}`).catch(() => null);
    if (!res?.ok) return;
    setDetail((await res.json()) as { run: Run; cases: Case[] });
  }, []);

  useEffect(() => {
    void refetchRuns();
  }, [refetchRuns]);

  useEffect(() => {
    if (selectedRunId) void refetchDetail(selectedRunId);
  }, [selectedRunId, refetchDetail]);

  useEvents({
    onLabRun: (data) => {
      setProgress(data.status === "running" ? data.progress : null);
      void refetchRuns();
      if (selectedRunId === data.runId || !selectedRunId) {
        setSelectedRunId(data.runId);
        void refetchDetail(data.runId);
      }
    },
  });

  async function launch() {
    setLaunching(true);
    setError(null);
    const res = await fetch("/api/lab/runs", { method: "POST" }).catch(() => null);
    setLaunching(false);
    if (!res) return;
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo lanzar la corrida");
      return;
    }
    const data = (await res.json()) as { runId: string };
    setSelectedRunId(data.runId);
    setProgress({ done: 0, total: 6 });
    void refetchRuns();
  }

  if (!aiConfigured) {
    return (
      <div className="flex h-full flex-col bg-subtle">
        <Header running={false} launching={false} onLaunch={() => {}} disabled />
        <div className="card-surface m-3 p-8 text-center sm:m-6">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand ring-4 ring-brand-soft">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="font-medium">
            Configura tu proveedor de IA para usar el Laboratorio
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            El Laboratorio necesita un proveedor de IA activo: configúralo en{" "}
            <Link
              href="/settings/ai"
              className="font-medium text-brand-text underline underline-offset-2"
            >
              Ajustes → IA
            </Link>{" "}
            y vuelve aquí.
          </p>
        </div>
      </div>
    );
  }

  const running = runs.some((r) => r.status === "running");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-subtle">
      <Header
        running={running}
        launching={launching}
        onLaunch={() => void launch()}
        disabled={false}
      />
      {error && (
        <p className="mx-3 mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger-text sm:mx-6">
          {error}
        </p>
      )}

      {running && progress && (
        <div className="card-surface mx-3 mt-3 p-4 sm:mx-6 sm:mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden />
              Evaluando personas…
            </span>
            <span className="rounded-full bg-chip px-2 py-px font-mono text-xs text-text-2">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-chip">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2.5 p-3 sm:gap-4 sm:p-6 lg:grid-cols-[300px_1fr] lg:items-start">
        <HistoryList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
        {detail ? (
          <Report detail={detail} onApplied={() => void refetchDetail(detail.run.id)} />
        ) : (
          <EmptyState
            icon={FlaskConical}
            className="rounded-lg border border-dashed border-border-strong bg-background p-10"
            title={runs.length === 0 ? "Sin corridas todavía" : "Elige una corrida"}
            description={
              runs.length === 0
                ? "Corre tu primera evaluación: 6 clientes simulados conversarán con tu agente y un juez calificará cada conversación."
                : "Abre una corrida del historial para ver su reporte."
            }
          />
        )}
      </div>
    </div>
  );
}

function Header({
  running,
  launching,
  onLaunch,
  disabled,
}: {
  running: boolean;
  launching: boolean;
  onLaunch: () => void;
  disabled: boolean;
}) {
  return (
    <header className="board-head mb-0 items-center border-b bg-background px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="kicker mb-1.5">Sandbox · evaluación</p>
        <h2 className="flex items-center gap-2 text-[20px] font-bold leading-tight tracking-tight">
          <FlaskConical className="h-5 w-5 text-primary" /> Laboratorio
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sandbox interno — no envía mensajes reales
        </p>
      </div>
      <Button onClick={onLaunch} disabled={disabled || running || launching} className="rounded-full">
        <Play className="h-4 w-4" />
        {running ? "Corrida en curso…" : "Correr evaluación"}
      </Button>
    </header>
  );
}

function HistoryList({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: Run[];
  selectedRunId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="board-col max-h-none overflow-visible lg:sticky lg:top-0 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between px-1 pt-0.5">
        <p className="kicker">
          Historial
        </p>
        <span className="rounded-full bg-chip px-2 py-px font-mono text-[10.5px] text-text-3">
          {runs.length}
        </span>
      </div>
      {runs.length === 0 && (
        <p className="px-1 pb-1 text-xs text-muted-foreground">Sin corridas todavía.</p>
      )}
      {runs.map((run) => (
        <button
          key={run.id}
          onClick={() => onSelect(run.id)}
          aria-pressed={selectedRunId === run.id}
          className={cn(
            "card-surface card-surface-hover w-full p-3 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
            selectedRunId === run.id && "border-brand ring-1 ring-brand"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <ScoreBadge run={run} />
            {run.delta !== null && run.delta !== 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-2 py-px text-xs font-medium",
                  run.delta > 0 ? "bg-success-tint text-success-text" : "bg-danger-tint text-danger-text"
                )}
              >
                {run.delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {run.delta > 0 ? "+" : ""}
                {run.delta}
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {new Date(run.startedAt).toLocaleString("es-MX", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </button>
      ))}
    </div>
  );
}

function ScoreBadge({ run }: { run: Run }) {
  if (run.status === "running") return <Badge variant="secondary">En curso…</Badge>;
  if (run.status === "failed") return <Badge variant="destructive">Fallida</Badge>;
  const score = run.score ?? 0;
  const variant = score >= 80 ? "success" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>Score {score}</Badge>;
}

const VEREDICTO_TILE: Record<"verde" | "amarillo" | "rojo", string> = {
  verde: "bg-success-tint text-success-text",
  amarillo: "bg-warning-tint text-warning-text",
  rojo: "bg-danger-tint text-danger-text",
};

function Report({
  detail,
  onApplied,
}: {
  detail: { run: Run; cases: Case[] };
  onApplied: () => void;
}) {
  const { run, cases } = detail;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <section className="card-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="kicker mb-1.5">Corrida · resultado</p>
            <h3 className="text-[17px] font-bold leading-tight tracking-tight">Reporte</h3>
          </div>
          <ScoreBadge run={run} />
        </div>
        {run.status === "failed" && (
          <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger-text">
            La corrida falló: {run.error ?? "error desconocido"}. Vuelve a
            intentarlo.
          </p>
        )}
        {run.status === "done" && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-sm">
              {(["verde", "amarillo", "rojo"] as const).map((v) => (
                <div key={v} className={cn("rounded-lg px-3 py-3.5", VEREDICTO_TILE[v])}>
                  <p className="text-[28px] font-semibold leading-none tabular-nums">
                    {cases.filter((c) => c.veredicto === v).length}
                  </p>
                  <p className="kicker mt-2 capitalize text-current">{v}s</p>
                </div>
              ))}
            </div>
            {cases.some((c) => c.status === "judge_failed") && (
              <p className="mt-3 text-xs text-warning-text">
                {cases.filter((c) => c.status === "judge_failed").length} caso(s) sin
                veredicto (el juez no respondió válido); excluidos del score.
              </p>
            )}
          </>
        )}
      </section>

      {cases.map((c) => (
        <CaseCard key={c.id} testCase={c} onApplied={onApplied} />
      ))}
    </div>
  );
}

function CaseCard({ testCase, onApplied }: { testCase: Case; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const c = testCase;
  const icon =
    c.veredicto === "verde" ? (
      <CheckCircle2 className="h-4 w-4 text-success" />
    ) : c.veredicto === "amarillo" ? (
      <AlertTriangle className="h-4 w-4 text-warning-text" />
    ) : c.veredicto === "rojo" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    );
  const anillo =
    c.veredicto === "verde"
      ? "ring-success-soft"
      : c.veredicto === "amarillo"
        ? "ring-warning-soft"
        : c.veredicto === "rojo"
          ? "ring-danger-soft"
          : "ring-border";

  return (
    <div className="card-surface card-surface-hover">
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover sm:px-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3 text-sm font-semibold">
          <span className={cn("shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-popover", anillo)}>
            <ContactAvatar name={c.personaLabel} seed={c.persona} />
          </span>
          {icon}
          <span className="truncate">{c.personaLabel}</span>
          {c.status === "judge_failed" && (
            <Badge variant="secondary">sin veredicto</Badge>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {c.hallazgos.length > 0 && (
            <span className="rounded-full bg-warning-tint px-2 py-px font-medium text-warning-text">
              {`${c.hallazgos.length} hallazgo(s)`}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t px-3.5 pb-3.5 pt-3 sm:px-4">
          {c.hallazgos.map((h, i) => (
            <HallazgoCard key={i} hallazgo={h} caseId={c.id} index={i} onApplied={onApplied} />
          ))}
          <div className="rounded-lg bg-subtle p-3">
            <p className="mb-2 kicker">
              Transcript
            </p>
            <div className="space-y-1.5 text-sm">
              {c.transcript.map((t, i) => (
                <p key={i}>
                  <span
                    className={
                      t.role === "cliente" ? "font-medium text-info-text" : "font-medium text-brand-text"
                    }
                  >
                    {t.role === "cliente" ? "Cliente" : "Agente"}:
                  </span>{" "}
                  {t.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function HallazgoCard({
  hallazgo,
  caseId,
  index,
  onApplied,
}: {
  hallazgo: Hallazgo;
  caseId: string;
  index: number;
  onApplied: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pregunta, setPregunta] = useState(hallazgo.sugerencia?.pregunta ?? "");
  const [respuesta, setRespuesta] = useState(hallazgo.sugerencia?.respuesta ?? "");
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    const res = await fetch("/api/lab/suggestions/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId, hallazgoIndex: index, pregunta, respuesta }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setApplied(true);
      setEditing(false);
      onApplied();
    }
  }

  return (
    <div className="rounded-lg border border-warning-soft bg-warning-tint p-3">
      <div className="flex items-center justify-between">
        <Badge variant="warning">{TIPO_LABELS[hallazgo.tipo]}</Badge>
        {hallazgo.sugerencia && !applied && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Agregar al conocimiento
          </Button>
        )}
        {applied && (
          <span className="rounded-full bg-success-tint px-2 py-px text-xs font-medium text-success-text">Agregado al conocimiento ✓</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Evidencia:</span>{" "}
        {hallazgo.evidencia}
      </p>
      {editing && hallazgo.sugerencia && (
        <div className="mt-3 space-y-2 rounded-lg border bg-popover p-3 shadow-sm">
          <div className="space-y-1">
            <Label htmlFor={`sug-q-${caseId}-${index}`}>Pregunta</Label>
            <Input
              id={`sug-q-${caseId}-${index}`}
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`sug-a-${caseId}-${index}`}>Respuesta</Label>
            <Textarea
              id={`sug-a-${caseId}-${index}`}
              rows={3}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void apply()}
              disabled={saving || !pregunta.trim() || !respuesta.trim()}
            >
              {saving ? "Guardando…" : "Guardar en el KB"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
