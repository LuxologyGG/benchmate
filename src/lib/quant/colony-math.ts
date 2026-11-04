/**
 * Deterministic colony / plate quantification.
 * SAM (or DEMO fixtures) supplies segmentations; all counts/areas/CFU are computed here — no LLM arithmetic.
 */

import type { Segmentation } from "@/lib/sam-client";

export interface ColonyStats {
  id: string;
  label: string;
  /** Normalized area = width * height of bbox (0–1²) */
  areaNorm: number;
  /** Approximate circular diameter from bbox (normalized) */
  diameterNorm: number;
  score: number;
  bbox: [number, number, number, number];
}

export interface ColonyQuantResult {
  mode: "colony";
  colonyCount: number;
  colonies: ColonyStats[];
  totalAreaNorm: number;
  meanAreaNorm: number;
  /** CFU/mL = count / (platedVolumeMl * dilutionFactor) */
  cfuPerMl: number;
  platedVolumeMl: number;
  dilutionFactor: number;
  formula: string;
}

export interface BandDensitometryResult {
  mode: "gel-densitometry";
  bandCount: number;
  bands: Array<{
    id: string;
    label: string;
    /** Relative intensity proxy from bbox area × score */
    relativeIntensity: number;
    areaNorm: number;
    score: number;
    bbox: [number, number, number, number];
  }>;
  totalIntensity: number;
  normalizedIntensities: number[];
}

export interface ConfluenceResult {
  mode: "confluence";
  /** Estimated % confluence from union of cell/colony segment areas (clamped) */
  percentConfluence: number;
  regionCount: number;
  coveredAreaNorm: number;
  regions: ColonyStats[];
}

export type QuantFallbackResult = BandDensitometryResult | ConfluenceResult;

export interface CfuParams {
  /** Volume plated onto the dish, mL (default 0.1) */
  platedVolumeMl?: number;
  /** Dilution factor as a fraction, e.g. 1e-4 for 10⁻⁴ (default 1e-4) */
  dilutionFactor?: number;
}

const COLONY_LABEL_RE =
  /colon|cfu|spot|dot|bact|fung|mold|plaque|petri|growth/i;

function isColonyLike(seg: Segmentation): boolean {
  if (COLONY_LABEL_RE.test(seg.label)) return true;
  // Small-ish discrete blobs: typical colony bbox footprint
  const [, , w, h] = seg.bbox;
  const area = w * h;
  return area > 0.00005 && area < 0.08 && seg.score >= 0.2;
}

export function segmentationsToColonyStats(segs: Segmentation[]): ColonyStats[] {
  return segs
    .filter(isColonyLike)
    .map((s, i) => {
      const [x, y, w, h] = s.bbox;
      const areaNorm = Math.max(0, w * h);
      return {
        id: s.id || `colony-${i}`,
        label: s.label || "colony",
        areaNorm,
        diameterNorm: Math.sqrt(areaNorm / Math.PI) * 2,
        score: s.score,
        bbox: s.bbox,
      };
    })
    .sort((a, b) => b.areaNorm - a.areaNorm);
}

export function computeCfuPerMl(
  colonyCount: number,
  params: CfuParams = {},
): { cfuPerMl: number; platedVolumeMl: number; dilutionFactor: number; formula: string } {
  const platedVolumeMl = params.platedVolumeMl ?? 0.1;
  const dilutionFactor = params.dilutionFactor ?? 1e-4;
  const denom = platedVolumeMl * dilutionFactor;
  const cfuPerMl = denom > 0 ? colonyCount / denom : 0;
  const formula = `CFU/mL = N / (V × D) = ${colonyCount} / (${platedVolumeMl} mL × ${dilutionFactor})`;
  return { cfuPerMl, platedVolumeMl, dilutionFactor, formula };
}

export function quantifyColonies(
  segs: Segmentation[],
  params: CfuParams = {},
): ColonyQuantResult {
  const colonies = segmentationsToColonyStats(segs);
  const colonyCount = colonies.length;
  const totalAreaNorm = colonies.reduce((a, c) => a + c.areaNorm, 0);
  const meanAreaNorm = colonyCount ? totalAreaNorm / colonyCount : 0;
  const cfu = computeCfuPerMl(colonyCount, params);
  return {
    mode: "colony",
    colonyCount,
    colonies,
    totalAreaNorm,
    meanAreaNorm,
    ...cfu,
  };
}

/** Western / gel band densitometry from SAM / intensity band boxes. */
export function quantifyGelBands(segs: Segmentation[]): BandDensitometryResult {
  // Synthetic ladder bands are often only ~3–6 px tall (h ≈ 0.005–0.01).
  // Accept short-noun SAM labels (bar/stripe/rectangle) and thin horizontals.
  const bandLike = segs.filter((s) => {
    const [, , w, h] = s.bbox;
    if (
      /band|gel|western|lane|blot|bar|stripe|rect|line/i.test(s.label)
    ) {
      return w > 0.02 && h > 0.002 && h < 0.35 && s.score >= 0.15;
    }
    return w > 0.04 && h > 0.003 && h < 0.3 && w / Math.max(h, 1e-6) >= 1.5 && s.score >= 0.2;
  });
  const bands = (bandLike.length ? bandLike : segs).map((s, i) => {
    const areaNorm = Math.max(0, s.bbox[2] * s.bbox[3]);
    return {
      id: s.id || `band-${i}`,
      label: s.label || `band-${i + 1}`,
      relativeIntensity: areaNorm * Math.max(0.1, s.score),
      areaNorm,
      score: s.score,
      bbox: s.bbox,
    };
  });
  const totalIntensity = bands.reduce((a, b) => a + b.relativeIntensity, 0);
  const normalizedIntensities = bands.map((b) =>
    totalIntensity > 0 ? b.relativeIntensity / totalIntensity : 0,
  );
  return {
    mode: "gel-densitometry",
    bandCount: bands.length,
    bands,
    totalIntensity,
    normalizedIntensities,
  };
}

/**
 * Cell confluence estimate: sum of region areas, lightly de-overlapped by
 * treating AABB union roughly via greedy non-max suppression on IoU.
 */
export function quantifyConfluence(segs: Segmentation[]): ConfluenceResult {
  const regions = segmentationsToColonyStats(
    segs.length
      ? segs
      : [],
  );
  // Prefer all segs if colony filter emptied the list (cell sheets look different)
  const stats: ColonyStats[] =
    regions.length > 0
      ? regions
      : segs.map((s, i) => {
          const [x, y, w, h] = s.bbox;
          const areaNorm = Math.max(0, w * h);
          return {
            id: s.id || `region-${i}`,
            label: s.label || "cell-region",
            areaNorm,
            diameterNorm: Math.sqrt(areaNorm / Math.PI) * 2,
            score: s.score,
            bbox: s.bbox,
          };
        });

  const kept = nmsByIou(stats, 0.45);
  const coveredAreaNorm = Math.min(
    1,
    kept.reduce((a, c) => a + c.areaNorm, 0),
  );
  return {
    mode: "confluence",
    percentConfluence: Math.round(coveredAreaNorm * 1000) / 10,
    regionCount: kept.length,
    coveredAreaNorm,
    regions: kept,
  };
}

function iou(a: ColonyStats, b: ColonyStats): number {
  const [ax, ay, aw, ah] = a.bbox;
  const [bx, by, bw, bh] = b.bbox;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

function nmsByIou(items: ColonyStats[], threshold: number): ColonyStats[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: ColonyStats[] = [];
  for (const item of sorted) {
    if (kept.every((k) => iou(k, item) < threshold)) {
      kept.push(item);
    }
  }
  return kept;
}
