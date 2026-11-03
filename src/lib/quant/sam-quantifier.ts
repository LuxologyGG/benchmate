/**
 * SAM Quantifier — orchestrator hook.
 * Meta SAM 3.1 segments colonies (or gel/cells); deterministic code counts & CFU/mL.
 * DEMO_MODE uses fixture segmentations (no API spend).
 */

import { isDemoMode } from "@/lib/config";
import {
  getDemoColonySegmentations,
  getDemoColonyParams,
  getDemoFallbackSegmentations,
} from "@/lib/demo/colony-fixtures";
import {
  quantifyColonies,
  quantifyConfluence,
  quantifyGelBands,
  type ColonyQuantResult,
  type QuantFallbackResult,
  type CfuParams,
} from "@/lib/quant/colony-math";
import {
  segmentSam31Typed,
  type Segmentation,
} from "@/lib/sam-client";

export type SamQuantMode = "colony" | "auto" | "gel-densitometry" | "confluence";

export interface SamQuantifierInput {
  dataUrl: string;
  /** Preferred quantification mode (default auto: colony → gel → confluence) */
  mode?: SamQuantMode;
  cfu?: CfuParams;
  /** Optional SAM text prompt override */
  prompt?: string;
}

export interface SamQuantifierResult {
  success: boolean;
  usedSam: boolean;
  demoMode: boolean;
  primary: ColonyQuantResult | QuantFallbackResult;
  fallbacks?: QuantFallbackResult[];
  segmentations: Segmentation[];
  notes: string[];
}

const COLONY_PROMPTS = [
  "bacterial colony on agar plate",
  "colony forming unit",
  "petri dish colonies",
];

async function liveSegmentColonies(
  dataUrl: string,
  prompt?: string,
): Promise<Segmentation[]> {
  const prompts = prompt ? [prompt] : COLONY_PROMPTS;
  const merged: Segmentation[] = [];
  const seen = new Set<string>();
  for (const p of prompts) {
    try {
      const segs = await segmentSam31Typed({ dataUrl, prompt: p });
      for (const s of segs) {
        const key = s.bbox.map((n) => n.toFixed(3)).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...s, label: s.label || "colony" });
      }
    } catch (err) {
      console.warn(`SAM colony prompt "${p}" failed:`, err);
    }
  }
  return merged;
}

async function liveSegmentFallback(
  dataUrl: string,
  kind: "gel" | "confluence",
): Promise<Segmentation[]> {
  const prompt =
    kind === "gel"
      ? "protein band on western blot gel"
      : "adherent cell monolayer region";
  try {
    return await segmentSam31Typed({ dataUrl, prompt });
  } catch (err) {
    console.warn(`SAM ${kind} fallback failed:`, err);
    return [];
  }
}

/**
 * Public orchestrator entry: SAM quantifier for colony counting (+ fallbacks).
 */
export async function runSamQuantifier(
  input: SamQuantifierInput,
): Promise<SamQuantifierResult> {
  const notes: string[] = [];
  const mode = input.mode ?? "auto";
  const demoMode = isDemoMode();
  let segmentations: Segmentation[] = [];
  let usedSam = false;

  if (demoMode) {
    notes.push("DEMO_MODE: using fixture SAM segmentations (no Meta API call).");
    if (mode === "gel-densitometry") {
      segmentations = getDemoFallbackSegmentations("gel");
      const primary = quantifyGelBands(segmentations);
      return {
        success: primary.bandCount > 0,
        usedSam: false,
        demoMode: true,
        primary,
        segmentations,
        notes,
      };
    }
    if (mode === "confluence") {
      segmentations = getDemoFallbackSegmentations("confluence");
      const primary = quantifyConfluence(segmentations);
      return {
        success: primary.regionCount > 0,
        usedSam: false,
        demoMode: true,
        primary,
        segmentations,
        notes,
      };
    }
    segmentations = getDemoColonySegmentations();
    const params = { ...getDemoColonyParams(), ...input.cfu };
    const primary = quantifyColonies(segmentations, params);
    notes.push(
      `Counted ${primary.colonyCount} colonies → ${primary.cfuPerMl.toExponential(2)} CFU/mL.`,
    );
    return {
      success: primary.colonyCount > 0,
      usedSam: false,
      demoMode: true,
      primary,
      segmentations,
      notes,
    };
  }

  // Live path — SAM 3.1 required
  usedSam = true;
  if (mode === "gel-densitometry") {
    segmentations = await liveSegmentFallback(input.dataUrl, "gel");
    const primary = quantifyGelBands(segmentations);
    return {
      success: primary.bandCount > 0,
      usedSam,
      demoMode: false,
      primary,
      segmentations,
      notes: ["SAM 3.1 gel/Western densitometry path."],
    };
  }
  if (mode === "confluence") {
    segmentations = await liveSegmentFallback(input.dataUrl, "confluence");
    const primary = quantifyConfluence(segmentations);
    return {
      success: primary.regionCount > 0,
      usedSam,
      demoMode: false,
      primary,
      segmentations,
      notes: ["SAM 3.1 cell confluence path."],
    };
  }

  segmentations = await liveSegmentColonies(input.dataUrl, input.prompt);
  let primary: ColonyQuantResult | QuantFallbackResult = quantifyColonies(
    segmentations,
    input.cfu,
  );
  const fallbacks: QuantFallbackResult[] = [];

  if (primary.mode === "colony" && primary.colonyCount === 0) {
    notes.push("Colony path returned 0 colonies — trying gel densitometry fallback.");
    const gelSegs = await liveSegmentFallback(input.dataUrl, "gel");
    const gel = quantifyGelBands(gelSegs.length ? gelSegs : segmentations);
    fallbacks.push(gel);
    if (gel.bandCount > 0) {
      primary = gel;
      segmentations = gelSegs.length ? gelSegs : segmentations;
      notes.push(`Gel densitometry: ${gel.bandCount} band(s).`);
    } else {
      notes.push("Gel path empty — trying cell confluence fallback.");
      const confSegs = await liveSegmentFallback(input.dataUrl, "confluence");
      const conf = quantifyConfluence(confSegs.length ? confSegs : segmentations);
      fallbacks.push(conf);
      primary = conf;
      segmentations = confSegs.length ? confSegs : segmentations;
      notes.push(`Confluence estimate: ${conf.percentConfluence}%.`);
    }
  } else if (primary.mode === "colony") {
    notes.push(
      `SAM 3.1 segmented ${primary.colonyCount} colonies → ${primary.cfuPerMl.toExponential(2)} CFU/mL.`,
    );
  }

  return {
    success:
      (primary.mode === "colony" && primary.colonyCount > 0) ||
      (primary.mode === "gel-densitometry" && primary.bandCount > 0) ||
      (primary.mode === "confluence" && primary.regionCount > 0),
    usedSam,
    demoMode: false,
    primary,
    fallbacks: fallbacks.length ? fallbacks : undefined,
    segmentations,
    notes,
  };
}
