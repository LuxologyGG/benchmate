import { isDemoMode } from "@/lib/config";
import {
  getDemoExtraction,
  inferSampleIdFromName,
} from "@/lib/demo/fixtures";
import { chatCompletion, extractJsonObject } from "@/lib/meta-client";
import type { ExtractionResult, LabSampleId } from "@/lib/types";

const EXTRACTION_SCHEMA_HINT = `{
  "experimentTitle": string,
  "experimentType": "beers-law" | "titration" | "gravimetric" | "other",
  "summary": string,
  "measurements": [{
    "id": string,
    "label": string,
    "value": number,
    "unit": string,
    "significantFigures": number,
    "kind": "mass"|"volume"|"absorbance"|"concentration"|"temperature"|"wavelength"|"time"|"other",
    "sourceImageId": string,
    "rawText": string,
    "confidence": number,
    "boundingBoxId"?: string,
    "notes"?: string
  }],
  "boundingBoxes": [{
    "id": string,
    "label": string,
    "x": number, "y": number, "width": number, "height": number,
    "confidence": number
  }],
  "tables": [{ "id": string, "title": string, "headers": string[], "rows": string[][] }]
}`;

export async function extractFromImages(input: {
  images: Array<{ id: string; name: string; dataUrl: string }>;
  sampleId?: LabSampleId;
  enableSegmentation?: boolean;
}): Promise<ExtractionResult> {
  const sampleId =
    input.sampleId ??
    inferSampleIdFromName(input.images.map((i) => i.name).join(" "));

  if (isDemoMode()) {
    await delay(600);
    const demo = getDemoExtraction(sampleId);
    return {
      ...demo,
      sampleId,
      // Remap source image ids to uploaded ids when possible
      measurements: demo.measurements.map((m, idx) => ({
        ...m,
        sourceImageId: input.images[Math.min(idx % Math.max(input.images.length, 1), input.images.length - 1)]?.id ?? m.sourceImageId,
      })),
    };
  }

  const imageParts = input.images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: img.dataUrl, detail: "high" as const },
  }));

  const developer = `You are BenchMate vision extraction. Transcribe lab notebook handwriting and instrument readouts into COMPACT structured JSON. Preserve units and significant figures. Bounding boxes normalized 0–1. Keep measurements ≤20 items. Return ONLY valid JSON matching: ${EXTRACTION_SCHEMA_HINT}`;
  const userText = `Extract measurable values from these lab images (ids: ${input.images.map((i) => i.id + "=" + i.name).join(", ")}). Experiment hint: ${sampleId}. ${input.enableSegmentation ? "Include up to 6 bounding boxes for key readouts." : "Omit bounding boxes or keep empty array."}`;

  let result = await chatCompletion({
    messages: [
      { role: "developer", content: developer },
      {
        role: "user",
        content: [{ type: "text", text: userText }, ...imageParts],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  let parsed: Omit<ExtractionResult, "provider" | "model">;
  try {
    parsed = extractJsonObject(result.content ?? "{}");
  } catch (err) {
    // One repair pass — models sometimes emit truncated JSON on multi-image prompts
    result = await chatCompletion({
      messages: [
        {
          role: "developer",
          content:
            "Repair into ONE compact valid JSON object for a lab extraction. No markdown. Include experimentTitle, experimentType, summary, measurements[], boundingBoxes[], tables[].",
        },
        {
          role: "user",
          content: `Fix this extraction JSON (may be truncated). Sample: ${sampleId}.\n\n${(result.content || "").slice(0, 6000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });
    parsed = extractJsonObject(result.content ?? "{}");
    void err;
  }

  return {
    ...parsed,
    measurements: parsed.measurements ?? [],
    boundingBoxes: parsed.boundingBoxes ?? [],
    tables: parsed.tables ?? [],
    experimentTitle: parsed.experimentTitle || "Lab extraction",
    experimentType: parsed.experimentType || "other",
    summary: parsed.summary || "",
    sampleId,
    provider: result.provider === "demo" ? "demo" : result.provider,
    model: result.model,
  };
}

/**
 * Segment readout regions with Meta SAM 3.1 (Responses API, model `sam-3.1`).
 * Falls back to Muse Spark vision boxes if SAM is unavailable or returns none.
 * DEMO_MODE returns fixture boxes.
 */
export async function segmentReadouts(input: {
  dataUrl: string;
  sampleId?: LabSampleId;
}): Promise<ExtractionResult["boundingBoxes"]> {
  if (isDemoMode()) {
    await delay(300);
    return getDemoExtraction(input.sampleId ?? "beers-law").boundingBoxes;
  }

  try {
    const { segmentWithSam31 } = await import("@/lib/sam-client");
    const prompts = [
      "digital display",
      "handwritten data table",
      "burette meniscus",
    ];
    const merged: ExtractionResult["boundingBoxes"] = [];
    for (const prompt of prompts) {
      try {
        const boxes = await segmentWithSam31({
          dataUrl: input.dataUrl,
          prompt,
        });
        for (const b of boxes) {
          merged.push({ ...b, label: b.label || prompt, id: `${prompt}-${b.id}` });
        }
      } catch (err) {
        console.warn(`SAM 3.1 prompt "${prompt}" failed:`, err);
      }
    }
    if (merged.length) return merged;
  } catch (err) {
    console.warn("SAM 3.1 unavailable, falling back to Muse vision boxes:", err);
  }

  const result = await chatCompletion({
    messages: [
      {
        role: "developer",
        content:
          'Locate instrument readout and table regions. Return JSON {"boundingBoxes":[{"id","label","x","y","width","height","confidence"}]} with normalized 0-1 coords for: digital display, burette meniscus, handwritten table.',
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Segment readout regions." },
          { type: "image_url", image_url: { url: input.dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = extractJsonObject<{ boundingBoxes: ExtractionResult["boundingBoxes"] }>(
    result.content ?? "{}",
  );
  return parsed.boundingBoxes ?? [];
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
