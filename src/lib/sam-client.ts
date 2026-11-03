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
 * Docs: https://dev.meta.ai/docs/sam/overview — model `sam-3.1`
 *
 * Output is special-token grammar (not JSON):
 *   <0f>0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;...|>,1<|box;...|>...
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
    // one_bit keeps masks small; include_confidence adds `c=` on boxes
    metadata: {
      mask_encoding: "one_bit",
      include_confidence: "true",
    },
  } as Parameters<typeof client.responses.create>[0]);

  return parseSamSegmentations(response, prompt);
}

/** Extract output_text from a Responses API payload (OpenAI SDK or raw fetch). */
export function extractSamOutputText(response: unknown): string {
  const obj = response as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof obj.output_text === "string" && obj.output_text.length) {
    return obj.output_text;
  }
  const parts: string[] = [];
  for (const item of obj.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && typeof c.text === "string") {
        parts.push(c.text);
      } else if (typeof c.text === "string" && c.text.includes("<|box;")) {
        parts.push(c.text);
      }
    }
  }
  return parts.join("\n");
}

/**
 * Parse Meta SAM 3.1 special-token box grammar into normalized segmentations.
 * Pixel boxes are converted to 0–1 using the `w`/`h` source dimensions on each record.
 */
export function parseSamSpecialTokenText(
  text: string,
  prompt: string,
): Segmentation[] {
  const out: Segmentation[] = [];
  if (!text || !text.includes("<|box;")) return out;

  // Match object-id + box token. Mask payloads are ignored for colony counting.
  const recordRe =
    /(\d+)\s*<\|box;([^|>]+)\|>/g;
  let match: RegExpExecArray | null;
  while ((match = recordRe.exec(text)) !== null) {
    const objectId = match[1];
    const fields = parseSamFieldList(match[2]);
    const x1 = Number(fields.x1);
    const y1 = Number(fields.y1);
    const x2 = Number(fields.x2);
    const y2 = Number(fields.y2);
    const srcW = Number(fields.w) || 0;
    const srcH = Number(fields.h) || 0;
    if (!(srcW > 0 && srcH > 0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
      continue;
    }
    const widthPx = Math.max(0, x2 - x1);
    const heightPx = Math.max(0, y2 - y1);
    const score = fields.c != null ? Number(fields.c) : 0.85;
    out.push({
      id: `sam-${objectId}`,
      label: prompt,
      score: Number.isFinite(score) ? score : 0.85,
      bbox: normalizeBBox(x1 / srcW, y1 / srcH, widthPx / srcW, heightPx / srcH),
      maskRef: `sam-mask-${objectId}`,
    });
  }
  return out;
}

function parseSamFieldList(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

export function parseSamSegmentations(
  response: unknown,
  prompt: string,
): Segmentation[] {
  const out: Segmentation[] = [];
  try {
    const text = extractSamOutputText(response);

    // Primary: Meta SAM special-token grammar
    if (text.includes("<|box;")) {
      out.push(...parseSamSpecialTokenText(text, prompt));
    } else if (text.includes("{") || text.includes("[")) {
      // Legacy / fallback JSON shape (should not appear for sam-3.1)
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
    // Colonies can be ~8–20 px on a 960 plate (~0.008–0.02 normalized)
    .filter((s) => s.score >= 0.15 && s.bbox[2] > 0.004 && s.bbox[3] > 0.004)
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
