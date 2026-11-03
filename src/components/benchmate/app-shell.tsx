"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SAMPLE_META } from "@/lib/demo/fixtures";
import type {
  AgentResult,
  ExtractionResult,
  LabReport,
  LabSampleId,
  VerificationResult,
} from "@/lib/types";
import { PipelineProgress, type PipelineStageId } from "@/components/benchmate/pipeline-progress";
import { BoundingBoxOverlay } from "@/components/benchmate/bounding-box-overlay";
import { MeasurementTable } from "@/components/benchmate/measurement-table";
import { CalibrationChart } from "@/components/benchmate/calibration-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Beaker,
  Download,
  FileText,
  FlaskConical,
  ImagePlus,
  Loader2,
  Scale,
  Sparkles,
} from "lucide-react";

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
  const [sampleId, setSampleId] = useState<LabSampleId>("beers-law");
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
    void loadSample("beers-law");
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

  const runPipeline = async () => {
    if (!images.length) return;
    setError(null);
    setStage("running");
    setReport(null);
    setAgent(null);
    setVerification(null);
    setExtraction(null);

    try {
      setPipelineStage("extract");
      setDoneThrough(null);
      setProgress(12);
      setStatusText("Muse Spark vision: transcribing readouts → structured JSON…");
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          sampleId,
          enableSegmentation: true,
        }),
      });
      const extractJson = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractJson.error ?? "Extract failed");
      let currentExtraction = extractJson.extraction as ExtractionResult;
      setExtraction(currentExtraction);
      setDoneThrough("extract");
      setProgress(35);

      setPipelineStage("compute");
      setStatusText("Tool-using agent: unit conversion, regression, stoichiometry…");
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction: currentExtraction, sampleId }),
      });
      const agentJson = await agentRes.json();
      if (!agentRes.ok) throw new Error(agentJson.error ?? "Agent failed");
      const currentAgent = agentJson.agent as AgentResult;
      setAgent(currentAgent);
      setDoneThrough("compute");
      setProgress(58);

      setPipelineStage("verify");
      setStatusText("Verifier pass: checking values vs images…");
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: currentExtraction,
          images,
          sampleId,
        }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error ?? "Verify failed");
      currentExtraction = verifyJson.extraction as ExtractionResult;
      setExtraction(currentExtraction);
      setVerification(verifyJson.verification as VerificationResult);
      setDoneThrough("verify");
      setProgress(78);
      setStage("confirm");
      setStatusText("Confirm flagged cells, then generate the report.");
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
          id === "beers-law" ? FlaskConical : id === "titration" ? Beaker : Scale,
      })),
    [],
  );

  const flaggedLeft =
    extraction?.measurements.filter(
      (m) =>
        (m.flagged || verification?.flags.some((f) => f.measurementId === m.id)) &&
        !m.userConfirmed,
    ).length ?? 0;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.93_0.03_210)_0%,_oklch(0.97_0.01_200)_45%,_oklch(0.98_0.005_180)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.75 0.03 220 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.75 0.03 220 / 0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-2 pt-6 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-lg shadow-teal-900/20">
            <FlaskConical className="size-5" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-teal-950 md:text-2xl">
              BenchMate
            </p>
            <p className="text-xs text-muted-foreground">
              Meta Global AI Developer Hackathon · Camron Farjami
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {health?.demoMode && (
            <Badge variant="secondary" data-testid="demo-badge">
              DEMO_MODE
            </Badge>
          )}
          <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px]">
            {health?.provider ?? "…"}/{health?.model ?? "…"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-4 md:px-6">
        {/* Hero */}
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-teal-900/10 bg-gradient-to-br from-teal-900 via-slate-800 to-cyan-900 text-white shadow-2xl shadow-teal-950/20">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, oklch(0.7 0.12 175 / 0.5), transparent 40%), radial-gradient(circle at 80% 60%, oklch(0.65 0.1 220 / 0.4), transparent 45%)",
            }}
          />
          <div className="relative grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
            <div className="flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="mb-3 font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                BenchMate
              </p>
              <h1 className="max-w-xl text-lg text-teal-50/90 md:text-xl">
                Photos of handwritten notebooks and instrument readouts → a verified, formatted lab report.
              </h1>
              <p className="mt-3 max-w-lg text-sm text-teal-100/70">
                Vision extraction · deterministic chemistry tools · verifier · report writer. Not a chatbot.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-white text-teal-950 hover:bg-teal-50"
                  data-testid="cta-start"
                  onClick={() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <Sparkles className="size-4" /> Start with a sample lab
                </Button>
              </div>
            </div>
            <div className="relative hidden md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/samples/beers-law-spectrophotometer.png"
                alt="Spectrophotometer readout sample"
                className="h-full max-h-72 w-full rounded-2xl object-cover shadow-xl ring-1 ring-white/20 animate-in fade-in zoom-in-95 duration-1000"
              />
            </div>
          </div>
        </section>

        <div id="workspace" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PipelineProgress active={pipelineStage} doneThrough={doneThrough} />
            {(stage === "running" || progress > 0) && (
              <div className="w-full max-w-xs">
                <Progress value={progress} className="h-2" data-testid="run-progress" />
                <p className="mt-1 text-xs text-muted-foreground">{statusText}</p>
              </div>
            )}
          </div>

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

          {/* Upload / samples */}
          <Card className="border-teal-900/10 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-950">
                <ImagePlus className="size-5 text-teal-700" />
                1. Lab photos
              </CardTitle>
              <CardDescription>
                Upload notebook / instrument photos, or load a built-in demo sample (Beer's law, titration, balance).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {sampleCards.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`sample-${s.id}`}
                      onClick={() => void loadSample(s.id)}
                      className={`rounded-2xl border p-4 text-left transition hover:border-teal-600/50 hover:bg-teal-50/50 ${
                        sampleId === s.id
                          ? "border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20"
                          : "border-border bg-background"
                      }`}
                    >
                      <Icon className="mb-2 size-5 text-teal-700" />
                      <p className="font-medium text-teal-950">{s.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    </button>
                  );
                })}
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-700/30 bg-teal-50/30 px-6 py-8 text-center transition hover:bg-teal-50/60">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  data-testid="file-input"
                  onChange={(e) => void onFiles(e.target.files)}
                />
                <ImagePlus className="size-6 text-teal-700" />
                <span className="text-sm font-medium">Drop photos or click to upload</span>
                <span className="text-xs text-muted-foreground">PNG / JPEG · notebook pages, screens, burettes</span>
              </label>

              {images.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2" data-testid="image-preview-grid">
                  {images.map((img) => (
                    <div key={img.id} className="overflow-hidden rounded-xl border">
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
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {stage === "running" && pipelineStage !== "report" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Running agent…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> Run BenchMate pipeline
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Extraction + boxes */}
          {extraction && (
            <Card className="border-teal-900/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <CardHeader>
                <CardTitle className="text-teal-950">2. Vision extraction</CardTitle>
                <CardDescription>
                  {extraction.experimentTitle} · model {extraction.model} ({extraction.provider})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          )}

          {/* Agent tools */}
          {agent && (
            <Card className="border-teal-900/10 animate-in fade-in duration-500">
              <CardHeader>
                <CardTitle className="text-teal-950">3. Tool-using agent</CardTitle>
                <CardDescription>{agent.plan}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2" data-testid="agent-steps">
                  {agent.steps
                    .filter((s) => s.type === "tool_call")
                    .map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 font-mono text-xs"
                      >
                        <span className="text-teal-800">→ {s.toolName}</span>
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
                    <div key={c.id} className="rounded-xl border bg-white/70 p-3">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="font-mono text-lg text-teal-950">
                        {Number(c.value).toPrecision(c.significantFigures)}{" "}
                        <span className="text-sm text-muted-foreground">{c.unit}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-teal-800">
                        tool: <code>{c.citation.toolName}</code>
                      </p>
                    </div>
                  ))}
                </div>
                {agent.chartSeries?.[0] && (
                  <CalibrationChart series={agent.chartSeries[0]} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Verify / confirm */}
          {verification && extraction && (
            <Card className="border-teal-900/10 animate-in fade-in duration-500" data-testid="verify-panel">
              <CardHeader>
                <CardTitle className="text-teal-950">4. Verifier</CardTitle>
                <CardDescription>{verification.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Confidence {(verification.overallConfidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline">{verification.flags.length} flag(s)</Badge>
                  {flaggedLeft > 0 && (
                    <Badge className="bg-amber-600">{flaggedLeft} need confirmation</Badge>
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
                    className="bg-teal-700 hover:bg-teal-800"
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
              </CardContent>
            </Card>
          )}

          {/* Report */}
          {report && (
            <Card className="border-teal-900/10 animate-in fade-in duration-700" data-testid="report-panel">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-teal-950">5. Lab report</CardTitle>
                  <CardDescription>{report.title}</CardDescription>
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
              </CardHeader>
              <CardContent>
                <article
                  className="prose prose-sm max-w-none rounded-xl border bg-white/80 p-6 font-[family-name:var(--font-body)] prose-headings:font-[family-name:var(--font-display)] prose-headings:text-teal-950"
                  data-testid="report-markdown"
                >
                  <pre className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-sm leading-relaxed text-foreground">
                    {report.markdown}
                  </pre>
                </article>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t border-border/60 bg-white/50 py-6 text-center text-xs text-muted-foreground">
        BenchMate · MIT License · Built for the Meta Global AI Developer Hackathon by Camron Farjami (U-M)
      </footer>
    </div>
  );
}
