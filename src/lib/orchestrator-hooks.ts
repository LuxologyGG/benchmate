/**
 * Clean hooks for Workstream B (Wonder orchestrator) to call Core (Workstream A).
 *
 * - `runSamQuantifier` — SAM 3.1 segments colonies; deterministic CFU/area (fallback: gel / confluence)
 * - `readSparkReadout` — SAM-crop instrument regions, then Muse Spark 1.3 OCR/interpret
 */

export {
  runSamQuantifier,
  type SamQuantifierInput,
  type SamQuantifierResult,
  type SamQuantMode,
} from "@/lib/quant/sam-quantifier";

export {
  readSparkReadout,
  boxesToSegmentations,
  type SparkReadoutInput,
  type SparkReadoutResult,
  type SparkReadoutCrop,
} from "@/lib/agent/spark-readout";

export {
  quantifyColonies,
  quantifyGelBands,
  quantifyConfluence,
  computeCfuPerMl,
  type ColonyQuantResult,
  type QuantFallbackResult,
  type CfuParams,
} from "@/lib/quant/colony-math";
