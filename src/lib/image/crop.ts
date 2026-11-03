/**
 * Crop a data-URL image by a normalized [0–1] bounding box.
 * Used to feed SAM-localized readout regions into Muse Spark.
 */

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Expected base64 data URL for crop");
  }
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

/** Expand box slightly so digit edges are not clipped. */
export function padBox(box: NormalizedBox, pad = 0.02): NormalizedBox {
  const x = clamp01(box.x - pad);
  const y = clamp01(box.y - pad);
  const right = clamp01(box.x + box.width + pad);
  const bottom = clamp01(box.y + box.height + pad);
  return {
    x,
    y,
    width: Math.max(0.01, right - x),
    height: Math.max(0.01, bottom - y),
  };
}

/**
 * Crop with sharp when available; falls back to returning the full image
 * if sharp cannot decode (keeps DEMO / edge paths resilient).
 */
export async function cropDataUrl(
  dataUrl: string,
  box: NormalizedBox,
  opts?: { pad?: number },
): Promise<{ dataUrl: string; pixelBox: { left: number; top: number; width: number; height: number } }> {
  const padded = padBox(box, opts?.pad ?? 0.02);
  try {
    const sharp = (await import("sharp")).default;
    const { buffer } = parseDataUrl(dataUrl);
    const image = sharp(buffer);
    const meta = await image.metadata();
    const imgW = meta.width ?? 1;
    const imgH = meta.height ?? 1;
    const left = Math.max(0, Math.floor(padded.x * imgW));
    const top = Math.max(0, Math.floor(padded.y * imgH));
    const width = Math.max(1, Math.min(imgW - left, Math.ceil(padded.width * imgW)));
    const height = Math.max(1, Math.min(imgH - top, Math.ceil(padded.height * imgH)));
    const out = await image
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    return {
      dataUrl: `data:image/png;base64,${out.toString("base64")}`,
      pixelBox: { left, top, width, height },
    };
  } catch (err) {
    console.warn("cropDataUrl fallback (full image):", err instanceof Error ? err.message : err);
    return {
      dataUrl,
      pixelBox: { left: 0, top: 0, width: 0, height: 0 },
    };
  }
}
