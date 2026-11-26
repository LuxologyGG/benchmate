"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clipboard, Download, FlaskConical, ImagePlus, Info, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getFixture, FIXTURES_RECORDED_AT } from "@/lib/courselab/fixtures";
import { PROVIDERS } from "@/lib/courselab/llm";
import { runCourseLab } from "@/lib/courselab/pipeline";
import { buildReport, cfuWithRange } from "@/lib/courselab/report";
import { SAMPLES, type Sample } from "@/lib/courselab/samples";
import type { CourseLabResult, Deviation } from "@/lib/courselab/types";
import { fmt } from "@/lib/courselab/units";

const STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
const KEY_STORE = "benchmate.courselab.groqKey";
const KEY_STORE_G = "benchmate.courselab.geminiKey";

type Status = { live: boolean; vision: boolean; textModel: string | null; visionModel: string | null };

function staticStatus(groq: string, gemini: string): Status {
  return { live: Boolean(groq), vision: Boolean(gemini), textModel: groq ? PROVIDERS.groq.defaultModel : null, visionModel: gemini ? PROVIDERS.gemini.defaultModel : null };
}

function sevColor(s: Deviation["severity"]) {
  return s === "error" ? "text-destructive border-destructive/50" : s === "warning" ? "text-amber-300 border-amber-300/40" : "text-muted-foreground border-border";
}

export function CourseLab() {
  const [sample, setSample] = useState<Sample>(SAMPLES[1]);
  const [manual, setManual] = useState(SAMPLES[1].manual);
  const [notebook, setNotebook] = useState(SAMPLES[1].notebook);
  const [image, setImage] = useState<string | undefined>();
  const [tolerance, setTolerance] = useState(10);
  const [status, setStatus] = useState<Status | null>(null);
  const [byoKey, setByoKey] = useState("");
  const [byoGemini, setByoGemini] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseLabResult | null>(null);
  const [ack, setAck] = useState(false);
  const [showDelta, setShowDelta] = useState(true);
  const [cfu, setCfu] = useState({ colonyCount: 42, platedVolumeMl: 0.1, dilution: 1e-4 });
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (STATIC) {
      const k = sessionStorage.getItem(KEY_STORE) ?? "";
      const g = sessionStorage.getItem(KEY_STORE_G) ?? "";
      // Reading sessionStorage must happen after hydration (static export prerenders without window).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setByoKey(k);
      setByoGemini(g);
      setStatus(staticStatus(k, g));
      return;
    }
    fetch("/api/courselab")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, vision: false, textModel: null, visionModel: null }));
  }, []);

  const unchanged = manual === sample.manual && notebook === sample.notebook && !image;

  const pickSample = (s: Sample) => {
    setSample(s);
    setManual(s.manual);
    setNotebook(s.notebook);
    setImage(undefined);
    setResult(null);
    setError(null);
    setAck(false);
    if (s.cfu) setCfu((c) => ({ ...c, colonyCount: s.cfu!.colonyCount }));
  };

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setAck(false);
    try {
      let r: CourseLabResult;
      if (STATIC) {
        r = await runCourseLab(
          { manual, notebook, notebookImage: image, tolerancePct: tolerance },
          byoKey || byoGemini
            ? {
                llm: {
                  text: byoKey ? { provider: "groq", apiKey: byoKey } : undefined,
                  vision: byoGemini ? { provider: "gemini", apiKey: byoGemini } : undefined,
                },
              }
            : { fixture: unchanged ? getFixture(sample.id) : undefined },
        );
      } else {
        const res = await fetch("/api/courselab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manual, notebook, notebookImage: image, tolerancePct: tolerance, sampleId: unchanged ? sample.id : undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        r = data;
      }
      setResult(r);
      setTimeout(() => resultRef.current?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [manual, notebook, image, tolerance, byoKey, byoGemini, unchanged, sample.id]);

  const errors = result?.deviations.filter((d) => d.severity === "error") ?? [];
  const warnings = result?.deviations.filter((d) => d.severity === "warning") ?? [];
  const infos = result?.deviations.filter((d) => d.severity === "info") ?? [];
  const plated = useMemo(() => result?.steps.flatMap((s) => s.quantities).find((q) => q.role === "plated_volume"), [result]);
  const showCfu = Boolean(sample.cfu || plated);
  const cfuOut = cfuWithRange(cfu);
  const exportBlocked = errors.length > 0 && !ack;

  const reportMd = () =>
    result ? buildReport(result, { title: `BenchMate Course Lab report: ${sample.course}`, cfu: showCfu ? cfu : undefined, acknowledged: ack }) : "";

  const download = () => {
    const blob = new Blob([reportMd()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `benchmate-courselab-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImage = (f?: File) => {
    if (!f) return;
    if (f.size > 4_000_000) {
      setError("Photo is over 4 MB. Please use a smaller image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(f);
  };

  const modeLabel = !status
    ? "checking…"
    : status.live
      ? `LIVE · groq ${status.textModel}${status.vision ? ` + gemini ${status.visionModel}` : ""}`
      : "NO KEY · fixture replay / deterministic";

  const totalTokens = result?.ledger.reduce((a, l) => a + l.promptTokens + l.completionTokens, 0) ?? 0;
  const listUsd = result?.ledger.reduce((a, l) => a + l.listPriceUsd, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">BenchMate · Course Lab</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Catch the 10× mistake before it ruins the run.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Paste your lab-manual steps and what you actually did. A free-tier model only <em>finds</em> the numbers; deterministic tools compare them, compute the
            consequence, and write a record that cites the tool behind every number.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Badge variant="outline" className={status?.live ? "border-primary/60 text-primary" : "text-amber-300"} data-testid="mode-badge">
            {modeLabel}
          </Badge>
          {!STATIC && (
            <a className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" href="/classic">
              Classic BenchMate (Nov 4 build: plate CFU + gel)
            </a>
          )}
        </div>
      </header>

      {showDelta && (
        <section aria-label="What is new in this event" className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-primary">New for the Global AI Builder&apos;s Challenge (Nov 21–28, 2026)</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                <li>Teaching-lab mode: any lab-manual excerpt + your notebook → step-by-step deviation check (this page).</li>
                <li>Free-tier models (Groq, optional Gemini vision) replace the paid Meta stack; live is the default path, with a token ledger.</li>
                <li>Code checks the model: a provenance gate drops any number not literally in your text; a regex recall net adds numbers the model skipped.</li>
                <li>Export is gated on acknowledging flagged deviations. Eval pack and comparison in docs/eval.</li>
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Existing since Nov 4: deterministic dilution/CFU tools, the original 10× catch, the plate-CFU fixture, report export.</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss what's new" onClick={() => setShowDelta(false)}>
              <X />
            </Button>
          </div>
        </section>
      )}

      <section aria-label="Example labs" className="mb-4 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <Button key={s.id} variant={s.id === sample.id ? "default" : "outline"} size="sm" onClick={() => pickSample(s)} aria-pressed={s.id === sample.id} data-testid={`sample-${s.id}`}>
            {s.label}
          </Button>
        ))}
      </section>

      {STATIC && (
        <section className="mb-4 rounded-lg border p-3 text-sm" aria-label="Bring your own key">
          <p className="font-medium">Run live with your own free keys (optional)</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <Label htmlFor="byo" className="text-xs">
                Groq API key (extraction)
              </Label>
              <Input
                id="byo"
                type="password"
                autoComplete="off"
                className="mt-1"
                placeholder="gsk_…"
                value={byoKey}
                onChange={(e) => {
                  setByoKey(e.target.value);
                  sessionStorage.setItem(KEY_STORE, e.target.value);
                  setStatus(staticStatus(e.target.value, byoGemini));
                }}
              />
            </div>
            <div>
              <Label htmlFor="byo-g" className="text-xs">
                Gemini API key (optional, notebook photos)
              </Label>
              <Input
                id="byo-g"
                type="password"
                autoComplete="off"
                className="mt-1"
                placeholder="AIza…"
                value={byoGemini}
                onChange={(e) => {
                  setByoGemini(e.target.value);
                  sessionStorage.setItem(KEY_STORE_G, e.target.value);
                  setStatus(staticStatus(byoKey, e.target.value));
                }}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Keys stay in this browser tab (sessionStorage) and are sent only to api.groq.com / generativelanguage.googleapis.com.</p>
          <p className="mt-1 text-xs text-muted-foreground">Without a key, the built-in examples replay model output recorded from a live run ({FIXTURES_RECORDED_AT.slice(0, 10)}); edited text uses the deterministic parser.</p>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-3">
          <Label htmlFor="manual" className="text-sm font-medium">
            1 · Lab-manual excerpt <span className="text-muted-foreground">({sample.course})</span>
          </Label>
          <Textarea id="manual" className="mt-2 min-h-56 font-mono text-xs" value={manual} onChange={(e) => setManual(e.target.value)} data-testid="manual" />
        </section>
        <section className="rounded-lg border bg-card p-3">
          <Label htmlFor="notebook" className="text-sm font-medium">
            2 · What you actually did (notebook)
          </Label>
          <Textarea id="notebook" className="mt-2 min-h-44 font-mono text-xs" value={notebook} onChange={(e) => setNotebook(e.target.value)} data-testid="notebook" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
              <ImagePlus className="size-3.5" aria-hidden />
              <span>Notebook photo{status?.vision ? " (Gemini transcribes it)" : " (evidence only)"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} data-testid="photo" />
            </label>
            {!image && (
              <Button
                variant="ghost"
                size="xs"
                data-testid="sample-photo"
                onClick={async () => {
                  const base = STATIC ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";
                  const blob = await (await fetch(`${base}/samples/notebook-nacl-10x.jpg`)).blob();
                  const r = new FileReader();
                  r.onload = () => {
                    pickSample(SAMPLES[0]);
                    setNotebook("");
                    setImage(String(r.result));
                  };
                  r.readAsDataURL(blob);
                }}
              >
                Try a handwritten page
              </Button>
            )}
            {image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Uploaded notebook page" className="h-12 rounded border" />
                <Button variant="ghost" size="xs" onClick={() => setImage(undefined)}>
                  Remove photo
                </Button>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={run} disabled={running} data-testid="run">
          {running ? <Loader2 className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
          {running ? "Checking…" : "Check my run"}
        </Button>
        <Label htmlFor="tol" className="text-xs text-muted-foreground">
          Tolerance ±
        </Label>
        <Input id="tol" type="number" min={1} max={100} className="w-20" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value) || 10)} />
        <span className="text-xs text-muted-foreground">%</span>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
          <span>
            <AlertTriangle className="mr-1 inline size-4" aria-hidden />
            {error}
          </span>
          <Button variant="outline" size="sm" onClick={run}>
            <RotateCcw aria-hidden /> Retry
          </Button>
        </div>
      )}

      {result && (
        <div ref={resultRef} tabIndex={-1} className="mt-6 space-y-4 outline-none" data-testid="result">
          {result.mode !== "live" && (
            <p className="rounded-md border border-amber-300/40 p-2 text-xs text-amber-300" data-testid="mode-note">
              {result.mode === "fixture-replay"
                ? "FIXTURE REPLAY: no API key configured, so this replays model output recorded from a real Groq run. The deterministic checks below ran just now."
                : "DETERMINISTIC ONLY: no model was used (no key or the model call failed). Numbers come from the regex parser and tools."}
            </p>
          )}
          {result.warnings.map((w) => (
            <p key={w} className="rounded-md border border-amber-300/40 p-2 text-xs text-amber-300">
              {w}
            </p>
          ))}

          {errors.length > 0 ? (
            <section role="alert" aria-label="Protocol deviation" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4" data-testid="deviation-banner">
              <p className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <AlertTriangle aria-hidden /> Stop: {errors[0].title}
              </p>
              <p className="mt-1 text-sm">{errors[0].message}</p>
              {errors[0].suggestion && <p className="mt-1 text-sm font-medium">Fix: {errors[0].suggestion}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {errors.length} error{errors.length > 1 ? "s" : ""}, {warnings.length} warning{warnings.length === 1 ? "" : "s"} · numbers by <code>{errors[0].tool}</code>
              </p>
            </section>
          ) : (
            <section className="rounded-lg border border-primary/50 bg-primary/5 p-4" data-testid="ok-banner">
              <p className="flex items-center gap-2 text-lg font-semibold text-primary">
                <CheckCircle2 aria-hidden /> No protocol errors found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.comparisons.filter((c) => c.status === "ok").length} protocol values matched your notebook within ±{tolerance}%.{" "}
                {warnings.length ? `${warnings.length} warning(s) below.` : ""}
              </p>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border bg-card p-3 lg:col-span-2" aria-label="Deviations">
              <h2 className="mb-2 text-sm font-medium">Deviations</h2>
              {result.deviations.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              <ul className="space-y-2">
                {[...errors, ...warnings, ...infos].map((d) => (
                  <li key={d.id} className={`rounded-md border p-2 text-sm ${sevColor(d.severity)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase">{d.severity}</span>
                      <span className="font-medium text-foreground">{d.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.message}</p>
                    {d.suggestion && <p className="mt-0.5 text-xs text-foreground">Fix: {d.suggestion}</p>}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">tool: {d.tool}</p>
                  </li>
                ))}
              </ul>

              <h2 className="mb-2 mt-4 text-sm font-medium">Protocol vs notebook</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Step</th>
                      <th className="py-1 pr-2">Quantity</th>
                      <th className="py-1 pr-2">Protocol</th>
                      <th className="py-1 pr-2">Notebook</th>
                      <th className="py-1 pr-2">Ratio</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparisons.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-2">{c.stepN}</td>
                        <td className="py-1 pr-2">{c.name}</td>
                        <td className="py-1 pr-2">{fmt(c.expected.value, c.expected.unit)}</td>
                        <td className="py-1 pr-2">{c.observed ? fmt(c.observed.value, c.observed.unit) : "—"}</td>
                        <td className="py-1 pr-2">{c.ratio === null ? "—" : `${c.ratio.toPrecision(3)}×`}</td>
                        <td className={`py-1 ${c.status === "error" ? "text-destructive" : c.status === "warn" || c.status === "missing" ? "text-amber-300" : "text-primary"}`}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-3" aria-label="Model and tool trace">
              <h2 className="mb-2 text-sm font-medium">Trace</h2>
              <ol className="space-y-1 text-xs" data-testid="trace">
                {result.trace.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{t.t}ms</span>
                    <span className={t.kind === "model" ? "text-primary" : t.kind === "error" ? "text-destructive" : "text-foreground"}>
                      [{t.kind}] {t.label}
                      {t.detail && <span className="block text-muted-foreground">{t.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              <h2 className="mb-1 mt-4 text-sm font-medium">Spend ledger</h2>
              <ul className="space-y-1 text-xs text-muted-foreground" data-testid="ledger">
                {result.ledger.length === 0 && <li>No model calls.</li>}
                {result.ledger.map((l, i) => (
                  <li key={i}>
                    {l.provider} <code>{l.model}</code>: {l.promptTokens}+{l.completionTokens} tok, {l.ms} ms
                  </li>
                ))}
                <li className="pt-1 text-foreground">
                  {totalTokens} tokens · billed $0.00 (free tier) · list-price equivalent ≈ ${listUsd.toFixed(5)}
                </li>
              </ul>
            </section>
          </div>

          {showCfu && (
            <section className="rounded-lg border bg-card p-3" aria-label="Plate count">
              <h2 className="text-sm font-medium">Plate count → CFU/mL</h2>
              {sample.cfu && <p className="text-xs text-muted-foreground">Example count: {sample.cfu.note}</p>}
              <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <Label htmlFor="cc">Colonies counted</Label>
                  <Input id="cc" type="number" className="mt-1 w-28" value={cfu.colonyCount} onChange={(e) => setCfu({ ...cfu, colonyCount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="pv">Plated volume (mL)</Label>
                  <Input id="pv" type="number" step="0.01" className="mt-1 w-28" value={cfu.platedVolumeMl} onChange={(e) => setCfu({ ...cfu, platedVolumeMl: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="dl">Tube dilution (e.g. 1e-4)</Label>
                  <Input id="dl" className="mt-1 w-28" defaultValue="1e-4" onChange={(e) => setCfu({ ...cfu, dilution: Number(e.target.value) })} />
                </div>
                <p className="text-sm" data-testid="cfu">
                  <span className="text-lg font-semibold text-primary">{cfuOut.cfuPerMl.toExponential(2)} CFU/mL</span>
                  <span className="block text-muted-foreground">{cfuOut.formula} · compute_cfu</span>
                  <span className={cfuOut.countable ? "text-muted-foreground" : "text-amber-300"}>{cfuOut.note}</span>
                </p>
              </div>
            </section>
          )}

          {result.notebookTranscript && (
            <section className="rounded-lg border bg-card p-3 text-xs">
              <h2 className="text-sm font-medium">Notebook photo transcript (model output; check it)</h2>
              <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{result.notebookTranscript}</pre>
            </section>
          )}

          <section className="rounded-lg border bg-card p-3" aria-label="Export report">
            <h2 className="text-sm font-medium">3 · Export a tool-cited record</h2>
            {errors.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="ack" />I have read the {errors.length} flagged deviation
                {errors.length > 1 ? "s" : ""} (they will be printed at the top of the report).
              </label>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={download} disabled={exportBlocked} data-testid="export">
                <Download aria-hidden /> Download Markdown
              </Button>
              <Button variant="outline" disabled={exportBlocked} onClick={() => navigator.clipboard.writeText(reportMd())}>
                <Clipboard aria-hidden /> Copy
              </Button>
            </div>
            {exportBlocked && <p className="mt-1 text-xs text-amber-300">Acknowledge the deviations to enable export.</p>}
          </section>
        </div>
      )}

      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        <p>
          <Info className="mr-1 inline size-3.5" aria-hidden />
          Limits: teaching-lab aid, not a medical device. Models can miss or mis-assign values; the provenance gate and regex net reduce but do not eliminate this.
          Photo transcription can misread handwriting. Your TA&apos;s judgement wins. No reagent sourcing or purchasing features.
        </p>
        <p className="mt-1">MIT · Built by Camron Farjami · Free-tier Groq ({PROVIDERS.groq.defaultModel}) + optional Gemini ({PROVIDERS.gemini.defaultModel}).</p>
      </footer>
    </div>
  );
}
