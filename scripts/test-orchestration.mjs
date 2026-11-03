import assert from "assert";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmp = join(__dirname, "_orch_test_runner.ts");

writeFileSync(
  tmp,
  `
import assert from "assert";
import { parseJsonRobust, closeTruncatedJson, isTruncatedJsonError } from "../src/lib/json-repair";
import { extractJsonObject } from "../src/lib/meta-client";
import { checkProtocolDeviations } from "../src/lib/agent/protocol-check";
import { getDemoExtraction, getDemoAgent, getDemoVerification, buildDemoReport } from "../src/lib/demo/fixtures";
import { runWonderOrchestration } from "../src/lib/agent/orchestrator";

// ── JSON repair: unterminated string (the live Meta failure mode) ──
const truncated = '{"title":"Lab","summary":"CuSO4 standards measured at 635 nm with absorb';
const repaired = parseJsonRobust<{ title: string; summary: string }>(truncated);
assert.equal(repaired.title, "Lab");
assert.ok(typeof repaired.summary === "string");

const fenced = '\`\`\`json\\n{"ok":true,"n":1}\\n\`\`\`';
assert.deepEqual(parseJsonRobust(fenced), { ok: true, n: 1 });

const closed = closeTruncatedJson('{"a":[1,2,{"b":"x');
assert.ok(closed.includes("}"));
const parsedClosed = JSON.parse(closed);
assert.equal(parsedClosed.a[2].b, "x");

assert.ok(isTruncatedJsonError(new Error("Unterminated string in JSON at position 1683")));

const viaMeta = extractJsonObject<{ hello: string }>('{"hello":"world"');
assert.equal(viaMeta.hello, "world");

// ── Protocol 10× dilution catch (DEMO fixture) ──
const extraction = getDemoExtraction("dilution-error");
const deviations = checkProtocolDeviations({
  extraction,
  sampleId: "dilution-error",
});
assert.ok(deviations.length >= 1, "expected dilution deviation");
assert.equal(deviations[0].code, "DILUTION_10X");
assert.ok((deviations[0].factor ?? 0) >= 8);
assert.ok(/10/.test(deviations[0].message));

const agent = getDemoAgent("dilution-error");
assert.ok(agent.computed.some((c) => c.id === "c-factor" && c.value === 10));
const verification = getDemoVerification("dilution-error");
assert.ok(verification.flags.some((f) => f.code === "DILUTION_10X"));
const report = buildDemoReport("dilution-error", extraction, agent);
assert.ok(/10/.test(report.sections.errorAnalysis) || /DILUTION/.test(report.markdown));

async function main() {
  // ── Full DEMO Wonder orchestration (no API) ──
  process.env.DEMO_MODE = "true";
  const events: string[] = [];
  const result = await runWonderOrchestration({
    sampleId: "dilution-error",
    images: [
      { id: "img-0", name: "stock.png", dataUrl: "data:image/png;base64,xx" },
      { id: "img-1", name: "notebook.png", dataUrl: "data:image/png;base64,yy" },
    ],
    writeReport: true,
    onTrace: (ev) => events.push(ev.kind),
  });
  assert.equal(result.provider, "demo");
  assert.equal(result.orchestratorModel, "muse-wonder-1.0");
  assert.ok(result.deviations.length >= 1);
  assert.ok(result.trace.some((t) => t.kind === "protocol_deviation"));
  assert.ok(result.trace.some((t) => t.kind === "done"));
  assert.ok(result.report);
  assert.ok(events.includes("protocol_deviation"));
  assert.ok(events.includes("resolution"));

  console.log("Orchestration + JSON repair tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`,
);

const result = spawnSync("npx", ["--yes", "tsx", tmp], {
  cwd: join(__dirname, ".."),
  encoding: "utf8",
  env: { ...process.env, DEMO_MODE: "true" },
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}
assert.equal(result.status, 0, "orchestration tests failed");
