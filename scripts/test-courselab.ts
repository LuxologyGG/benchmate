/**
 * Unit tests for Course Lab deterministic checks (no network).
 * Run: npm run test:courselab
 */
import assert from "node:assert/strict";
import { runCourseLab, verifyProvenance } from "../src/lib/courselab/pipeline";
import { getSample } from "../src/lib/courselab/samples";
import { cfuWithRange } from "../src/lib/courselab/report";
import { normalize } from "../src/lib/courselab/units";
import { valueAppearsIn } from "../src/lib/courselab/parse";

let passed = 0;
async function t(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log("Course Lab deterministic tests");
  await t("unit normalize µL/mL/L and mM/M", () => {
    assert.equal(normalize(1, "L").base, 1000);
    assert.equal(normalize(500, "µL").base, 0.5);
    assert.equal(normalize(250, "mM").base, 0.25);
    assert.equal(normalize(2, "h").base, 120);
  });
  await t("provenance: number must appear in source", () => {
    assert.ok(valueAppearsIn(10, "transfer 10.0 mL"));
    assert.ok(!valueAppearsIn(100, "transfer 10.0 mL"));
    assert.ok(valueAppearsIn(0.1, "spread 0.1 mL"));
  });

  const ok = await runCourseLab(getSample("nacl-ok")!);
  await t("ordinary NaCl: no errors (deterministic parser)", () => {
    assert.equal(ok.mode, "deterministic-fallback");
    assert.equal(ok.deviations.filter((d) => d.severity === "error").length, 0, JSON.stringify(ok.deviations, null, 1));
  });

  const bad = await runCourseLab(getSample("nacl-10x")!);
  await t("10× catch: 1.0 mL vs 10.0 mL flagged as TEN_X_ERROR", () => {
    const d = bad.deviations.find((x) => x.code === "TEN_X_ERROR");
    assert.ok(d, JSON.stringify(bad.deviations, null, 1));
    assert.equal(d!.factor, 10);
    assert.equal(d!.stepN, 2);
  });
  await t("10× catch: dilution tool reports 0.01 M working solution", () => {
    const d = bad.deviations.find((x) => x.code === "DILUTION_TARGET_MISSED");
    assert.ok(d, JSON.stringify(bad.deviations, null, 1));
    assert.match(d!.observed!, /^0\.01 M$/);
    assert.match(d!.suggestion!, /10 mL/);
  });

  const eco = await runCourseLab(getSample("ecoli-ok")!);
  await t("ordinary serial dilution: no errors", () => {
    assert.equal(eco.deviations.filter((d) => d.severity === "error").length, 0, JSON.stringify(eco.deviations, null, 1));
  });
  await t("CFU: 42 colonies / (0.1 mL × 1e-4) = 4.2e6, but below countable range", () => {
    const c = cfuWithRange({ colonyCount: 42, platedVolumeMl: 0.1, dilution: 1e-4 });
    assert.ok(Math.abs(c.cfuPerMl - 4.2e6) < 1e-6);
    assert.equal(c.countable, true);
    assert.equal(cfuWithRange({ colonyCount: 12, platedVolumeMl: 0.1, dilution: 1e-4 }).countable, false);
  });

  const messy = await runCourseLab(getSample("cuso4-messy")!);
  await t("harder CuSO4: flags short equilibration and off-protocol note", () => {
    assert.ok(messy.deviations.some((d) => d.stepN === 4 && (d.code === "OUT_OF_TOLERANCE" || d.code === "MISSING_VALUE")), JSON.stringify(messy.deviations, null, 1));
    assert.ok(messy.deviations.some((d) => d.code === "OFF_PROTOCOL_STEP"));
  });

  await t("provenance gate rejects a hallucinated model number", () => {
    const s = getSample("nacl-10x")!;
    const { ex, rejected } = verifyProvenance(
      {
        steps: [{ n: 2, text: "transfer", quantities: [{ name: "volume transferred", value: 10, unit: "mL", role: "transfer_volume" }] }],
        actuals: [{ stepN: 2, name: "volume transferred", value: 10, unit: "mL", role: "transfer_volume" }, { stepN: 2, name: "x", value: 7.5, unit: "mL" }],
        notes: [],
      },
      s.manual,
      s.notebook,
    );
    // 10 does appear in the notebook ("10 mL"? no: "1 mL pipette", "10x") — 10 appears as "10x", so kept; 7.5 never appears.
    assert.equal(ex.actuals.some((a) => a.value === 7.5), false);
    assert.ok(rejected.some((r) => r.code === "UNVERIFIED_EXTRACTION"));
  });

  await t("fixture replay still runs the real checks", async () => {
    const s = getSample("nacl-10x")!;
    const r = await runCourseLab(s, {
      fixture: {
        extraction: {
          steps: [
            { n: 2, text: "t", quantities: [{ name: "volume transferred", value: 10.0, unit: "mL", role: "transfer_volume" }, { name: "stock", value: 1.0, unit: "M", role: "stock_concentration" }] },
            { n: 3, text: "d", quantities: [{ name: "final volume", value: 100.0, unit: "mL", role: "final_volume" }, { name: "target", value: 0.1, unit: "M", role: "target_concentration" }] },
          ],
          actuals: [{ stepN: 2, name: "volume transferred", value: 1.0, unit: "mL", role: "transfer_volume" }],
          notes: [],
        },
        ledger: [],
      },
    });
    assert.equal(r.mode, "fixture-replay");
    assert.ok(r.deviations.some((d) => d.code === "TEN_X_ERROR"));
  });

  console.log(`\n${passed} passed`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
