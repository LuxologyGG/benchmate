export type LabSampleId = "beers-law" | "titration" | "balance";

export type MeasurementKind =
  | "mass"
  | "volume"
  | "absorbance"
  | "concentration"
  | "temperature"
  | "wavelength"
  | "time"
  | "other";

export interface BoundingBox {
  id: string;
  label: string;
  x: number; // 0–1 normalized
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface ExtractedMeasurement {
  id: string;
  label: string;
  value: number;
  unit: string;
  significantFigures: number;
  kind: MeasurementKind;
  sourceImageId: string;
  rawText: string;
  confidence: number;
  boundingBoxId?: string;
  notes?: string;
  flagged?: boolean;
  flagReason?: string;
  userConfirmed?: boolean;
  userEdited?: boolean;
}

export interface ExtractionResult {
  sampleId?: LabSampleId;
  experimentTitle: string;
  experimentType: "beers-law" | "titration" | "gravimetric" | "other";
  summary: string;
  measurements: ExtractedMeasurement[];
  boundingBoxes: BoundingBox[];
  tables: Array<{
    id: string;
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  provider: "meta" | "baseten" | "demo";
  model: string;
}

export interface ToolCitation {
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  usedFor: string;
}

export interface ComputedValue {
  id: string;
  label: string;
  value: number;
  unit: string;
  significantFigures: number;
  formula?: string;
  citation: ToolCitation;
}

export interface AgentStep {
  id: string;
  type: "plan" | "tool_call" | "observation" | "final";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentResult {
  plan: string;
  steps: AgentStep[];
  computed: ComputedValue[];
  chartSeries?: Array<{
    id: string;
    label: string;
    points: Array<{ x: number; y: number; label?: string }>;
    fit?: { slope: number; intercept: number; rSquared: number; equation: string };
  }>;
  provider: "meta" | "baseten" | "demo";
  model: string;
}

export type FlagSeverity = "error" | "warning" | "info";

export interface VerificationFlag {
  id: string;
  measurementId: string;
  severity: FlagSeverity;
  code: string;
  message: string;
  suggestion?: string;
}

export interface VerificationResult {
  flags: VerificationFlag[];
  overallConfidence: number;
  summary: string;
  provider: "meta" | "baseten" | "demo";
  model: string;
}

export interface LabReport {
  title: string;
  markdown: string;
  sections: {
    introduction: string;
    methods: string;
    data: string;
    calculations: string;
    results: string;
    errorAnalysis: string;
    conclusion: string;
  };
  citations: ToolCitation[];
}

export interface PipelineState {
  images: Array<{ id: string; name: string; dataUrl: string }>;
  sampleId?: LabSampleId;
  extraction?: ExtractionResult;
  agent?: AgentResult;
  verification?: VerificationResult;
  report?: LabReport;
  stage:
    | "upload"
    | "extracting"
    | "review"
    | "computing"
    | "verifying"
    | "confirm"
    | "writing"
    | "done"
    | "error";
  error?: string;
}

export interface ChatMessage {
  role: "developer" | "system" | "user" | "assistant" | "tool";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      >;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}
