import assert from "assert";
import { createRequire } from "module";

// Compile-free smoke tests via tsx-less approach: duplicate critical pure math checks
// by importing built modules through next's path is hard; instead reimplement assertions
// against the same formulas by spawning ts-node — use dynamic import of compiled JS.

// Prefer running through npx tsx if available
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmp = join(__dirname, "_tool_test_runner.ts");

writeFileSync(
  tmp,
  `
import assert from "assert";
import { convertUnit } from "../src/lib/tools/units";
import { molarity, dilution } from "../src/lib/tools/stoichiometry";
import { linearRegression, beersLawConcentration } from "../src/lib/tools/regression";
import { percentError } from "../src/lib/tools/percent-error";
import { propagateUncertainty } from "../src/lib/tools/uncertainty";
import { executeTool } from "../src/lib/tools";

const mg = convertUnit({ value: 2500, fromUnit: "mg", toUnit: "g" });
assert.ok(Math.abs(mg.value - 2.5) < 1e-9);

const m = molarity({ compute: "molarity", moles: 0.05, liters: 0.25 });
assert.ok(Math.abs(m.result - 0.2) < 1e-12);

const d = dilution({ m1: 1, v1: 10, v2: 100, solveFor: "m2" });
assert.ok(Math.abs(d.result - 0.1) < 1e-12);

const fit = linearRegression({ x: [0, 1, 2], y: [1, 3, 5] });
assert.ok(Math.abs(fit.slope - 2) < 1e-9);
assert.ok(Math.abs(fit.intercept - 1) < 1e-9);
assert.ok(fit.rSquared > 0.999);

const c = beersLawConcentration({ absorbance: 0.5, slope: 2, intercept: 0.1 });
assert.ok(Math.abs(c.concentration - 0.2) < 1e-12);

const pe = percentError({ experimental: 9.5, theoretical: 10 });
assert.ok(Math.abs(pe.percentError - 5) < 1e-9);

const u = propagateUncertainty({
  operation: "add",
  a: { value: 1, uncertainty: 0.1 },
  b: { value: 2, uncertainty: 0.2 },
});
assert.ok(Math.abs(u.value - 3) < 1e-12);
assert.ok(Math.abs(u.uncertainty - Math.hypot(0.1, 0.2)) < 1e-12);

const viaIndex = executeTool("percent_error", { experimental: 1, theoretical: 1 });
assert.equal((viaIndex as { percentError: number }).percentError, 0);

console.log("All chemistry tool tests passed.");
`,
);

const result = spawnSync(
  "npx",
  ["--yes", "tsx", tmp],
  { cwd: join(__dirname, ".."), encoding: "utf8", env: process.env },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}
assert.equal(result.status, 0, "tool tests failed");
