/**
 * DEMO_MODE fixtures for petri-dish colony counting and SAM-crop readout path.
 * Ground truth: 42 colonies, V=0.1 mL, D=1e-4 → CFU/mL = 4.2e6
 */

import type { Segmentation } from "@/lib/sam-client";
import type { BoundingBox, LabSampleId } from "@/lib/types";
import type { CfuParams } from "@/lib/quant/colony-math";

/** Deterministic pseudo-random in [0,1) from index — stable across runs. */
function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 42 colony segmentations laid out inside a circular petri region
 * (center 0.5,0.5 radius ~0.38) matching the generated demo plate image.
 */
export function getDemoColonySegmentations(): Segmentation[] {
  const colonies: Segmentation[] = [];
  const cx = 0.5;
  const cy = 0.48;
  const R = 0.36;
  let i = 0;
  // Spiral / ring placement for visual realism
  const rings = [
    { n: 1, r: 0.02 },
    { n: 6, r: 0.12 },
    { n: 12, r: 0.22 },
    { n: 14, r: 0.3 },
    { n: 9, r: 0.35 },
  ];
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      if (colonies.length >= 42) break;
      const angle = (2 * Math.PI * k) / ring.n + hash01(i) * 0.2;
      const rr = ring.r * (0.92 + hash01(i + 3) * 0.16);
      const x = cx + rr * Math.cos(angle);
      const y = cy + rr * Math.sin(angle);
      const size = 0.012 + hash01(i + 7) * 0.018;
      // Keep inside plate
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) + size > R) {
        i++;
        continue;
      }
      colonies.push({
        id: `colony-${colonies.length}`,
        label: "colony",
        score: 0.82 + hash01(i + 11) * 0.15,
        bbox: [x - size / 2, y - size / 2, size, size * (0.9 + hash01(i + 13) * 0.2)],
      });
      i++;
    }
  }
  // Pad to exactly 42 if spiral skipped some
  while (colonies.length < 42) {
    const t = colonies.length;
    const angle = hash01(t + 50) * 2 * Math.PI;
    const rr = 0.08 + hash01(t + 60) * 0.24;
    const size = 0.014;
    const x = cx + rr * Math.cos(angle) - size / 2;
    const y = cy + rr * Math.sin(angle) - size / 2;
    colonies.push({
      id: `colony-${colonies.length}`,
      label: "colony",
      score: 0.88,
      bbox: [x, y, size, size],
    });
  }
  return colonies.slice(0, 42);
}

export function getDemoColonyParams(): CfuParams {
  return { platedVolumeMl: 0.1, dilutionFactor: 1e-4 };
}

/** Expected CFU/mL for demo plate: 42 / (0.1 * 1e-4) = 4.2e6 */
export const DEMO_COLONY_EXPECTED_CFU = 4.2e6;
export const DEMO_COLONY_COUNT = 42;

export function getDemoFallbackSegmentations(
  kind: "gel" | "confluence",
): Segmentation[] {
  if (kind === "gel") {
    return [
      { id: "band-1", label: "band", score: 0.91, bbox: [0.22, 0.28, 0.55, 0.06] },
      { id: "band-2", label: "band", score: 0.88, bbox: [0.22, 0.4, 0.55, 0.05] },
      { id: "band-3", label: "band", score: 0.85, bbox: [0.22, 0.52, 0.55, 0.045] },
      { id: "band-4", label: "band", score: 0.8, bbox: [0.22, 0.62, 0.55, 0.04] },
    ];
  }
  // Confluence patches covering ~65%
  return [
    { id: "cell-1", label: "cell-region", score: 0.9, bbox: [0.15, 0.2, 0.4, 0.35] },
    { id: "cell-2", label: "cell-region", score: 0.87, bbox: [0.45, 0.25, 0.35, 0.4] },
    { id: "cell-3", label: "cell-region", score: 0.84, bbox: [0.2, 0.55, 0.5, 0.25] },
  ];
}

export function getDemoReadoutCrops(
  sampleId: LabSampleId,
  dataUrl: string,
  boxes: BoundingBox[],
): Array<{
  boxId: string;
  label: string;
  bbox: BoundingBox;
  cropDataUrl: string;
}> {
  void sampleId;
  return boxes.map((box) => ({
    boxId: box.id,
    label: box.label,
    bbox: box,
    // DEMO: reuse full image; live path crops with sharp
    cropDataUrl: dataUrl || "",
  }));
}
