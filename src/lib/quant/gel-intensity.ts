/**
 * Offline intensity / blob band proposals for gel densitometry.
 * Merged with live SAM boxes so synthetic & real gels stay accurate without
 * faking DEMO_MODE. Port of scripts/lib/colony-cv.mjs countGelBands.
 */

import type { Segmentation } from "@/lib/sam-client";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function parseDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Expected base64 data URL for gel intensity");
  return Buffer.from(match[2], "base64");
}

interface BandBlob {
  x: number;
  y: number;
  area: number;
  bw: number;
  bh: number;
  score: number;
}

function connectedBandComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number,
  maxArea: number,
): BandBlob[] {
  const seen = new Uint8Array(width * height);
  const blobs: BandBlob[] = [];
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i] || seen[i]) continue;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const cur = stack.pop()!;
        const cx = cur % width;
        const cy = (cur / width) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!mask[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (area < minArea || area > maxArea) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      // Gel bands are wide and short
      if (bh > 28 || bw < 12 || bw / Math.max(bh, 1) < 1.8) continue;
      blobs.push({
        x: sumX / area,
        y: sumY / area,
        area,
        bw,
        bh,
        score: clamp(0.55 + area / 800, 0.55, 0.98),
      });
    }
  }
  return blobs;
}

/**
 * Detect bright horizontal gel bands via luminance threshold + connected components.
 * Returns normalized [x,y,w,h] segmentations suitable for quantifyGelBands.
 */
export async function detectGelBandsIntensity(
  dataUrl: string,
): Promise<Segmentation[]> {
  try {
    const sharp = (await import("sharp")).default;
    const buffer = parseDataUrl(dataUrl);
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * channels;
        const lum =
          0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
        if (x < 36 || x > width - 36 || y < 48 || y > height - 48) continue;
        if (lum > 140) mask[y * width + x] = 1;
      }
    }

    const blobs = connectedBandComponents(mask, width, height, 20, 4000);
    const merged: BandBlob[] = [];
    const sorted = [...blobs].sort((a, b) => a.x - b.x || a.y - b.y);
    for (const b of sorted) {
      const near = merged.find(
        (m) =>
          Math.abs(m.x - b.x) < width * 0.08 && Math.abs(m.y - b.y) < 12,
      );
      if (near) {
        near.area += b.area;
        near.y = (near.y + b.y) / 2;
        continue;
      }
      merged.push({ ...b });
    }

    return merged.map((b, idx) => ({
      id: `intensity-band-${idx + 1}`,
      label: "band",
      score: b.score,
      bbox: [
        clamp((b.x - b.bw / 2) / width, 0, 1),
        clamp((b.y - b.bh / 2) / height, 0, 1),
        clamp(b.bw / width, 0.004, 1),
        clamp(Math.max(0.004, b.bh / height), 0.004, 1),
      ] as [number, number, number, number],
    }));
  } catch (err) {
    console.warn(
      "gel intensity detect failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export interface GelLaneBox {
  /** Normalized lane crop in full-image coords */
  x: number;
  y: number;
  width: number;
  height: number;
  laneIndex: number;
}

/**
 * Estimate vertical gel lanes from column-wise bright-pixel density.
 * Falls back to a uniform 4-lane split when signal is weak.
 */
export async function estimateGelLanes(
  dataUrl: string,
  maxLanes = 6,
): Promise<GelLaneBox[]> {
  try {
    const sharp = (await import("sharp")).default;
    const buffer = parseDataUrl(dataUrl);
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const colScore = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      let s = 0;
      for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y++) {
        const p = (y * width + x) * channels;
        const lum =
          0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
        // Mid-dark lane fill (#1c3348-ish) scores higher than deep gel bg
        if (lum > 20 && lum < 90) s += 1;
      }
      colScore[x] = s;
    }

    // Smooth
    const smooth = new Float64Array(width);
    const win = 5;
    for (let x = 0; x < width; x++) {
      let s = 0;
      let n = 0;
      for (let k = -win; k <= win; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        s += colScore[xx];
        n += 1;
      }
      smooth[x] = s / Math.max(1, n);
    }

    const threshold = [...smooth].sort((a, b) => a - b)[
      Math.floor(width * 0.55)
    ];
    const runs: Array<{ x0: number; x1: number; score: number }> = [];
    let start = -1;
    for (let x = 0; x < width; x++) {
      const on = smooth[x] >= threshold && x > width * 0.06 && x < width * 0.94;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push({
          x0: start,
          x1: x - 1,
          score: smooth.slice(start, x).reduce((a, b) => a + b, 0),
        });
        start = -1;
      }
    }
    if (start >= 0) {
      runs.push({
        x0: start,
        x1: width - 1,
        score: smooth.slice(start).reduce((a, b) => a + b, 0),
      });
    }

    const minLaneW = width * 0.08;
    let lanes = runs
      .filter((r) => r.x1 - r.x0 + 1 >= minLaneW)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxLanes)
      .sort((a, b) => a.x0 - b.x0);

    if (lanes.length < 2) {
      const n = 4;
      const margin = 0.08;
      const usable = 1 - margin * 2;
      const laneW = usable / n;
      return Array.from({ length: n }, (_, i) => ({
        x: margin + i * laneW,
        y: 0.08,
        width: laneW,
        height: 0.84,
        laneIndex: i,
      }));
    }

    return lanes.map((r, i) => {
      const pad = Math.max(4, (r.x1 - r.x0) * 0.08);
      const x0 = Math.max(0, r.x0 - pad);
      const x1 = Math.min(width - 1, r.x1 + pad);
      return {
        x: x0 / width,
        y: 0.08,
        width: (x1 - x0) / width,
        height: 0.84,
        laneIndex: i,
      };
    });
  } catch (err) {
    console.warn(
      "gel lane estimate failed:",
      err instanceof Error ? err.message : err,
    );
    const n = 4;
    const margin = 0.08;
    const usable = 1 - margin * 2;
    const laneW = usable / n;
    return Array.from({ length: n }, (_, i) => ({
      x: margin + i * laneW,
      y: 0.08,
      width: laneW,
      height: 0.84,
      laneIndex: i,
    }));
  }
}

/** IoU for axis-aligned normalized boxes [x,y,w,h]. */
export function bboxIou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Merge SAM + intensity band proposals. Prefer higher score; drop near-duplicates
 * by IoU or by same-lane vertical proximity (bands stack, so y-gap matters).
 */
export function mergeBandSegmentations(
  groups: Segmentation[][],
  opts?: { iouThresh?: number; yProximity?: number },
): Segmentation[] {
  const iouThresh = opts?.iouThresh ?? 0.25;
  const yProximity = opts?.yProximity ?? 0.035;
  const flat = groups.flat().map((s, i) => ({
    ...s,
    id: s.id || `band-merge-${i}`,
    label: /band|gel|bar|stripe|rect|line/i.test(s.label) ? "band" : s.label,
  }));
  const sorted = [...flat].sort((a, b) => b.score - a.score);
  const kept: Segmentation[] = [];
  for (const item of sorted) {
    const dup = kept.some((k) => {
      if (bboxIou(k.bbox, item.bbox) >= iouThresh) return true;
      const sameLane =
        Math.abs(k.bbox[0] + k.bbox[2] / 2 - (item.bbox[0] + item.bbox[2] / 2)) <
        0.08;
      const closeY =
        Math.abs(k.bbox[1] + k.bbox[3] / 2 - (item.bbox[1] + item.bbox[3] / 2)) <
        yProximity;
      return sameLane && closeY;
    });
    if (!dup) kept.push(item);
  }
  return kept.sort((a, b) => a.bbox[0] - b.bbox[0] || a.bbox[1] - b.bbox[1]);
}

/** Remap a crop-local bbox into full-image normalized coords. */
export function remapCropBBox(
  local: [number, number, number, number],
  crop: { x: number; y: number; width: number; height: number },
): [number, number, number, number] {
  return [
    clamp(crop.x + local[0] * crop.width, 0, 1),
    clamp(crop.y + local[1] * crop.height, 0, 1),
    clamp(local[2] * crop.width, 0.002, 1),
    clamp(local[3] * crop.height, 0.002, 1),
  ];
}
