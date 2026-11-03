/**
 * Spark readout reader — orchestrator hook.
 * Pipeline: Meta SAM 3.1 localizes instrument readout → crop → Muse Spark 1.3 OCR/interpret.
 * DEMO_MODE returns fixture readouts (no API spend).
 */

import { isDemoMode } from "@/lib/config";
import { getDemoReadoutCrops } from "@/lib/demo/colony-fixtures";
import { getDemoExtraction } from "@/lib/demo/fixtures";
import { cropDataUrl } from "@/lib/image/crop";
import { chatCompletion, extractJsonObject } from "@/lib/meta-client";
import {
  segmentWithSam31,
  type Segmentation,
  boundingBoxToSegmentation,
} from "@/lib/sam-client";
import type { BoundingBox, ExtractedMeasurement, LabSampleId } from "@/lib/types";

export interface SparkReadoutInput {
  dataUrl: string;
  sampleId?: LabSampleId;
  /** Optional SAM prompt (default: digital display / instrument readout) */
  prompt?: string;
  /** Skip SAM and use provided boxes (e.g. from a prior quantifier call) */
  boxes?: BoundingBox[];
}

export interface SparkReadoutCrop {
  boxId: string;
  label: string;
  bbox: BoundingBox;
  cropDataUrl: string;
}

export interface SparkReadoutResult {
  demoMode: boolean;
  usedSam: boolean;
  crops: SparkReadoutCrop[];
  measurements: ExtractedMeasurement[];
  boundingBoxes: BoundingBox[];
  provider: "meta" | "baseten" | "demo";
  model: string;
  notes: string[];
}

// Short noun phrases — SAM 3.1 matches concrete nouns best
const READOUT_PROMPTS = ["display", "screen", "number", "digit"];

async function samLocalizeReadouts(
  dataUrl: string,
  prompt?: string,
): Promise<BoundingBox[]> {
  const prompts = prompt ? [prompt] : READOUT_PROMPTS;
  const merged: BoundingBox[] = [];
  const seen = new Set<string>();
  for (const p of prompts) {
    try {
      const boxes = await segmentWithSam31({ dataUrl, prompt: p });
      for (const b of boxes) {
        const key = [b.x, b.y, b.width, b.height].map((n) => n.toFixed(3)).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...b, label: b.label || p, id: `${p.replace(/\s+/g, "-")}-${b.id}` });
      }
      if (!prompt && merged.length >= 2) break;
    } catch (err) {
      console.warn(`SAM readout prompt "${p}" failed:`, err);
    }
  }
  return merged;
}

async function sparkInterpretCrops(
  crops: SparkReadoutCrop[],
  sampleId?: LabSampleId,
): Promise<{
  measurements: ExtractedMeasurement[];
  provider: "meta" | "baseten" | "demo";
  model: string;
}> {
  if (!crops.length) {
    return { measurements: [], provider: "meta", model: "muse-spark-1.3" };
  }

  const imageParts = crops.slice(0, 6).map((c) => ({
    type: "image_url" as const,
    image_url: { url: c.cropDataUrl, detail: "high" as const },
  }));

  const result = await chatCompletion({
    messages: [
      {
        role: "developer",
        content: `You are BenchMate Muse Spark readout OCR. Each image is a SAM-cropped instrument region. Transcribe numeric values with units and significant figures. Return ONLY JSON:
{"measurements":[{"id","label","value","unit","significantFigures","kind":"mass"|"volume"|"absorbance"|"concentration"|"temperature"|"wavelength"|"time"|"other","sourceImageId","rawText","confidence","boundingBoxId?"}]}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read these SAM-cropped instrument regions (box ids: ${crops.map((c) => c.boxId).join(", ")}). Sample hint: ${sampleId ?? "unknown"}. Set boundingBoxId to the matching box id.`,
          },
          ...imageParts,
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const parsed = extractJsonObject<{ measurements: ExtractedMeasurement[] }>(
    result.content ?? "{}",
  );
  return {
    measurements: (parsed.measurements ?? []).map((m, i) => ({
      ...m,
      id: m.id || `readout-${i}`,
      sourceImageId: m.sourceImageId || crops[i % crops.length]?.boxId || "crop",
      boundingBoxId: m.boundingBoxId || crops[i % crops.length]?.boxId,
      kind: m.kind || "other",
      significantFigures: m.significantFigures ?? 3,
      confidence: m.confidence ?? 0.85,
      unit: m.unit ?? "",
      rawText: m.rawText ?? String(m.value),
      label: m.label || "readout",
      value: Number(m.value),
    })),
    provider: result.provider === "demo" ? "demo" : result.provider,
    model: result.model,
  };
}

/**
 * Public orchestrator entry: SAM-crop → Muse Spark readout reader.
 */
export async function readSparkReadout(
  input: SparkReadoutInput,
): Promise<SparkReadoutResult> {
  const notes: string[] = [];
  const demoMode = isDemoMode();

  if (demoMode) {
    notes.push("DEMO_MODE: fixture SAM crops + Spark readout (offline).");
    const sampleId = input.sampleId ?? "beers-law";
    const demo = getDemoExtraction(sampleId);
    const crops = getDemoReadoutCrops(sampleId, input.dataUrl, demo.boundingBoxes);
    return {
      demoMode: true,
      usedSam: false,
      crops,
      measurements: demo.measurements.filter((m) => m.boundingBoxId),
      boundingBoxes: demo.boundingBoxes,
      provider: "demo",
      model: "demo-fixture",
      notes,
    };
  }

  let boxes = input.boxes ?? [];
  let usedSam = false;
  if (!boxes.length) {
    boxes = await samLocalizeReadouts(input.dataUrl, input.prompt);
    usedSam = true;
    notes.push(`SAM 3.1 localized ${boxes.length} readout region(s).`);
  } else {
    notes.push(`Using ${boxes.length} provided box(es); SAM localize skipped.`);
  }

  if (!boxes.length) {
    notes.push("No SAM boxes — Spark will see the full frame as a single crop.");
    boxes = [
      {
        id: "full-frame",
        label: "full frame",
        x: 0.05,
        y: 0.05,
        width: 0.9,
        height: 0.9,
        confidence: 0.5,
      },
    ];
  }

  const crops: SparkReadoutCrop[] = [];
  for (const box of boxes.slice(0, 8)) {
    const cropped = await cropDataUrl(input.dataUrl, box);
    crops.push({
      boxId: box.id,
      label: box.label,
      bbox: box,
      cropDataUrl: cropped.dataUrl,
    });
  }
  notes.push(`Cropped ${crops.length} region(s) for Muse Spark OCR.`);

  const interpreted = await sparkInterpretCrops(crops, input.sampleId);
  notes.push(`Spark returned ${interpreted.measurements.length} measurement(s).`);

  return {
    demoMode: false,
    usedSam,
    crops,
    measurements: interpreted.measurements,
    boundingBoxes: boxes,
    provider: interpreted.provider,
    model: interpreted.model,
    notes,
  };
}

/** Helper for callers that want typed SAM segmentations from boxes. */
export function boxesToSegmentations(boxes: BoundingBox[]): Segmentation[] {
  return boxes.map(boundingBoxToSegmentation);
}
