import { isDemoMode } from "@/lib/config";
import {
  getDemoExtraction,
  inferSampleIdFromName,
} from "@/lib/demo/fixtures";
import { cropDataUrl } from "@/lib/image/crop";
import { chatCompletion, extractJsonObject } from "@/lib/meta-client";
import { runSamQuantifier } from "@/lib/quant/sam-quantifier";
import { segmentWithSam31 } from "@/lib/sam-client";
import type { ExtractionResult, LabSampleId } from "@/lib/types";

const EXTRACTION_SCHEMA_HINT = `{
  "experimentTitle": string,
  "experimentType": "beers-law" | "titration" | "gravimetric" | "colony-count" | "other",
  "summary": string,
  "measurements": [{
    "id": string,
    "label": string,
    "value": number,
    "unit": string,
    "significantFigures": number,
    "kind": "mass"|"volume"|"absorbance"|"concentration"|"temperature"|"wavelength"|"time"|"colony-count"|"cfu"|"area"|"confluence"|"intensity"|"other",
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
      measurements: demo.measurements.map((m, idx) => ({
        ...m,
        sourceImageId:
          input.images[
            Math.min(idx % Math.max(input.images.length, 1), input.images.length - 1)
          ]?.id ?? m.sourceImageId,
      })),
    };
  }

  // Colony plate hero path: SAM quantifier first
  if (sampleId === "colony-plate") {
    return extractColonyPlate(input.images);
  }

  // Instrument / notebook path: SAM-crop readout regions BEFORE Muse Spark OCR
  const enableSeg = input.enableSegmentation !== false;
  let samBoxes: ExtractionResult["boundingBoxes"] = [];
  const cropParts: Array<{
    type: "image_url";
    image_url: { url: string; detail: "high" };
  }> = [];

  if (enableSeg && input.images[0]) {
    try {
      samBoxes = await segmentReadouts({
        dataUrl: input.images[0].dataUrl,
        sampleId,
      });
      for (const box of samBoxes.slice(0, 6)) {
        const { dataUrl: cropUrl } = await cropDataUrl(input.images[0].dataUrl, box);
        cropParts.push({
          type: "image_url",
          image_url: { url: cropUrl, detail: "high" },
        });
      }
    } catch (err) {
      console.warn("SAM-crop before Spark failed:", err);
    }
  }

  const fullImageParts = input.images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: img.dataUrl, detail: "high" as const },
  }));

  // Prefer cropped readout tiles for OCR; keep one full frame for notebook context
  const imageParts =
    cropParts.length > 0
      ? [...cropParts, fullImageParts[0]].filter(Boolean)
      : fullImageParts;

  const developer = `You are BenchMate vision extraction (Muse Spark). Prefer SAM-cropped instrument tiles for numeric OCR; use full-frame for notebook context. Transcribe into COMPACT structured JSON. Preserve units and significant figures. Bounding boxes normalized 0–1. Keep measurements ≤20 items. Return ONLY valid JSON matching: ${EXTRACTION_SCHEMA_HINT}`;
  const userText = `Extract measurable values. Image ids: ${input.images.map((i) => i.id + "=" + i.name).join(", ")}. Experiment hint: ${sampleId}. ${
    cropParts.length
      ? `First ${cropParts.length} image(s) are SAM 3.1-cropped readout regions — read digits carefully. Last image is full frame.`
      : enableSeg
        ? "Include up to 6 bounding boxes for key readouts."
        : "Omit bounding boxes or keep empty array."
  }`;

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

  const boundingBoxes =
    samBoxes.length > 0 ? samBoxes : (parsed.boundingBoxes ?? []);

  return {
    ...parsed,
    measurements: parsed.measurements ?? [],
    boundingBoxes,
    tables: parsed.tables ?? [],
    experimentTitle: parsed.experimentTitle || "Lab extraction",
    experimentType: parsed.experimentType || "other",
    summary: parsed.summary || "",
    sampleId,
    provider: result.provider === "demo" ? "demo" : result.provider,
    model: result.model,
  };
}

async function extractColonyPlate(
  images: Array<{ id: string; name: string; dataUrl: string }>,
): Promise<ExtractionResult> {
  const primary = images[0];
  if (!primary) {
    throw new Error("colony-plate requires at least one image");
  }

  const quant = await runSamQuantifier({
    dataUrl: primary.dataUrl,
    mode: "auto",
  });

  const boxes = quant.segmentations.map((s) => ({
    id: s.id,
    label: s.label,
    x: s.bbox[0],
    y: s.bbox[1],
    width: s.bbox[2],
    height: s.bbox[3],
    confidence: s.score,
  }));

  if (quant.primary.mode === "colony") {
    const q = quant.primary;
    return {
      sampleId: "colony-plate",
      experimentTitle: "Petri-dish colony counting (CFU)",
      experimentType: "colony-count",
      summary: `SAM 3.1 segmented ${q.colonyCount} colonies. Deterministic CFU/mL = ${q.cfuPerMl.toExponential(2)} (V=${q.platedVolumeMl} mL, D=${q.dilutionFactor}).`,
      provider: quant.demoMode ? "demo" : "meta",
      model: quant.usedSam ? "sam-3.1+deterministic" : "demo-fixture",
      boundingBoxes: boxes,
      tables: [
        {
          id: "colony-summary",
          title: "Colony quantification",
          headers: ["Metric", "Value"],
          rows: [
            ["Colony count", String(q.colonyCount)],
            ["Plated volume (mL)", String(q.platedVolumeMl)],
            ["Dilution factor", String(q.dilutionFactor)],
            ["CFU/mL", q.cfuPerMl.toExponential(3)],
            ["Mean colony area (norm)", q.meanAreaNorm.toExponential(3)],
          ],
        },
      ],
      measurements: [
        {
          id: "c-count",
          label: "Colony count",
          value: q.colonyCount,
          unit: "colonies",
          significantFigures: 2,
          kind: "colony-count",
          sourceImageId: primary.id,
          rawText: String(q.colonyCount),
          confidence: 0.95,
        },
        {
          id: "c-vol",
          label: "Plated volume",
          value: q.platedVolumeMl,
          unit: "mL",
          significantFigures: 1,
          kind: "volume",
          sourceImageId: primary.id,
          rawText: `${q.platedVolumeMl} mL`,
          confidence: 0.99,
        },
        {
          id: "c-dil",
          label: "Dilution factor",
          value: q.dilutionFactor,
          unit: "",
          significantFigures: 1,
          kind: "other",
          sourceImageId: primary.id,
          rawText: String(q.dilutionFactor),
          confidence: 0.99,
        },
        {
          id: "c-cfu",
          label: "CFU/mL",
          value: q.cfuPerMl,
          unit: "CFU/mL",
          significantFigures: 2,
          kind: "cfu",
          sourceImageId: primary.id,
          rawText: q.cfuPerMl.toExponential(2),
          confidence: 0.94,
        },
        {
          id: "c-area",
          label: "Mean colony area (normalized)",
          value: q.meanAreaNorm,
          unit: "norm²",
          significantFigures: 3,
          kind: "area",
          sourceImageId: primary.id,
          rawText: q.meanAreaNorm.toExponential(3),
          confidence: 0.9,
        },
      ],
      quantitation: {
        mode: "colony",
        colonyCount: q.colonyCount,
        cfuPerMl: q.cfuPerMl,
        platedVolumeMl: q.platedVolumeMl,
        dilutionFactor: q.dilutionFactor,
        notes: quant.notes,
      },
    };
  }

  if (quant.primary.mode === "gel-densitometry") {
    const g = quant.primary;
    return {
      sampleId: "colony-plate",
      experimentTitle: "Gel / Western band densitometry (fallback)",
      experimentType: "other",
      summary: `Colony path failed; SAM densitometry found ${g.bandCount} band(s).`,
      provider: quant.demoMode ? "demo" : "meta",
      model: quant.usedSam ? "sam-3.1+deterministic" : "demo-fixture",
      boundingBoxes: boxes,
      tables: [],
      measurements: g.bands.map((b, i) => ({
        id: b.id,
        label: b.label,
        value: g.normalizedIntensities[i] ?? 0,
        unit: "rel",
        significantFigures: 3,
        kind: "intensity" as const,
        sourceImageId: primary.id,
        rawText: String(g.normalizedIntensities[i] ?? 0),
        confidence: b.score,
        boundingBoxId: b.id,
      })),
      quantitation: {
        mode: "gel-densitometry",
        bandCount: g.bandCount,
        notes: quant.notes,
      },
    };
  }

  const c = quant.primary;
  return {
    sampleId: "colony-plate",
    experimentTitle: "Cell confluence estimate (fallback)",
    experimentType: "other",
    summary: `Colony path failed; confluence ≈ ${c.percentConfluence}%.`,
    provider: quant.demoMode ? "demo" : "meta",
    model: quant.usedSam ? "sam-3.1+deterministic" : "demo-fixture",
    boundingBoxes: boxes,
    tables: [],
    measurements: [
      {
        id: "conf-pct",
        label: "Percent confluence",
        value: c.percentConfluence,
        unit: "%",
        significantFigures: 3,
        kind: "confluence",
        sourceImageId: primary.id,
        rawText: `${c.percentConfluence}%`,
        confidence: 0.85,
      },
    ],
    quantitation: {
      mode: "confluence",
      percentConfluence: c.percentConfluence,
      notes: quant.notes,
    },
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
