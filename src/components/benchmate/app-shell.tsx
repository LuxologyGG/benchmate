"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SAMPLE_META } from "@/lib/demo/fixtures";
import type {
  AgentResult,
  ExtractionResult,
  LabReport,
  LabSampleId,
  ProtocolDeviation,
  TraceEvent,
  VerificationResult,
} from "@/lib/types";
import { PipelineProgress, type PipelineStageId } from "@/components/benchmate/pipeline-progress";
import { AgentTracePanel } from "@/components/benchmate/agent-trace-panel";
import { BoundingBoxOverlay } from "@/components/benchmate/bounding-box-overlay";
import { MeasurementTable } from "@/components/benchmate/measurement-table";
import { CalibrationChart } from "@/components/benchmate/calibration-chart";
import { FigletSectionTitle, FigletWordmark } from "@/components/benchmate/ascii-header";
import { AsciiBio, AsciiLoader } from "@/components/benchmate/ascii-bio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Beaker,
  Download,
  FileText,
  FlaskConical,
  ImagePlus,
  Loader2,
  CircleDot,
  Scale,
} from "lucide-react";

function Panel({
  children,
  className = "",
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={`border border-border/70 bg-card/50 animate-in fade-in slide-in-from-bottom-2 duration-500 ${className}`}
    >
      {children}
    </section>
  );
}

type Health = { demoMode: boolean; provider: string; model: string };

type ImageItem = { id: string; name: string; dataUrl: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchSampleAsDataUrl(path: string, name: string): Promise<ImageItem> {
  const res = await fetch(path);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { id: `sample-${name}`, name, dataUrl };
}

export function BenchMateApp() {
  const [health, setHealth] = useState<Health | null>(null);
  const [sampleId, setSampleId] = useState<LabSampleId>("colony-plate");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [stage, setStage] = useState<
    "upload" | "running" | "confirm" | "done" | "error"
  >("upload");
  const [pipelineStage, setPipelineStage] = useState<PipelineStageId>("upload");
  const [doneThrough, setDoneThrough] = useState<PipelineStageId | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [agent, setAgent] = useState<AgentResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [report, setReport] = useState<LabReport | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [deviations, setDeviations] = useState<ProtocolDeviation[]>([]);
  const [orchestratorModel, setOrchestratorModel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ demoMode: true, provider: "demo", model: "demo-fixture" }));
  }, []);

  const loadSample = useCallback(async (id: LabSampleId) => {
    setSampleId(id);
    setError(null);
    const meta = SAMPLE_META[id];
    const loaded = await Promise.all(
      meta.imageFiles.map((path) =>
        fetchSampleAsDataUrl(path, path.split("/").pop() ?? path),
      ),
    );
    setImages(loaded);
  }, []);

  useEffect(() => {
    void loadSample("colony-plate");
  }, [loadSample]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const items: ImageItem[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      items.push({ id: `upload-${file.name}-${Date.now()}`, name: file.name, dataUrl });
    }
    setImages(items);
  };

  const mapTraceToPipeline = (ev: TraceEvent) => {
    if (ev.role === "sam_quantifier" || ev.role === "spark_readout") {
      setPipelineStage("extract");
      if (ev.kind === "specialist_done" && ev.role === "spark_readout") {
        setDoneThrough("extract");
        setProgress(35);
      }
    } else if (ev.role === "calc_agent") {
      setPipelineStage("compute");
      if (ev.kind === "specialist_done") {
        setDoneThrough("compute");
        setProgress(55);
      }
    } else if (ev.role === "protocol_check" || ev.role === "verifier" || ev.role === "critic") {
      setPipelineStage("verify");
      if (ev.kind === "specialist_done" && ev.role === "verifier") {
        setDoneThrough("verify");
        setProgress(78);
      }
    } else if (ev.role === "report_writer" || ev.kind === "report") {
      setPipelineStage("report");
      setProgress(92);
    } else if (ev.kind === "done") {
      setDoneThrough("report");
      setProgress(100);
    }
  };

  const runPipeline = async () => {
    if (!images.length) return;
    setError(null);
    setStage("running");
    setReport(null);
    setAgent(null);
    setVerification(null);
    setExtraction(null);
    setTraceEvents([]);
    setDeviations([]);
    setOrchestratorModel(null);
    setPipelineStage("extract");
    setDoneThrough(null);
    setProgress(8);
    setStatusText("Muse Wonder orchestrating specialists…");

    try {
      setStatusText(
        sampleId === "colony-plate"
          ? "Wonder → SAM colony quantifier → CFU/mL…"
          : sampleId === "dilution-error"
            ? "Wonder → protocol check for 10× dilution catch…"
            : "Muse Wonder orchestrating specialists…",
      );
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          sampleId,
          writeReport: true,
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Orchestrate failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotResult = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          const data = JSON.parse(dataLine) as Record<string, unknown>;

          if (eventName === "trace") {
            const ev = data as unknown as TraceEvent;
            setTraceEvents((prev) => [...prev, ev]);
            mapTraceToPipeline(ev);
            setStatusText(ev.title);
            if (ev.kind === "protocol_deviation") {
              const fromPayload = ev.payload as unknown as ProtocolDeviation | undefined;
              setDeviations((prev) => [
                ...prev,
                fromPayload ?? {
                  id: ev.id,
                  code: "PROTOCOL",
                  severity: "error" as const,
                  message: ev.title,
                  expected: {},
                  observed: {},
                },
              ]);
            }
          } else if (eventName === "result") {
            gotResult = true;
            const extractionResult = data.extraction as ExtractionResult;
            const agentResult = data.agent as AgentResult;
            const verificationResult = data.verification as VerificationResult;
            const reportResult = data.report as LabReport | undefined;
            setExtraction(extractionResult);
            setAgent(agentResult);
            setVerification(verificationResult);
            setDeviations((data.deviations as ProtocolDeviation[]) ?? []);
            setOrchestratorModel((data.orchestratorModel as string) ?? "muse-wonder-1.0");
            if (reportResult) {
              setReport(reportResult);
              setDoneThrough("report");
              setProgress(100);
              setStage("done");
              setStatusText(
                ((data.deviations as ProtocolDeviation[])?.length ?? 0) > 0
                  ? "Protocol deviation caught — report ready."
                  : "Report ready.",
              );
            } else {
              setDoneThrough("verify");
              setProgress(78);
              setStage("confirm");
              setStatusText("Confirm flagged cells, then generate the report.");
            }
          } else if (eventName === "error") {
            throw new Error((data.error as string) ?? "Orchestration failed");
          }
        }
      }

      if (!gotResult) {
        throw new Error("Orchestration stream ended without a result");
      }
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const generateReport = async () => {
    if (!extraction || !agent || !verification) return;
    setStage("running");
    setPipelineStage("report");
    setStatusText("Writing Introduction → Conclusion lab report…");
    setProgress(88);
    try {
      const reportRes = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction, agent, verification, sampleId }),
      });
      const reportJson = await reportRes.json();
      if (!reportRes.ok) throw new Error(reportJson.error ?? "Report failed");
      setReport(reportJson.report as LabReport);
      setDoneThrough("report");
      setProgress(100);
      setStage("done");
      setStatusText("Report ready.");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateMeasurement = (id: string, patch: Partial<ExtractionResult["measurements"][number]>) => {
    setExtraction((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        measurements: prev.measurements.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      };
    });
  };

  const confirmMeasurement = (id: string) => {
    updateMeasurement(id, { userConfirmed: true, flagged: false });
  };

  const confirmAll = () => {
    setExtraction((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        measurements: prev.measurements.map((m) =>
          m.flagged || verification?.flags.some((f) => f.measurementId === m.id)
            ? { ...m, userConfirmed: true, flagged: false }
            : m,
        ),
      };
    });
  };

  const download = async (format: "pdf" | "docx" | "md") => {
    if (!report) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, report, agent }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^\w\-]+/g, "_").slice(0, 60)}.${format === "md" ? "md" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleCards = useMemo(
    () =>
      (Object.keys(SAMPLE_META) as LabSampleId[]).map((id) => ({
        id,
        ...SAMPLE_META[id],
        icon:
          id === "beers-law"
            ? FlaskConical
            : id === "titration"
              ? Beaker
              : id === "colony-plate"
                ? CircleDot
                : id === "dilution-error"
                  ? AlertTriangle
                : Scale,
      })),
    [],
  );

  const flaggedLeft =
    extraction?.measurements.filter(
      (m) =>
        (m.flagged || verification?.flags.some((f) => f.measurementId === m.id)) &&
        !m.userConfirmed,
    ).length ?? 0;


  const loaderContext =
    sampleId === "colony-plate"
      ? "extract"
      : sampleId === "dilution-error"
        ? "verify"
        : pipelineStage === "extract"
          ? "extract"
          : pipelineStage === "compute"
            ? "compute"
            : pipelineStage === "verify"
              ? "verify"
              : pipelineStage === "report"
                ? "report"
                : "rotate";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bm-grid-bg opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.2_0.04_125)_0%,_transparent_55%)]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-border/40 px-4 pb-4 pt-6 md:px-6">
        <div className="min-w-0">
          <FigletWordmark size="sm" className="text-accent" />
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Meta Global AI Developer Hackathon · Camron Farjami
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {health?.demoMode && (
            <Badge variant="secondary" data-testid="demo-badge" className="font-mono text-[10px]">
              DEMO_MODE
            </Badge>
          )}
          <Badge variant="outline" className="hidden font-mono text-[10px] sm:inline-flex">
            {health?.provider ?? "…"}/{health?.model ?? "…"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-6">
        <section className="relative mb-14 min-h-[70vh] border border-border/50 bg-[#080809]/80 animate-in fade-in duration-700 md:min-h-[78vh]">
          <div className="pointer-events-none absolute inset-0 bm-noise opacity-40" />
          <div className="relative flex min-h-[70vh] flex-col justify-between gap-10 p-6 md:min-h-[78vh] md:p-12">
            <div className="flex items-start justify-between gap-6">
              <FigletWordmark
                size="lg"
                className="max-w-full animate-in fade-in slide-in-from-bottom-3 duration-700"
              />
              <div className="hidden shrink-0 opacity-80 md:block animate-in fade-in duration-1000">
                <AsciiBio
                  context={sampleId === "colony-plate" ? "extract" : "rotate"}
                  showLabel
                />
              </div>
            </div>

            <div className="max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150">
              <h1 className="text-base leading-relaxed text-foreground/90 md:text-lg">
                SAM 3.1 colony counting + instrument OCR → a verified, formatted lab report.
              </h1>
              <p className="text-sm text-muted-foreground">
                Muse Wonder orchestrates SAM colony counting + Spark readout, catches protocol
                deviations, and writes the record — live agent trace included.
              </p>
              <div className="pt-2">
                <Button
                  size="lg"
                  data-testid="cta-start"
                  className="border border-accent/40 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() =>
                    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  $ start --sample
                </Button>
              </div>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              colony CFU · dilution catch · agent trace · report
            </p>
          </div>
        </section>

        <div id="workspace" className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PipelineProgress active={pipelineStage} doneThrough={doneThrough} />
            {(stage === "running" || progress > 0) && (
              <div className="w-full max-w-xs">
                <Progress value={progress} className="h-1" data-testid="run-progress" />
                <p className="mt-1 text-xs text-muted-foreground">{statusText}</p>
              </div>
            )}
          </div>

          {stage === "running" && (
            <AsciiLoader context={loaderContext as "extract" | "compute" | "verify" | "report" | "rotate"} status={statusText} />
          )}

          {error && (
            <Alert variant="destructive" data-testid="error-alert" role="alert">
              <AlertTitle>Pipeline error</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                <p className="text-xs opacity-90">
                  Tip: set <code>DEMO_MODE=true</code> to run offline fixtures, or check{" "}
                  <code>META_API_KEY</code> / billing if using live Muse.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="retry-pipeline"
                  onClick={() => void runPipeline()}
                >
                  Retry pipeline
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="sr-only" aria-live="polite" data-testid="aria-status">
            {statusText}
          </div>

          {(traceEvents.length > 0 || stage === "running") && (
            <AgentTracePanel
              events={traceEvents}
              running={stage === "running"}
              deviations={deviations}
            />
          )}

          {deviations.length > 0 && (
            <Alert
              variant="destructive"
              data-testid="dilution-wow-alert"
              className="border-destructive/50 bg-destructive/10"
            >
              <AlertTriangle className="size-4" />
              <AlertTitle>
                Wow moment — protocol deviation
                {deviations[0].factor ? ` (${deviations[0].factor}×)` : ""}
              </AlertTitle>
              <AlertDescription className="space-y-1">
                <p>{deviations[0].message}</p>
                {deviations[0].suggestion && (
                  <p className="text-sm opacity-90">{deviations[0].suggestion}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Panel>
            <div className="border-b border-border/50 px-5 py-4">
              <FigletSectionTitle section="photos" />
              <p className="mt-2 text-xs text-muted-foreground">
                Upload photos or load a demo — try Petri Dish — Colony CFU Count or Serial Dilution —
                10× Protocol Catch.
              </p>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {sampleCards.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`sample-${s.id}`}
                      onClick={() => void loadSample(s.id)}
                      className={`border p-4 text-left transition-colors duration-300 hover:border-accent/50 ${
                        sampleId === s.id
                          ? "border-accent/70 bg-accent/5"
                          : "border-border/60 bg-transparent"
                      }`}
                    >
                      <Icon className="mb-2 size-4 text-accent" />
                      <p className="text-sm text-foreground">{s.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    </button>
                  );
                })}
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border/70 px-6 py-10 text-center transition-colors hover:border-accent/40 hover:bg-accent/[0.03]">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  data-testid="file-input"
                  onChange={(e) => void onFiles(e.target.files)}
                />
                <ImagePlus className="size-5 text-accent" />
                <span className="text-sm">Drop photos or click to upload</span>
                <span className="text-xs text-muted-foreground">
                  PNG / JPEG · notebook pages, screens, burettes, plates
                </span>
              </label>

              {images.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2" data-testid="image-preview-grid">
                  {images.map((img) => (
                    <div key={img.id} className="overflow-hidden border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt={img.name} className="h-40 w-full object-cover" />
                      <p className="truncate px-2 py-1 text-xs text-muted-foreground">{img.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  data-testid="run-pipeline"
                  disabled={!images.length || stage === "running"}
                  onClick={() => void runPipeline()}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {stage === "running" && pipelineStage !== "report" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Wonder orchestrating…
                    </>
                  ) : (
                    <>$ run wonder</>
                  )}
                </Button>
                {orchestratorModel && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    orchestrator: {orchestratorModel}
                  </Badge>
                )}
              </div>
            </div>
          </Panel>

          {extraction && (
            <Panel>
              <div className="border-b border-border/50 px-5 py-4">
                <FigletSectionTitle section="vision" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {extraction.experimentTitle} · model {extraction.model} ({extraction.provider})
                </p>
              </div>
              <div className="space-y-4 p-5">
                <p className="text-sm text-muted-foreground">{extraction.summary}</p>
                {images[0] && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        SAM 3.1 / Muse readout regions ({extraction.boundingBoxes.length})
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="toggle-boxes"
                        onClick={() => setShowBoxes((v) => !v)}
                      >
                        {showBoxes ? "Hide overlays" : "Show overlays"}
                      </Button>
                    </div>
                    <BoundingBoxOverlay
                      src={images[0].dataUrl}
                      boxes={showBoxes ? extraction.boundingBoxes : []}
                      alt="Segmented readout regions"
                    />
                  </div>
                )}
                <MeasurementTable measurements={extraction.measurements} />
              </div>
            </Panel>
          )}

          {agent && (
            <Panel>
              <div className="border-b border-border/50 px-5 py-4">
                <FigletSectionTitle section="agent" />
                <p className="mt-2 text-xs text-muted-foreground">{agent.plan}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="space-y-2" data-testid="agent-steps">
                  {agent.steps
                    .filter((s) => s.type === "tool_call")
                    .map((s) => (
                      <div
                        key={s.id}
                        className="border border-border/70 bg-muted/30 px-3 py-2 font-mono text-xs"
                      >
                        <span className="text-accent">→ {s.toolName}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          {JSON.stringify(s.toolInput).slice(0, 120)}
                          …
                        </span>
                      </div>
                    ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2" data-testid="computed-values">
                  {agent.computed.map((c) => (
                    <div key={c.id} className="border border-border/60 px-3 py-3">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="font-mono text-lg text-accent">
                        {Number(c.value).toPrecision(c.significantFigures)}{" "}
                        <span className="text-sm text-muted-foreground">{c.unit}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        tool: <code className="text-foreground/80">{c.citation.toolName}</code>
                      </p>
                    </div>
                  ))}
                </div>
                {agent.chartSeries?.[0] && (
                  <CalibrationChart series={agent.chartSeries[0]} />
                )}
              </div>
            </Panel>
          )}

          {verification && extraction && (
            <Panel testId="verify-panel">
              <div className="border-b border-border/50 px-5 py-4">
                <FigletSectionTitle section="verify" />
                <p className="mt-2 text-xs text-muted-foreground">{verification.summary}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Confidence {(verification.overallConfidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline">{verification.flags.length} flag(s)</Badge>
                  {flaggedLeft > 0 && (
                    <Badge className="bg-accent text-accent-foreground">
                      {flaggedLeft} need confirmation
                    </Badge>
                  )}
                </div>
                <MeasurementTable
                  measurements={extraction.measurements}
                  flags={verification.flags}
                  confirmMode
                  onChange={updateMeasurement}
                  onConfirm={confirmMeasurement}
                />
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" data-testid="confirm-all" onClick={confirmAll}>
                    Confirm all flagged
                  </Button>
                  <Button
                    data-testid="generate-report"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={stage === "running"}
                    onClick={() => void generateReport()}
                  >
                    {stage === "running" && pipelineStage === "report" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Writing report…
                      </>
                    ) : (
                      <>
                        <FileText className="size-4" /> Generate lab report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {report && (
            <Panel testId="report-panel">
              <div className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div>
                  <FigletSectionTitle section="report" />
                  <p className="mt-2 text-xs text-muted-foreground">{report.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="export-md"
                    onClick={() => void download("md")}
                  >
                    <Download className="size-3" /> Markdown
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="export-pdf"
                    onClick={() => void download("pdf")}
                  >
                    <Download className="size-3" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="export-docx"
                    onClick={() => void download("docx")}
                  >
                    <Download className="size-3" /> DOCX
                  </Button>
                </div>
              </div>
              <div className="p-5">
                <article
                  className="border border-border/60 bg-[#070708] p-6"
                  data-testid="report-markdown"
                >
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90">
                    {report.markdown}
                  </pre>
                </article>
              </div>
            </Panel>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        BenchMate · MIT · Meta Global AI Developer Hackathon · Camron Farjami (U-M)
      </footer>
    </div>
  );
}
