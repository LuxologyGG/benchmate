import { dilution } from "@/lib/tools/stoichiometry";
import type { ActualEntry, Comparison, Deviation, ProtocolStep, Quantity } from "./types";
import { dimensionOf, fmt, normalize } from "./units";

/**
 * Deterministic protocol checks. No model ever produces a number that is reported here:
 * models only *locate* values; these functions compare and compute them.
 */

const TOOL_RATIO = "ratio_check (unit_normalize → observed/expected)";
const TOOL_DILUTION = "dilution (M1·V1 = M2·V2)";

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["the", "and", "into", "with", "for", "from"].includes(w)),
  );
}

function score(q: Quantity, stepN: number, a: ActualEntry): number {
  const qn = normalize(q.value, q.unit);
  const an = normalize(a.value, a.unit);
  if (qn.dim !== an.dim || qn.dim === "unknown") return -1;
  let s = 1;
  if (a.stepN !== undefined) {
    if (a.stepN === stepN) s += 4;
    else return -1; // a value recorded under a different step never matches
  }
  const generic = (r?: string) => !r || r === "volume" || r === "other";
  if (q.role && a.role && q.role === a.role) s += 3;
  else if (!generic(q.role) && !generic(a.role)) s -= 3;
  const qt = tokens(q.name);
  const at = tokens(a.name);
  for (const t of qt) if (at.has(t)) s += 1;
  return s;
}

export function compareStepsToActuals(
  steps: ProtocolStep[],
  actuals: ActualEntry[],
  tolerancePct = 10,
): { comparisons: Comparison[]; deviations: Deviation[]; unmatched: ActualEntry[] } {
  const used = new Set<number>();
  const comparisons: Comparison[] = [];
  const deviations: Deviation[] = [];
  const tol = tolerancePct / 100;

  // Global greedy assignment: score every (protocol value, notebook value) pair, take best pairs first.
  const pairs: { si: number; qi: number; ai: number; sc: number }[] = [];
  steps.forEach((step, si) =>
    step.quantities.forEach((q, qi) => {
      if (q.role === "target_concentration") return;
      actuals.forEach((a, ai) => {
        const sc = score(q, step.n, a);
        if (sc >= 2) pairs.push({ si, qi, ai, sc });
      });
    }),
  );
  pairs.sort((x, y) => y.sc - x.sc);
  const assigned = new Map<string, number>();
  for (const p of pairs) {
    const k = `${p.si}:${p.qi}`;
    if (assigned.has(k) || used.has(p.ai)) continue;
    assigned.set(k, p.ai);
    used.add(p.ai);
  }

  for (const [si, step] of steps.entries()) {
    for (const [qi, q] of step.quantities.entries()) {
      // Concentration targets are often never "measured" by a student; checked via the dilution tool instead.
      if (q.role === "target_concentration") continue;
      const best = assigned.get(`${si}:${qi}`) ?? -1;
      const expected = { value: q.value, unit: q.unit };
      if (best < 0) {
        comparisons.push({ stepN: step.n, name: q.name, expected, ratio: null, status: "missing", tool: "match (step + role + name)" });
        deviations.push({
          id: `missing-${step.n}-${q.name}`,
          code: "MISSING_VALUE",
          // Missing equipment sizes / generic volumes are informational; missing working values are warnings.
          severity: !q.role || ["volume", "other"].includes(q.role) || dimensionOf(q.unit) === "count" ? "info" : "warning",
          stepN: step.n,
          title: `Step ${step.n}: no recorded ${q.name}`,
          message: `The protocol specifies ${fmt(q.value, q.unit)} for “${q.name}”, but the notebook has no matching value. Record what you actually used before trusting downstream results.`,
          expected: fmt(q.value, q.unit),
          tool: "match (step + role + name)",
        });
        continue;
      }
      const a = actuals[best];
      const qn = normalize(q.value, q.unit);
      const an = normalize(a.value, a.unit);
      const observed = { value: a.value, unit: a.unit };

      if (qn.dim === "temperature") {
        const diff = an.base - qn.base;
        const status = Math.abs(diff) > 5 ? "warn" : "ok";
        comparisons.push({ stepN: step.n, name: q.name, expected, observed, ratio: null, status, tool: "temperature_delta" });
        if (status !== "ok")
          deviations.push({
            id: `temp-${step.n}`,
            code: "OUT_OF_TOLERANCE",
            severity: "warning",
            stepN: step.n,
            title: `Step ${step.n}: temperature off by ${Math.abs(diff).toFixed(1)} °C`,
            message: `Protocol ${fmt(q.value, q.unit)}, notebook ${fmt(a.value, a.unit)}.`,
            expected: fmt(q.value, q.unit),
            observed: fmt(a.value, a.unit),
            tool: "temperature_delta",
          });
        continue;
      }

      const ratio = qn.base > 0 ? an.base / qn.base : null;
      if (ratio === null) continue;
      const factor = Math.max(ratio, 1 / ratio);
      const log = Math.log10(factor);
      const powerOfTen = factor >= 8 && Math.abs(log - Math.round(log)) < 0.1;
      let status: Comparison["status"] = "ok";
      if (powerOfTen) {
        status = "error";
        const k = Math.round(factor);
        const dir = ratio > 1 ? "more" : "less";
        deviations.push({
          id: `tenx-${step.n}-${q.name}`,
          code: "TEN_X_ERROR",
          severity: "error",
          stepN: step.n,
          title: `Step ${step.n}: ${k}× ${dir} ${q.name} than the protocol`,
          message: `You recorded ${fmt(a.value, a.unit)}; the lab manual says ${fmt(q.value, q.unit)}. That is exactly a ${k}× (${ratio > 1 ? "×" : "÷"}${k}) difference, the signature of a misplaced decimal or wrong pipette.`,
          expected: fmt(q.value, q.unit),
          observed: fmt(a.value, a.unit),
          factor: k,
          suggestion: `Redo step ${step.n} with ${fmt(q.value, q.unit)}, or ask your TA before using this solution downstream.`,
          tool: TOOL_RATIO,
        });
      } else if (Math.abs(ratio - 1) > tol) {
        const pct = (ratio - 1) * 100;
        status = Math.abs(pct) > 50 ? "error" : "warn";
        deviations.push({
          id: `tol-${step.n}-${q.name}`,
          code: "OUT_OF_TOLERANCE",
          severity: status === "error" ? "error" : "warning",
          stepN: step.n,
          title: `Step ${step.n}: ${q.name} ${pct > 0 ? "+" : ""}${pct.toFixed(0)}% vs protocol`,
          message: `Recorded ${fmt(a.value, a.unit)} vs ${fmt(q.value, q.unit)} (tolerance ±${tolerancePct}%).`,
          expected: fmt(q.value, q.unit),
          observed: fmt(a.value, a.unit),
          tool: TOOL_RATIO,
        });
      }
      comparisons.push({ stepN: step.n, name: q.name, expected, observed, ratio, status, tool: TOOL_RATIO });
    }
  }

  // Unused notebook values that simply restate a protocol value (e.g. a label "0.10 M") are not noise.
  const protocolBases = steps.flatMap((st) => st.quantities.map((q) => normalize(q.value, q.unit)));
  const unmatched = actuals.filter((a, i) => {
    if (used.has(i)) return false;
    const an = normalize(a.value, a.unit);
    return !protocolBases.some((p) => p.dim === an.dim && Math.abs(p.base - an.base) <= Math.abs(p.base) * 1e-6);
  });
  return { comparisons, deviations, unmatched };
}

function pick<T extends Quantity>(qs: T[], role: Quantity["role"]): T | undefined {
  return qs.find((q) => q.role === role);
}

/**
 * Downstream consequence check: given the protocol's stock, transfer and final volume, compute the
 * concentration the student actually made with the dilution tool and compare it to the target.
 */
export function checkDilutionTargets(steps: ProtocolStep[], actuals: ActualEntry[], tolerancePct = 10): Deviation[] {
  const out: Deviation[] = [];
  const all = steps.flatMap((s) => s.quantities.map((q) => ({ ...q, stepN: s.n })));
  const stock = pick(all, "stock_concentration");
  const v1 = pick(all, "transfer_volume");
  const v2 = pick(all, "final_volume");
  if (!stock || !v1 || !v2) return out;
  const m1 = normalize(stock.value, stock.unit).base;
  const v1e = normalize(v1.value, v1.unit).base;
  const v2e = normalize(v2.value, v2.unit).base;
  const targetQ = pick(all, "target_concentration");
  const target = targetQ ? normalize(targetQ.value, targetQ.unit).base : dilution({ m1, v1: v1e, v2: v2e, solveFor: "m2" }).result;

  const aStock = actuals.find((a) => a.role === "stock_concentration");
  const aV1 = actuals.find((a) => a.role === "transfer_volume" && (a.stepN === undefined || a.stepN === v1.stepN));
  const aV2 = actuals.find((a) => a.role === "final_volume" && (a.stepN === undefined || a.stepN === v2.stepN));
  if (!aV1) return out;
  const m1a = aStock ? normalize(aStock.value, aStock.unit).base : m1;
  const v1a = normalize(aV1.value, aV1.unit).base;
  const v2a = aV2 ? normalize(aV2.value, aV2.unit).base : v2e;
  const made = dilution({ m1: m1a, v1: v1a, v2: v2a, solveFor: "m2" }).result;
  const ratio = made / target;
  if (Math.abs(ratio - 1) <= tolerancePct / 100) return out;
  const correctV1 = dilution({ m1: m1a, m2: target, v2: v2a, v1: 0, solveFor: "v1" }).result;
  out.push({
    id: "dilution-target",
    code: "DILUTION_TARGET_MISSED",
    severity: "error",
    stepN: aV1.stepN ?? v1.stepN,
    title: `Working solution is ${fmt(made, "M")}, not ${fmt(target, "M")}`,
    message: `${fmt(m1a, "M")} × ${fmt(v1a, "mL")} ÷ ${fmt(v2a, "mL")} = ${fmt(made, "M")} (${ratio > 1 ? (ratio).toPrecision(3) + "× too concentrated" : (1 / ratio).toPrecision(3) + "× too dilute"}). Everything made from it inherits this error.`,
    expected: fmt(target, "M"),
    observed: fmt(made, "M"),
    factor: Number(Math.max(ratio, 1 / ratio).toPrecision(3)),
    suggestion: `Use V1 = ${fmt(correctV1, "mL")} of ${fmt(m1a, "M")} stock in ${fmt(v2a, "mL")} total.`,
    tool: TOOL_DILUTION,
  });
  return out;
}
