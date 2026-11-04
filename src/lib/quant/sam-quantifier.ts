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
import { cropDataUrl } from "@/lib/image/crop";
import {
  quantifyColonies,
  quantifyConfluence,
  quantifyGelBands,
  type ColonyQuantResult,
  type QuantFallbackResult,
  type CfuParams,
} from "@/lib/quant/colony-math";
import {
  detectGelBandsIntensity,
  estimateGelLanes,
  mergeBandSegmentations,
  remapCropBBox,
} from "@/lib/quant/gel-intensity";
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

/**
 * Meta SAM 3.1 matches short concrete noun phrases best.
 * Synthetic / schematic colony plates respond to "dot" / "spot";
 * longer biology phrases often return zero matches.
 */
const COLONY_PROMPTS = ["dot", "spot", "circle"];

/** Short nouns for gel bands — biology phrases ("DNA band") return empty. */
const GEL_PROMPTS = ["bar", "stripe"];

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
        merged.push({ ...s, label: "colony" });
      }
      // Frugal: stop after first prompt that yields a useful colony set
      if (!prompt && merged.length >= 3) break;
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
  // Short noun phrases; longer biology wording often returns empty on SAM 3.1
  const prompts =
    kind === "gel" ? GEL_PROMPTS : ["cell", "region", "blob"];
  const merged: Segmentation[] = [];
  const seen = new Set<string>();
  // Gels: stop once we have a useful SAM set; intensity CV fills the rest.
  const earlyStop = kind === "gel" ? 8 : 3;
  for (const prompt of prompts) {
    try {
      const segs = await segmentSam31Typed({ dataUrl, prompt });
      for (const s of segs) {
        const key = s.bbox.map((n) => n.toFixed(3)).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          ...s,
          label: kind === "gel" ? "band" : s.label || prompt,
        });
      }
      if (merged.length >= earlyStop) break;
    } catch (err) {
      console.warn(`SAM ${kind} prompt "${prompt}" failed:`, err);
    }
  }
  return merged;
}

/**
 * Live gel path: intensity CV + SAM merge. Lane crop→SAM only when intensity
 * is weak (harder/real gels). Always hits SAM at least once so usedSam stays honest.
 */
async function liveSegmentGel(
  dataUrl: string,
  notes: string[],
): Promise<Segmentation[]> {
  const intensitySegs = await detectGelBandsIntensity(dataUrl);
  notes.push(`Intensity profile proposals: ${intensitySegs.length} band(s).`);

  let samFull: Segmentation[] = [];
  let samLane: Segmentation[] = [];

  if (intensitySegs.length >= 12) {
    // Strong intensity signal (typical synthetic ladders): one SAM call for live honesty
    try {
      const segs = await segmentSam31Typed({ dataUrl, prompt: "bar" });
      samFull = segs.map((s) => ({ ...s, label: "band" }));
    } catch (err) {
      console.warn("SAM gel prompt failed:", err);
    }
    notes.push(
      `Full-frame SAM proposals: ${samFull.length} band(s) (frugal 1-call; intensity strong).`,
    );
  } else {
    // Weak intensity — lean on SAM full-frame + lane tiles
    samFull = await liveSegmentFallback(dataUrl, "gel");
    notes.push(`Full-frame SAM proposals: ${samFull.length} band(s).`);
    if (samFull.length < 8) {
      const lanes = await estimateGelLanes(dataUrl);
      notes.push(`Lane tiling: ${lanes.length} lane crop(s) for SAM.`);
      for (const lane of lanes.slice(0, 6)) {
        try {
          const cropped = await cropDataUrl(dataUrl, lane, { pad: 0.01 });
          const segs = await segmentSam31Typed({
            dataUrl: cropped.dataUrl,
            prompt: "bar",
          });
          for (const [i, s] of segs.entries()) {
            samLane.push({
              ...s,
              id: `sam-lane${lane.laneIndex}-${s.id || i}`,
              label: "band",
              bbox: remapCropBBox(s.bbox, lane),
            });
          }
        } catch (err) {
          console.warn(`SAM lane ${lane.laneIndex} failed:`, err);
        }
      }
      notes.push(`Lane-SAM proposals: ${samLane.length} band(s).`);
    }
  }

  // Prefer intensity boxes (score bump). Drop tall SAM blobs (lanes/gel body).
  const intensityPreferred = intensitySegs.map((s) => ({
    ...s,
    score: Math.min(0.99, s.score + 0.05),
  }));
  const thinSam = (s: Segmentation) => {
    const [, , w, h] = s.bbox;
    return h < 0.12 && w > 0.03 && w / Math.max(h, 1e-6) >= 1.4;
  };
  const merged = mergeBandSegmentations([
    intensityPreferred,
    samFull.filter(thinSam),
    samLane.filter(thinSam),
  ]);
  notes.push(
    `Merged gel bands (SAM ∪ intensity): ${merged.length} after NMS.`,
  );
  return merged;
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
    segmentations = await liveSegmentGel(input.dataUrl, notes);
    const primary = quantifyGelBands(segmentations);
    notes.push("SAM 3.1 gel densitometry + intensity merge.");
    return {
      success: primary.bandCount > 0,
      usedSam,
      demoMode: false,
      primary,
      segmentations,
      notes,
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
    const gelSegs = await liveSegmentGel(input.dataUrl, notes);
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
