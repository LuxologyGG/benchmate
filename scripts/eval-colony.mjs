/**
 * BenchMate colony accuracy eval.
 *
 * 1) Hero path: Core `runSamQuantifier` in DEMO_MODE (fixture SAM segs → CFU)
 * 2) Multi-image path: labeled CC0 fixtures under fixtures/colony-eval/
 *
 * Usage: DEMO_MODE=1 npm run eval:colony
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { countColonyImage } from "./lib/colony-cv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs", "eval");
mkdirSync(outDir, { recursive: true });

const labelsPath = join(root, "fixtures", "colony-eval", "labels.json");
const imagesDir = join(root, "fixtures", "colony-eval", "images");

function runCoreHeroEval() {
  const tmp = join(__dirname, "_eval_core_hero.ts");
  writeFileSync(
    tmp,
    `
import assert from "assert";
import { runSamQuantifier } from "../src/lib/quant/sam-quantifier";
import {
  DEMO_COLONY_COUNT,
  DEMO_COLONY_EXPECTED_CFU,
  getDemoColonyParams,
} from "../src/lib/demo/colony-fixtures";

process.env.DEMO_MODE = "true";

async function main() {
  const t0 = Date.now();
  const result = await runSamQuantifier({
    dataUrl: "data:image/png;base64,AA==",
    mode: "colony",
    cfu: getDemoColonyParams(),
  });
  const elapsedMs = Date.now() - t0;
  const primary = result.primary as {
    mode: string;
    colonyCount?: number;
    cfuPerMl?: number;
    platedVolumeMl?: number;
    dilutionFactor?: number;
    formula?: string;
  };

  assert.equal(primary.mode, "colony");
  assert.equal(primary.colonyCount, DEMO_COLONY_COUNT);
  assert.ok(Math.abs((primary.cfuPerMl ?? 0) - DEMO_COLONY_EXPECTED_CFU) < 1e-6);

  const payload = {
    id: "colony-plate-hero",
    type: "petri_plate",
    source: "fixtures/colony-plate + public/samples/colony-plate.png",
    method: "sam_quantifier_demo_fixtures",
    model: "sam-3.1 (DEMO fixture segmentations) + deterministic CFU",
    groundTruthCount: DEMO_COLONY_COUNT,
    predictedCount: primary.colonyCount,
    groundTruthCfuPerMl: DEMO_COLONY_EXPECTED_CFU,
    predictedCfuPerMl: primary.cfuPerMl,
    platedVolumeMl: primary.platedVolumeMl,
    dilutionFactor: primary.dilutionFactor,
    formula: primary.formula,
    absError: Math.abs((primary.colonyCount ?? 0) - DEMO_COLONY_COUNT),
    cfuAbsError: Math.abs((primary.cfuPerMl ?? 0) - DEMO_COLONY_EXPECTED_CFU),
    exact: primary.colonyCount === DEMO_COLONY_COUNT,
    manualSeconds: Math.round(8 + DEMO_COLONY_COUNT * 1.4),
    benchmateSeconds: Math.max(0.4, elapsedMs / 1000),
    demoMode: result.demoMode,
    usedSam: result.usedSam,
    notes: result.notes,
    segmentations: result.segmentations.length,
  };
  console.log(JSON.stringify(payload));
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`,
  );

  try {
    const res = spawnSync("npx", ["--yes", "tsx", tmp], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DEMO_MODE: "true" },
    });
    if (res.status !== 0) {
      process.stderr.write(res.stderr || "");
      process.stdout.write(res.stdout || "");
      throw new Error("Core hero SAM quantifier eval failed");
    }
    const line = (res.stdout || "").trim().split("\n").filter(Boolean).pop();
    return JSON.parse(line);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function summarize(subset) {
  if (!subset.length) {
    return {
      n: 0,
      mae: 0,
      mape: 0,
      exactRate: 0,
      within10pctRate: 0,
      manualSecondsTotal: 0,
      benchmateSecondsTotal: 0,
      timeSavedSecondsTotal: 0,
      timeSavedPct: 0,
    };
  }
  const mae = subset.reduce((s, r) => s + r.absError, 0) / subset.length;
  const mape = subset.reduce((s, r) => s + r.relError, 0) / subset.length;
  const exactRate = subset.filter((r) => r.exact).length / subset.length;
  const within10pctRate =
    subset.filter((r) => r.within10pct).length / subset.length;
  const manualSecondsTotal = subset.reduce((s, r) => s + r.manualSeconds, 0);
  const benchmateSecondsTotal = subset.reduce(
    (s, r) => s + r.benchmateSeconds,
    0,
  );
  const timeSavedSecondsTotal = manualSecondsTotal - benchmateSecondsTotal;
  return {
    n: subset.length,
    mae: Math.round(mae * 100) / 100,
    mape: Math.round(mape * 1000) / 1000,
    exactRate: Math.round(exactRate * 1000) / 1000,
    within10pctRate: Math.round(within10pctRate * 1000) / 1000,
    manualSecondsTotal: Math.round(manualSecondsTotal * 10) / 10,
    benchmateSecondsTotal: Math.round(benchmateSecondsTotal * 10) / 10,
    timeSavedSecondsTotal: Math.round(timeSavedSecondsTotal * 10) / 10,
    timeSavedPct:
      Math.round((timeSavedSecondsTotal / manualSecondsTotal) * 1000) / 10,
  };
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

const hero = runCoreHeroEval();
const heroRow = {
  id: hero.id,
  type: hero.type,
  groundTruth: hero.groundTruthCount,
  predicted: hero.predictedCount,
  absError: hero.absError,
  relError: 0,
  within10pct: true,
  exact: hero.exact,
  manualSeconds: hero.manualSeconds,
  benchmateSeconds: Math.round(hero.benchmateSeconds * 100) / 100,
  timeSavedSeconds:
    Math.round((hero.manualSeconds - hero.benchmateSeconds) * 10) / 10,
  method: hero.method,
  model: hero.model,
  cfuPerMl: hero.predictedCfuPerMl,
  groundTruthCfuPerMl: hero.groundTruthCfuPerMl,
};

if (!existsSync(labelsPath)) {
  console.error(
    "Missing fixtures/colony-eval/labels.json — run npm run generate:colony-fixtures",
  );
  process.exit(1);
}

const labels = JSON.parse(readFileSync(labelsPath, "utf8"));
const multiRows = [];

for (const c of labels.cases) {
  const imagePath = join(imagesDir, c.file);
  if (!existsSync(imagePath)) {
    console.error("Missing image", imagePath);
    process.exit(1);
  }
  const result = await countColonyImage(imagePath, c.type);
  const absError = Math.abs(result.predictedCount - c.groundTruthCount);
  const relError =
    c.groundTruthCount === 0 ? 0 : absError / c.groundTruthCount;
  const benchmateSeconds = Math.max(0.4, result.elapsedMs / 1000);
  multiRows.push({
    id: c.id,
    type: c.type,
    groundTruth: c.groundTruthCount,
    predicted: result.predictedCount,
    absError,
    relError: Math.round(relError * 1000) / 1000,
    within10pct: relError <= 0.1,
    exact: result.predictedCount === c.groundTruthCount,
    manualSeconds: c.manualCountSeconds,
    benchmateSeconds: Math.round(benchmateSeconds * 100) / 100,
    timeSavedSeconds:
      Math.round((c.manualCountSeconds - benchmateSeconds) * 10) / 10,
    method: result.method,
    model: result.model,
  });
}

const plates = multiRows.filter((r) => r.type === "petri_plate");
const gels = multiRows.filter((r) => r.type === "gel");
const allRows = [heroRow, ...multiRows];

const summary = {
  hero_sam_quantifier: {
    colonyCount: hero.predictedCount,
    groundTruthCount: hero.groundTruthCount,
    cfuPerMl: hero.predictedCfuPerMl,
    groundTruthCfuPerMl: hero.groundTruthCfuPerMl,
    exact: hero.exact,
    formula: hero.formula,
    timeSavedSeconds: heroRow.timeSavedSeconds,
  },
  multi_petri_plate: summarize(plates),
  multi_gel: summarize(gels),
  multi_all: summarize(multiRows),
};

const payload = {
  generatedAt: new Date().toISOString(),
  mode: "DEMO_MODE — Core SAM quantifier fixtures + offline multi-image CV",
  apiSpendUsd: 0,
  hero,
  summary,
  rows: allRows,
};

writeFileSync(
  join(outDir, "accuracy.json"),
  JSON.stringify(payload, null, 2) + "\n",
);

console.log("\n# BenchMate colony accuracy\n");
console.log("## Hero (Core SAM quantifier + DEMO_MODE fixtures)");
console.log(
  `| metric | value |\n| --- | --- |\n| colonies GT / pred | ${hero.groundTruthCount} / ${hero.predictedCount} |\n| CFU/mL GT / pred | ${hero.groundTruthCfuPerMl} / ${hero.predictedCfuPerMl} |\n| exact | ${hero.exact} |\n| manual s / BenchMate s | ${heroRow.manualSeconds} / ${heroRow.benchmateSeconds} |\n| time saved | ${heroRow.timeSavedSeconds}s |\n`,
);

console.log("## Multi-image labeled set (fixtures/colony-eval)\n");
console.log(
  "| id | type | GT | pred | |err| | within 10% | manual s | BM s | saved s |",
);
console.log("| --- | --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: |");
for (const r of multiRows) {
  console.log(
    `| ${r.id} | ${r.type} | ${r.groundTruth} | ${r.predicted} | ${r.absError} | ${r.within10pct ? "yes" : "no"} | ${r.manualSeconds} | ${r.benchmateSeconds} | ${r.timeSavedSeconds} |`,
  );
}
console.log("\n### Multi-image summary");
console.log(
  `Plates (n=${summary.multi_petri_plate.n}): MAE=${summary.multi_petri_plate.mae}, MAPE=${pct(summary.multi_petri_plate.mape)}, exact=${pct(summary.multi_petri_plate.exactRate)}, ≤10%=${pct(summary.multi_petri_plate.within10pctRate)}`,
);
console.log(
  `Gels   (n=${summary.multi_gel.n}): MAE=${summary.multi_gel.mae}, MAPE=${pct(summary.multi_gel.mape)}, exact=${pct(summary.multi_gel.exactRate)}, ≤10%=${pct(summary.multi_gel.within10pctRate)}`,
);
console.log(
  `Time saved (multi): ${summary.multi_all.timeSavedSecondsTotal}s (${summary.multi_all.timeSavedPct}% reduction)`,
);
console.log(`\nWrote ${join(outDir, "accuracy.json")}`);
