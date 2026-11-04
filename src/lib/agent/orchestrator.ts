import { runCalculationAgent } from "@/lib/agent/agent-loop";
import {
  checkProtocolDeviations,
  deviationsToFlags,
} from "@/lib/agent/protocol-check";
import { writeLabReport } from "@/lib/agent/report-writer";
import {
  applyFlagsToMeasurements,
  verifyExtraction,
} from "@/lib/agent/verifier";
import { extractFromImages } from "@/lib/agent/vision";
import {
  getSparkModelId,
  getWonderModelId,
  isDemoMode,
  META_DEFAULTS,
} from "@/lib/config";
import {
  buildDemoReport,
  getDemoAgent,
  getDemoExtraction,
  getDemoVerification,
} from "@/lib/demo/fixtures";
import { chatCompletionJson } from "@/lib/meta-client";
import {
  readSparkReadout,
  runSamQuantifier,
  type SamQuantifierResult,
} from "@/lib/orchestrator-hooks";
import { segmentationToBoundingBox } from "@/lib/sam-client";
import type {
  AgentResult,
  ExtractionResult,
  LabReport,
  LabSampleId,
  OrchestrationResult,
  ProtocolDeviation,
  TraceEvent,
  TraceEventKind,
  VerificationResult,
} from "@/lib/types";

export type TraceEmitter = (event: TraceEvent) => void;

function now() {
  return new Date().toISOString();
}

function makeTrace(
  partial: Omit<TraceEvent, "id" | "timestamp"> & { id?: string },
): TraceEvent {
  const { id: maybeId, ...rest } = partial;
  return {
    ...rest,
    id: maybeId ?? `tr-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: now(),
  };
}

async function emitDelayed(
  onTrace: TraceEmitter | undefined,
  event: TraceEvent,
  ms = 0,
) {
  if (ms > 0) await delay(ms);
  onTrace?.(event);
}

/**
 * Muse Wonder in-product orchestrator.
 * Dispatches SAM quantifier, Spark readout reader, calc agent, verifier/critic;
 * runs deterministic protocol-deviation checks; resolves disagreements; writes report.
 */
export async function runWonderOrchestration(input: {
  images: Array<{ id: string; name: string; dataUrl: string }>;
  sampleId?: LabSampleId;
  writeReport?: boolean;
  onTrace?: TraceEmitter;
}): Promise<OrchestrationResult> {
  const sampleId = input.sampleId ?? "beers-law";
  const writeReport = input.writeReport ?? true;
  const onTrace = input.onTrace;
  const trace: TraceEvent[] = [];
  const push = async (
    kind: TraceEventKind,
    title: string,
    extra?: Partial<TraceEvent>,
    waitMs = 0,
  ) => {
    const ev = makeTrace({
      kind,
      role: extra?.role ?? "orchestrator",
      title,
      detail: extra?.detail,
      model: extra?.model,
      payload: extra?.payload,
      id: extra?.id,
    });
    trace.push(ev);
    await emitDelayed(onTrace, ev, waitMs);
  };

  if (isDemoMode()) {
    return runDemoOrchestration({
      sampleId,
      images: input.images,
      writeReport,
      push,
      trace,
    });
  }

  const wonderModel = getWonderModelId();
  const sparkModel = getSparkModelId();

  const isColony = sampleId === "colony-plate";
  await push(
    "orchestrator_plan",
    "Muse Wonder planning specialist dispatch",
    {
      role: "orchestrator",
      model: wonderModel,
      detail: isColony
        ? "Plan: SAM colony quantifier → CFU math → Spark label OCR → verifier → report"
        : "Plan: SAM quantifier → Spark readout (SAM-crop) → calc → protocol check → verifier → report",
    },
  );

  // Short Wonder plan (frugal tokens)
  let planSummary = isColony
    ? "Dispatch sam_quantifier (colony CFU) → spark_readout (plate label) → calc → verifier → report."
    : "Dispatch SAM → Spark readout → calc → protocol check → verifier → report.";
  try {
    const { data } = await chatCompletionJson<{
      plan: string;
      specialists: string[];
    }>({
      model: wonderModel,
      prefer: "meta",
      max_completion_tokens: 512,
      messages: [
        {
          role: "developer",
          content:
            'You are BenchMate\'s Muse Wonder orchestrator. Return compact JSON: {"plan":string,"specialists":string[]}. Specialists must be subset of sam_quantifier,spark_readout,calc_agent,protocol_check,verifier,report_writer.',
        },
        {
          role: "user",
          content: `Sample=${sampleId}. Images=${input.images.map((i) => i.name).join(", ")}. ${
            isColony
              ? "Hero path: SAM 3.1 colony CFU quantification via runSamQuantifier."
              : "Catch protocol deviations (esp. dilution errors). Use readSparkReadout for instrument OCR."
          }`,
        },
      ],
    });
    planSummary = data.plan || planSummary;
    await push("orchestrator_plan", "Wonder plan ready", {
      role: "orchestrator",
      model: wonderModel,
      detail: planSummary,
      payload: { specialists: data.specialists },
    });
  } catch (err) {
    await push("observation", "Wonder plan skipped — using default dispatch order", {
      role: "orchestrator",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ── SAM quantifier via Core hook (runSamQuantifier) ─────────────────
  await push("dispatch", "Dispatch SAM 3.1 quantifier (Core hook)", {
    role: "sam_quantifier",
    model: META_DEFAULTS.sam,
  });
  await push(
    "specialist_start",
    isColony
      ? "SAM 3.1 segmenting colonies → deterministic CFU/mL"
      : "SAM 3.1 localizing instrument / plate regions",
    { role: "sam_quantifier", model: META_DEFAULTS.sam },
  );

  let quantResult: SamQuantifierResult | null = null;
  let samBoxes: ExtractionResult["boundingBoxes"] = [];
  try {
    if (input.images[0]) {
      quantResult = await runSamQuantifier({
        dataUrl: input.images[0].dataUrl,
        mode: isColony ? "colony" : "auto",
      });
      samBoxes = quantResult.segmentations.map(segmentationToBoundingBox);
    }
    const primarySummary =
      quantResult?.primary.mode === "colony"
        ? `${quantResult.primary.colonyCount} colonies → ${quantResult.primary.cfuPerMl.toExponential(2)} CFU/mL`
        : `${samBoxes.length} region(s)`;
    await push("specialist_done", `SAM quantifier: ${primarySummary}`, {
      role: "sam_quantifier",
      model: META_DEFAULTS.sam,
      payload: {
        count: samBoxes.length,
        mode: quantResult?.primary.mode,
        success: quantResult?.success,
        notes: quantResult?.notes,
      },
    });
  } catch (err) {
    await push("observation", "SAM quantifier unavailable — continuing with Spark path", {
      role: "sam_quantifier",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Spark readout via Core hook (readSparkReadout) ──────────────────
  await push("dispatch", "Dispatch Muse Spark readout reader (Core hook)", {
    role: "spark_readout",
    model: sparkModel,
  });
  await push("specialist_start", "SAM-crop → Spark OCR / structured JSON", {
    role: "spark_readout",
    model: sparkModel,
  });

  let extraction: ExtractionResult;
  if (isColony && quantResult?.primary.mode === "colony") {
    // Colony hero: quantifier owns counts; Spark reads plate-label metadata
    extraction = await extractFromImages({
      images: input.images,
      sampleId,
      enableSegmentation: true,
    });
    try {
      if (input.images[1] || input.images[0]) {
        const labelImg = input.images[1] ?? input.images[0];
        const readout = await readSparkReadout({
          dataUrl: labelImg.dataUrl,
          sampleId,
        });
        if (readout.measurements.length) {
          const byId = new Map(extraction.measurements.map((m) => [m.id, m]));
          for (const m of readout.measurements) {
            if (!byId.has(m.id)) extraction.measurements.push(m);
          }
        }
        await push(
          "observation",
          `Spark readout: ${readout.measurements.length} label measurement(s)`,
          {
            role: "spark_readout",
            model: readout.model,
            detail: readout.notes.join(" · "),
          },
        );
      }
    } catch (err) {
      await push("observation", "Spark readout skipped for colony label", {
        role: "spark_readout",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    // Instrument path: prefer Core readSparkReadout, merge with full extract
    let sparkMeasurements: ExtractionResult["measurements"] = [];
    let sparkBoxes = samBoxes;
    try {
      if (input.images[0]) {
        const readout = await readSparkReadout({
          dataUrl: input.images[0].dataUrl,
          sampleId,
          boxes: samBoxes.length ? samBoxes : undefined,
        });
        sparkMeasurements = readout.measurements;
        sparkBoxes = readout.boundingBoxes.length ? readout.boundingBoxes : samBoxes;
        await push(
          "observation",
          `Spark readout crops: ${readout.crops.length}; measurements: ${readout.measurements.length}`,
          {
            role: "spark_readout",
            model: readout.model,
            detail: readout.notes.join(" · "),
          },
        );
      }
    } catch (err) {
      await push("observation", "readSparkReadout failed — falling back to extractFromImages", {
        role: "spark_readout",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    extraction = await extractFromImages({
      images: input.images,
      sampleId,
      enableSegmentation: true,
    });
    if (sparkBoxes.length) {
      extraction = { ...extraction, boundingBoxes: sparkBoxes };
    }
    if (sparkMeasurements.length) {
      const existing = new Set(extraction.measurements.map((m) => m.id));
      extraction = {
        ...extraction,
        measurements: [
          ...extraction.measurements,
          ...sparkMeasurements.filter((m) => !existing.has(m.id)),
        ],
      };
    }
  }

  await push(
    "specialist_done",
    `Spark path ready — ${extraction.measurements.length} measurements`,
    {
      role: "spark_readout",
      model: extraction.model || sparkModel,
      payload: { measurementCount: extraction.measurements.length },
    },
  );

  // ── Calc agent ──────────────────────────────────────────────────────
  await push("dispatch", "Dispatch calculation agent", {
    role: "calc_agent",
    model: sparkModel,
  });
  await push("specialist_start", "Running deterministic chemistry tools", {
    role: "calc_agent",
    model: sparkModel,
  });
  const agent = await runCalculationAgent({ extraction, sampleId });
  for (const step of agent.steps.filter((s) => s.type === "tool_call")) {
    await push("tool_call", `Tool ${step.toolName}`, {
      role: "calc_agent",
      detail: step.content,
      payload: {
        toolName: step.toolName,
        input: step.toolInput,
        output: step.toolOutput,
      },
    });
  }
  await push("specialist_done", `Calc complete — ${agent.computed.length} computed values`, {
    role: "calc_agent",
    model: agent.model || sparkModel,
  });

  // ── Protocol deviation (deterministic wow) ──────────────────────────
  await push("dispatch", "Dispatch protocol-deviation check", {
    role: "protocol_check",
    model: "deterministic",
  });
  const deviations = checkProtocolDeviations({ extraction, sampleId });
  for (const d of deviations) {
    await push("protocol_deviation", d.message, {
      role: "protocol_check",
      detail: d.suggestion,
      payload: d as unknown as Record<string, unknown>,
    });
  }
  if (!deviations.length) {
    await push("specialist_done", "No protocol deviations detected", {
      role: "protocol_check",
      model: "deterministic",
    });
  }

  // ── Verifier / critic ───────────────────────────────────────────────
  await push("dispatch", "Dispatch verifier / critic", {
    role: "verifier",
    model: sparkModel,
  });
  await push("specialist_start", "Verifier comparing extraction to images", {
    role: "verifier",
    model: sparkModel,
  });
  let verification = await verifyExtraction({
    extraction,
    images: input.images,
    sampleId,
  });
  // Merge deterministic deviation flags
  const devFlags = deviationsToFlags(deviations);
  verification = {
    ...verification,
    flags: [...devFlags, ...verification.flags],
    summary:
      deviations.length > 0
        ? `${deviations[0].message} ${verification.summary}`
        : verification.summary,
  };
  extraction = applyFlagsToMeasurements(extraction, verification);

  // Disagreement resolution via Wonder when verifier contradicts calc / protocol
  const hasDisagreement =
    deviations.length > 0 ||
    verification.flags.some((f) => f.severity === "error");
  if (hasDisagreement) {
    await push("disagreement", "Wonder resolving specialist disagreement", {
      role: "orchestrator",
      model: wonderModel,
      detail: "Protocol check and/or verifier raised errors — Wonder adjudicates.",
    });
    try {
      const { data: resolution } = await chatCompletionJson<{
        verdict: string;
        trust: string[];
        note: string;
      }>({
        model: wonderModel,
        prefer: "meta",
        max_completion_tokens: 768,
        messages: [
          {
            role: "developer",
            content:
              'You adjudicate lab-agent disagreements. Prefer deterministic protocol math over free-form OCR. Return JSON {"verdict","trust":string[],"note"}.',
          },
          {
            role: "user",
            content: JSON.stringify({
              deviations,
              flags: verification.flags,
              computed: agent.computed,
            }),
          },
        ],
      });
      await push("resolution", resolution.verdict || "Trust protocol math", {
        role: "orchestrator",
        model: wonderModel,
        detail: resolution.note,
        payload: resolution as unknown as Record<string, unknown>,
      });
    } catch {
      await push("resolution", "Default resolution: trust deterministic protocol check", {
        role: "orchestrator",
        model: wonderModel,
        detail: "Wonder resolve call failed — keeping protocol_check flags.",
      });
    }
  }

  await push("specialist_done", `Verifier done — ${verification.flags.length} flag(s)`, {
    role: "verifier",
    model: verification.model || sparkModel,
  });

  // ── Report ──────────────────────────────────────────────────────────
  let report: LabReport | undefined;
  if (writeReport) {
    await push("dispatch", "Dispatch report writer", {
      role: "report_writer",
      model: sparkModel,
    });
    report = await writeLabReport({
      extraction,
      agent,
      verification,
      sampleId,
    });
    if (deviations.length) {
      report = annotateReportWithDeviations(report, deviations);
    }
    await push("report", "Lab report written", {
      role: "report_writer",
      model: sparkModel,
      detail: report.title,
    });
  }

  await push("done", "Wonder orchestration complete", {
    role: "orchestrator",
    model: wonderModel,
  });

  return {
    sampleId,
    extraction,
    agent,
    verification,
    report,
    deviations,
    trace,
    orchestratorModel: wonderModel,
    provider: extraction.provider === "demo" ? "demo" : extraction.provider,
  };
}

async function runDemoOrchestration(input: {
  sampleId: LabSampleId;
  images: Array<{ id: string; name: string; dataUrl: string }>;
  writeReport: boolean;
  push: (
    kind: TraceEventKind,
    title: string,
    extra?: Partial<TraceEvent>,
    waitMs?: number,
  ) => Promise<void>;
  trace: TraceEvent[];
}): Promise<OrchestrationResult> {
  const { sampleId, writeReport, push, trace } = input;

  const isColony = sampleId === "colony-plate";
  await push(
    "orchestrator_plan",
    "Muse Wonder (DEMO) planning specialist dispatch",
    {
      role: "orchestrator",
      model: "muse-wonder-1.0",
      detail:
        sampleId === "dilution-error"
          ? "Priority: catch 10× dilution protocol deviation, then verify readouts."
          : isColony
            ? "Hero: runSamQuantifier (42 colonies → 4.2e6 CFU/mL) → readSparkReadout → report."
            : "Plan: runSamQuantifier → readSparkReadout → calc → protocol check → verifier → report",
    },
    280,
  );

  await push(
    "dispatch",
    "Dispatch SAM 3.1 quantifier (Core: runSamQuantifier)",
    { role: "sam_quantifier", model: "sam-3.1" },
    200,
  );
  await push(
    "specialist_start",
    isColony
      ? "SAM 3.1 segmenting colonies (DEMO fixture)"
      : "SAM 3.1 segmenting readout regions (DEMO fixture)",
    { role: "sam_quantifier", model: "sam-3.1" },
    350,
  );

  // Prefer Core hooks even in DEMO (fixtures inside hooks / extract path)
  let extraction = getDemoExtraction(sampleId);
  try {
    if (input.images[0]) {
      const quant = await runSamQuantifier({
        dataUrl: input.images[0].dataUrl,
        mode: isColony ? "colony" : "auto",
      });
      if (isColony && quant.primary.mode === "colony") {
        // Refresh extraction from Core path so CFU matches hook contract
        extraction = await extractFromImages({
          images: input.images,
          sampleId,
          enableSegmentation: true,
        });
      }
      await push(
        "specialist_done",
        quant.primary.mode === "colony"
          ? `SAM quantifier: ${quant.primary.colonyCount} colonies → ${quant.primary.cfuPerMl.toExponential(2)} CFU/mL`
          : `SAM returned ${quant.segmentations.length} region(s)`,
        {
          role: "sam_quantifier",
          model: "sam-3.1",
          payload: {
            count: quant.segmentations.length,
            mode: quant.primary.mode,
            notes: quant.notes,
          },
        },
        200,
      );
    }
  } catch (err) {
    await push(
      "specialist_done",
      `SAM returned ${extraction.boundingBoxes.length} region(s) (fixture fallback)`,
      {
        role: "sam_quantifier",
        model: "sam-3.1",
        detail: err instanceof Error ? err.message : String(err),
        payload: { count: extraction.boundingBoxes.length },
      },
      200,
    );
  }

  extraction = {
    ...extraction,
    sampleId,
    measurements: extraction.measurements.map((m, idx) => ({
      ...m,
      sourceImageId:
        input.images[
          Math.min(idx % Math.max(input.images.length, 1), input.images.length - 1)
        ]?.id ?? m.sourceImageId,
    })),
  };

  await push(
    "dispatch",
    "Dispatch Muse Spark readout reader (Core: readSparkReadout)",
    { role: "spark_readout", model: "muse-spark-1.3" },
    180,
  );
  await push(
    "specialist_start",
    "SAM-crop → Spark OCR (DEMO fixture)",
    { role: "spark_readout", model: "muse-spark-1.3" },
    350,
  );
  try {
    if (input.images[0]) {
      const readout = await readSparkReadout({
        dataUrl: (input.images[1] ?? input.images[0]).dataUrl,
        sampleId,
        boxes: extraction.boundingBoxes,
      });
      await push(
        "observation",
        `Spark readout: ${readout.crops.length} crop(s), ${readout.measurements.length} measurement(s)`,
        {
          role: "spark_readout",
          model: "demo-fixture",
          detail: readout.notes.join(" · "),
        },
        150,
      );
    }
  } catch {
    /* demo fixtures still proceed */
  }
  await push(
    "specialist_done",
    `Spark path ready — ${extraction.measurements.length} measurements`,
    {
      role: "spark_readout",
      model: "demo-fixture",
      payload: { measurementCount: extraction.measurements.length },
    },
    200,
  );

  await push(
    "dispatch",
    "Dispatch calculation agent",
    { role: "calc_agent", model: "muse-spark-1.3" },
    180,
  );
  await push(
    "specialist_start",
    "Running deterministic chemistry tools",
    { role: "calc_agent", model: "muse-spark-1.3" },
    300,
  );

  const agent: AgentResult = getDemoAgent(sampleId);
  for (const step of agent.steps.filter((s) => s.type === "tool_call")) {
    await push(
      "tool_call",
      `Tool ${step.toolName}`,
      {
        role: "calc_agent",
        detail: step.content,
        payload: {
          toolName: step.toolName,
          input: step.toolInput,
          output: step.toolOutput,
        },
      },
      220,
    );
  }
  await push(
    "specialist_done",
    `Calc complete — ${agent.computed.length} computed values`,
    { role: "calc_agent", model: "demo-fixture" },
    150,
  );

  await push(
    "dispatch",
    "Dispatch protocol-deviation check",
    { role: "protocol_check", model: "deterministic" },
    160,
  );
  const deviations = checkProtocolDeviations({ extraction, sampleId });
  for (const d of deviations) {
    await push(
      "protocol_deviation",
      d.message,
      {
        role: "protocol_check",
        detail: d.suggestion,
        payload: d as unknown as Record<string, unknown>,
      },
      400,
    );
  }
  if (!deviations.length) {
    await push(
      "specialist_done",
      "No protocol deviations detected",
      { role: "protocol_check", model: "deterministic" },
      150,
    );
  }

  await push(
    "dispatch",
    "Dispatch verifier / critic",
    { role: "verifier", model: "muse-spark-1.3" },
    160,
  );
  let verification: VerificationResult = getDemoVerification(sampleId);
  const devFlags = deviationsToFlags(deviations);
  verification = {
    ...verification,
    flags: [...devFlags, ...verification.flags],
    summary:
      deviations.length > 0
        ? `${deviations[0].message} ${verification.summary}`
        : verification.summary,
    overallConfidence:
      deviations.length > 0
        ? Math.min(verification.overallConfidence, 0.55)
        : verification.overallConfidence,
  };
  extraction = applyFlagsToMeasurements(extraction, verification);

  if (deviations.length) {
    await push(
      "disagreement",
      "Wonder resolving: protocol math vs notebook volumes",
      {
        role: "orchestrator",
        model: "muse-wonder-1.0",
        detail: "Calc agent used notebook V1; protocol check says volumes imply 10× error.",
      },
      280,
    );
    await push(
      "resolution",
      "Trust deterministic M1V1=M2V2 — flag 10× dilution error for the trainee",
      {
        role: "orchestrator",
        model: "muse-wonder-1.0",
        detail: deviations[0].suggestion,
        payload: { trust: ["protocol_check", "calc_agent"], reject: ["uncritical OCR accept"] },
      },
      320,
    );
  }

  await push(
    "specialist_done",
    `Verifier done — ${verification.flags.length} flag(s)`,
    { role: "verifier", model: "demo-fixture" },
    180,
  );

  let report: LabReport | undefined;
  if (writeReport) {
    await push(
      "dispatch",
      "Dispatch report writer",
      { role: "report_writer", model: "muse-spark-1.3" },
      150,
    );
    await delay(400);
    report = buildDemoReport(sampleId, extraction, agent);
    if (deviations.length) {
      report = annotateReportWithDeviations(report, deviations);
    }
    await push(
      "report",
      "Lab report written",
      { role: "report_writer", model: "demo-fixture", detail: report.title },
      150,
    );
  }

  await push(
    "done",
    "Wonder orchestration complete",
    { role: "orchestrator", model: "muse-wonder-1.0" },
    100,
  );

  void trace;
  return {
    sampleId,
    extraction,
    agent,
    verification,
    report,
    deviations,
    trace: input.trace,
    orchestratorModel: "muse-wonder-1.0",
    provider: "demo",
  };
}

function annotateReportWithDeviations(
  report: LabReport,
  deviations: ProtocolDeviation[],
): LabReport {
  const block = deviations
    .map(
      (d) =>
        `### ⚠ ${d.code}\n${d.message}\n\n**Suggestion:** ${d.suggestion ?? "Review protocol volumes."}`,
    )
    .join("\n\n");
  const sections = {
    ...report.sections,
    errorAnalysis: `${block}\n\n${report.sections.errorAnalysis}`,
  };
  const markdown = report.markdown.includes("## Error Analysis")
    ? report.markdown.replace(
        "## Error Analysis",
        `## Error Analysis\n\n${block}\n`,
      )
    : `${report.markdown}\n\n## Protocol deviations\n\n${block}\n`;
  return { ...report, sections, markdown };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
