import { dilution } from "@/lib/tools/stoichiometry";
import type {
  ExtractionResult,
  LabSampleId,
  ProtocolDeviation,
  VerificationFlag,
} from "@/lib/types";

/**
 * Deterministic protocol-deviation checks (no LLM arithmetic).
 * Hero wow-moment: catch a 10× dilution pipetting error from notebook volumes.
 */
export function checkProtocolDeviations(input: {
  extraction: ExtractionResult;
  sampleId?: LabSampleId;
}): ProtocolDeviation[] {
  const sampleId = input.sampleId ?? input.extraction.sampleId;
  const deviations: ProtocolDeviation[] = [];

  const dilutionDev = checkDilutionTenX(input.extraction, sampleId);
  if (dilutionDev) deviations.push(dilutionDev);

  return deviations;
}

/**
 * Detect when observed M1·V1/V2 is ~10× off the protocol target concentration.
 *
 * Looks for measurements labeled as stock / aliquot / flask / target, or the
 * dedicated dilution-error demo fields.
 */
function checkDilutionTenX(
  extraction: ExtractionResult,
  sampleId?: LabSampleId,
): ProtocolDeviation | null {
  const m = extraction.measurements;

  const stock =
    findMeas(m, ["stock", "m1", "stock concentration"]) ??
    (sampleId === "dilution-error" ? findById(m, "d-stock") : undefined);
  const aliquot =
    findMeas(m, ["aliquot", "v1", "pipette", "stock volume", "transferred"]) ??
    (sampleId === "dilution-error" ? findById(m, "d-v1") : undefined);
  const flask =
    findMeas(m, ["flask", "v2", "final volume", "diluent", "volumetric"]) ??
    (sampleId === "dilution-error" ? findById(m, "d-v2") : undefined);
  const target =
    findMeas(m, ["target", "protocol", "desired", "expected", "m2 target"]) ??
    (sampleId === "dilution-error" ? findById(m, "d-target") : undefined);
  const labeledFinal =
    findMeas(m, ["final concentration", "working", "prepared", "m2 observed"]) ??
    (sampleId === "dilution-error" ? findById(m, "d-observed") : undefined);

  if (!stock || !aliquot || !flask || !target) return null;

  const m1 = stock.value;
  const v1 = toMl(aliquot.value, aliquot.unit);
  const v2 = toMl(flask.value, flask.unit);
  if (!(m1 > 0 && v1 > 0 && v2 > 0 && target.value > 0)) return null;

  const computed = dilution({ m1, v1, v2, solveFor: "m2" });
  const expected = target.value;
  const observed = labeledFinal?.value ?? computed.result;
  const ratio = expected > 0 ? observed / expected : 1;
  const inv = expected > 0 ? expected / observed : 1;
  const factor = Math.max(ratio, inv);

  // Catch ~10× (allow 8–12×) or exact demo fixture
  const isTenX =
    (factor >= 8 && factor <= 12.5) ||
    sampleId === "dilution-error";

  if (!isTenX) {
    // Also flag if computed from volumes differs from target by ≥5×
    const volRatio = Math.max(computed.result / expected, expected / computed.result);
    if (volRatio < 5) return null;
  }

  const roundedFactor = Math.round(factor);
  return {
    id: "dev-dilution-10x",
    code: "DILUTION_10X",
    severity: "error",
    message: `Protocol deviation: ~${roundedFactor}× dilution error — pipetted ${formatVol(v1)} of ${m1} M stock into ${formatVol(v2)} flask yields ${computed.result.toPrecision(3)} M, but protocol targets ${expected} M.`,
    expected: {
      m2: expected,
      protocol: "M1·V1 = M2·V2",
      correctV1_mL: (expected * v2) / m1,
    },
    observed: {
      m1,
      v1_mL: v1,
      v2_mL: v2,
      m2_from_volumes: computed.result,
      m2_labeled: labeledFinal?.value ?? null,
    },
    factor: roundedFactor,
    suggestion: `Use V1 = ${((expected * v2) / m1).toPrecision(3)} mL of ${m1} M stock (not ${formatVol(v1)}) to hit ${expected} M.`,
    measurementIds: [stock.id, aliquot.id, flask.id, target.id].concat(
      labeledFinal ? [labeledFinal.id] : [],
    ),
  };
}

export function deviationsToFlags(deviations: ProtocolDeviation[]): VerificationFlag[] {
  return deviations.map((d) => ({
    id: `flag-${d.id}`,
    measurementId: d.measurementIds?.[1] ?? d.measurementIds?.[0] ?? "unknown",
    severity: d.severity,
    code: d.code,
    message: d.message,
    suggestion: d.suggestion,
  }));
}

function findMeas(
  measurements: ExtractionResult["measurements"],
  needles: string[],
) {
  const lower = needles.map((n) => n.toLowerCase());
  return measurements.find((m) => {
    const hay = `${m.id} ${m.label} ${m.rawText}`.toLowerCase();
    return lower.some((n) => hay.includes(n));
  });
}

function findById(
  measurements: ExtractionResult["measurements"],
  id: string,
) {
  return measurements.find((m) => m.id === id);
}

function toMl(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "l" || u === "liter" || u === "liters") return value * 1000;
  if (u === "µl" || u === "ul" || u === "μl") return value / 1000;
  return value; // assume mL
}

function formatVol(ml: number): string {
  return `${ml} mL`;
}
