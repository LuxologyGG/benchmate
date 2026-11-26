/** BenchMate Course Lab — shared types (isomorphic: server route + browser). */

export type Dimension = "volume" | "mass" | "time" | "temperature" | "concentration" | "count" | "unknown";

export type QuantityRole =
  | "stock_concentration"
  | "transfer_volume"
  | "final_volume"
  | "target_concentration"
  | "plated_volume"
  | "dilution_factor"
  | "mass"
  | "time"
  | "temperature"
  | "volume"
  | "other";

export interface Quantity {
  name: string;
  value: number;
  unit: string;
  role?: QuantityRole;
  /** Exact snippet the value was read from (used for the provenance check). */
  quote?: string;
}

export interface ProtocolStep {
  n: number;
  text: string;
  quantities: Quantity[];
}

export interface ActualEntry {
  /** "model" = located by the LLM; "regex" = deterministic parser (merged in when the model missed it). */
  source?: "model" | "regex";
  stepN?: number;
  name: string;
  value: number;
  unit: string;
  role?: QuantityRole;
  quote?: string;
}

export type DeviationCode =
  | "TEN_X_ERROR"
  | "OUT_OF_TOLERANCE"
  | "DILUTION_TARGET_MISSED"
  | "MISSING_VALUE"
  | "UNIT_MISMATCH"
  | "UNVERIFIED_EXTRACTION"
  | "OFF_PROTOCOL_STEP";

export interface Deviation {
  id: string;
  code: DeviationCode;
  severity: "error" | "warning" | "info";
  stepN?: number;
  title: string;
  message: string;
  expected?: string;
  observed?: string;
  factor?: number;
  suggestion?: string;
  /** Deterministic tool that produced every number in this deviation. */
  tool: string;
}

export interface Comparison {
  stepN: number;
  name: string;
  expected: { value: number; unit: string };
  observed?: { value: number; unit: string };
  /** observed / expected in base units (null if missing or incompatible). */
  ratio: number | null;
  status: "ok" | "warn" | "error" | "missing";
  tool: string;
}

export interface TraceEvent {
  t: number; // ms since run start
  kind: "model" | "tool" | "check" | "info" | "error";
  label: string;
  detail?: string;
}

export interface LedgerEntry {
  provider: "groq" | "gemini" | "mistral" | "fixture";
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  ms: number;
  /** List-price equivalent in USD (free tier is billed $0). */
  listPriceUsd: number;
}

export interface CourseLabInput {
  manual: string;
  notebook: string;
  /** Optional data URL of a notebook page photo (Gemini transcribes it). */
  notebookImage?: string;
  tolerancePct?: number;
}

export interface CourseLabResult {
  mode: "live" | "fixture-replay" | "deterministic-fallback";
  steps: ProtocolStep[];
  actuals: ActualEntry[];
  comparisons: Comparison[];
  deviations: Deviation[];
  trace: TraceEvent[];
  ledger: LedgerEntry[];
  notebookTranscript?: string;
  warnings: string[];
  startedAt: string;
}
