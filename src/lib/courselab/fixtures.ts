import data from "./fixtures.json";
import { coerceExtraction, type RunOptions } from "./pipeline";
import type { LedgerEntry } from "./types";

type Rec = { raw: unknown; ledger: LedgerEntry[] };

export const FIXTURES_RECORDED_AT: string = (data as { recordedAt: string }).recordedAt;

/** Recorded live model output for a built-in sample (fixture replay when no key is configured). */
export function getFixture(sampleId?: string): RunOptions["fixture"] | undefined {
  if (!sampleId) return undefined;
  const rec = (data as unknown as Record<string, Rec>)[sampleId];
  if (!rec || typeof rec !== "object" || !("raw" in rec)) return undefined;
  return { extraction: coerceExtraction(JSON.parse(JSON.stringify(rec.raw))), ledger: rec.ledger };
}
