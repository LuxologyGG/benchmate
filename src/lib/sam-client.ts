import OpenAI from "openai";
import {
  getMetaApiKey,
  getMetaBaseUrl,
  getRequestTimeoutMs,
  getSamModelId,
  isDemoMode,
} from "@/lib/config";
import type { BoundingBox } from "@/lib/types";

/** Normalized SAM 3.1 segmentation contract used across vision + UI. */
export interface Segmentation {
  id: string;
  label: string;
  score: number;
  /** Normalized [x, y, w, h] in 0–1 image coordinates */
  bbox: [number, number, number, number];
  maskRef?: string;
}

export function segmentationToBoundingBox(seg: Segmentation): BoundingBox {
  const [x, y, w, h] = seg.bbox;
  return {
    id: seg.id,
    label: seg.label,
    x,
    y,
    width: w,
    height: h,
    confidence: seg.score,
  };
}

export function boundingBoxToSegmentation(box: BoundingBox): Segmentation {
  return {
    id: box.id,
    label: box.label,
    score: box.confidence,
    bbox: [box.x, box.y, box.width, box.height],
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeBBox(
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number, number, number] {
  return [clamp01(x), clamp01(y), clamp01(width), clamp01(height)];
}

/**
 * Call Meta SAM 3.1 Segment via Model API (Responses API).
 * Docs: https://dev.meta.ai/docs/overview — model `sam-3.1`
 */
export async function segmentWithSam31(input: {
  dataUrl: string;
  prompt?: string;
}): Promise<BoundingBox[]> {
  const segs = await segmentSam31Typed(input);
  return segs.map(segmentationToBoundingBox);
}

export async function segmentSam31Typed(input: {
  dataUrl: string;
  prompt?: string;
}): Promise<Segmentation[]> {
  if (isDemoMode()) {
    throw new Error("SAM 3.1 live call skipped in DEMO_MODE");
  }

  const apiKey = getMetaApiKey();
  if (!apiKey) {
    throw new Error("META_API_KEY required for SAM 3.1");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: getMetaBaseUrl(),
    timeout: getRequestTimeoutMs(),
    maxRetries: 0,
  });

  const prompt = input.prompt ?? "digital display";

  const response = await client.responses.create({
    model: getSamModelId(),
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: input.dataUrl },
        ],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  return parseSamSegmentations(response, prompt);
}

function parseSamSegmentations(response: unknown, prompt: string): Segmentation[] {
  const out: Segmentation[] = [];
  try {
    const obj = response as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string }>;
      }>;
    };
    const text =
      obj.output_text ??
      obj.output
        ?.flatMap((o) => o.content ?? [])
        .map((c) => c.text)
        .filter(Boolean)
        .join("\n") ??
      "";

    // Prefer JSON if the model returns it; otherwise tolerate empty (caller falls back)
    if (text.includes("{") || text.includes("[")) {
      const startArr = text.indexOf("[");
      const startObj = text.indexOf("{");
      const start =
        startArr >= 0 && (startObj < 0 || startArr < startObj) ? startArr : startObj;
      if (start >= 0) {
        const candidate = text.slice(start);
        const matched = candidate.match(/^[\[{][\s\S]*[\]}]/);
        const parsed = JSON.parse(matched?.[0] ?? candidate) as unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : ((parsed as { boundingBoxes?: unknown[]; boxes?: unknown[]; segmentations?: unknown[] })
              .segmentations ??
            (parsed as { boundingBoxes?: unknown[] }).boundingBoxes ??
            (parsed as { boxes?: unknown[] }).boxes ??
            []);
        for (const [i, item] of (list as Array<Record<string, unknown>>).entries()) {
          out.push(normalizeSeg(item, i, prompt));
        }
      }
    }
  } catch (err) {
    console.warn("SAM 3.1 parse warning:", err instanceof Error ? err.message : err);
  }

  return out
    .filter((s) => s.score >= 0.15 && s.bbox[2] > 0.01 && s.bbox[3] > 0.01)
    .sort((a, b) => b.score - a.score);
}

function normalizeSeg(
  item: Record<string, unknown>,
  index: number,
  prompt: string,
): Segmentation {
  const x = Number(item.x ?? item.xmin ?? item.left ?? 0);
  const y = Number(item.y ?? item.ymin ?? item.top ?? 0);
  let width = Number(item.width ?? item.w ?? 0);
  let height = Number(item.height ?? item.h ?? 0);
  if ((!width || !height) && item.xmax != null && item.ymax != null) {
    width = Number(item.xmax) - x;
    height = Number(item.ymax) - y;
  }
  if (Array.isArray(item.bbox) && item.bbox.length >= 4) {
    const b = item.bbox as number[];
    return {
      id: String(item.id ?? `sam-${index}`),
      label: String(item.label ?? prompt),
      score: Number(item.score ?? item.confidence ?? 0.85),
      bbox: normalizeBBox(b[0], b[1], b[2], b[3]),
      maskRef: item.maskRef ? String(item.maskRef) : undefined,
    };
  }
  return {
    id: String(item.id ?? `sam-${index}`),
    label: String(item.label ?? prompt),
    score: Number(item.confidence ?? item.score ?? 0.85),
    bbox: normalizeBBox(x, y, width, height),
    maskRef: item.maskRef ? String(item.maskRef) : undefined,
  };
}
