/**
 * Course Lab evidence pack (browser e2e + screenshots + results table).
 *
 * Starts three production servers from the current build (`npm run build` first):
 *   live      — GROQ_API_KEY / GEMINI_API_KEY from .env.local (free tier)
 *   badkey    — Groq key deliberately invalid → shows graceful fallback to the deterministic parser
 *   fixture   — COURSELAB_DEMO_MODE=true → no-key fixture replay
 * Writes docs/eval/courselab/*.png and docs/eval/courselab/results.json + results.md.
 *
 * Usage: npm run build && npm run eval:courselab
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "docs/eval/courselab";
mkdirSync(OUT, { recursive: true });

function startServer(port, extraEnv) {
  const p = spawn("npx", ["next", "start", "-p", String(port)], { env: { ...process.env, ...extraEnv }, stdio: "ignore", detached: true });
  return p;
}
async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server not up: ${url}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const servers = [
  ["live", 43201, {}],
  ["badkey", 43202, { GROQ_API_KEY: "gsk_invalid_for_eval", GEMINI_API_KEY: "" }],
  ["fixture", 43203, { COURSELAB_DEMO_MODE: "true" }],
];

const CASES = [
  { id: "01-ordinary-nacl", server: "live", sample: "nacl-ok", expect: (r) => r.mode === "live" && errs(r) === 0, rubric: "R2 ordinary example #1" },
  { id: "02-ordinary-serial-dilution", server: "live", sample: "ecoli-ok", expect: (r) => r.mode === "live" && errs(r) === 0, rubric: "R2 ordinary example #2 (+ CFU 4.20e+6)" },
  { id: "03-repeat-nacl", server: "live", sample: "nacl-ok", repeatOf: "01-ordinary-nacl", expect: (r) => r.mode === "live" && errs(r) === 0, rubric: "R3 repeat check" },
  { id: "04-catch-10x", server: "live", sample: "nacl-10x", expect: (r) => has(r, "TEN_X_ERROR", 2) && has(r, "DILUTION_TARGET_MISSED"), rubric: "Hero: 10× catch" },
  { id: "05-harder-messy-notebook", server: "live", sample: "cuso4-messy", expect: (r) => r.deviations.some((d) => d.stepN === 4 && d.severity !== "info") && has(r, "OFF_PROTOCOL_STEP"), rubric: "R4 demanding example (messy notes, missing units, off-protocol)" },
  { id: "06-harder-handwritten-photo", server: "live", photo: true, expect: (r) => r.ledger.some((l) => l.provider === "gemini") && has(r, "TEN_X_ERROR", 2), rubric: "R4 demanding example (handwritten page via Gemini vision)" },
  { id: "07-failure-bad-key-fallback", server: "badkey", sample: "nacl-10x", expect: (r) => r.mode === "deterministic-fallback" && r.warnings.length > 0 && has(r, "TEN_X_ERROR", 2), rubric: "R5 failure handling (model down → deterministic parser, still catches)" },
  { id: "08-no-key-fixture-replay", server: "fixture", sample: "nacl-10x", expect: (r) => r.mode === "fixture-replay" && has(r, "TEN_X_ERROR", 2), rubric: "No-key fallback (labeled fixture replay)" },
];
const errs = (r) => r.deviations.filter((d) => d.severity === "error").length;
const has = (r, code, step) => r.deviations.some((d) => d.code === code && (step === undefined || d.stepN === step));

const procs = servers.map(([, port, env]) => startServer(port, env));
const results = [];
try {
  for (const [, port] of servers) await waitFor(`http://127.0.0.1:${port}/api/courselab`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  for (const c of CASES) {
    const port = servers.find((s) => s[0] === c.server)[1];
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByTestId("mode-badge").waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid="mode-badge"]')?.textContent?.includes("checking"));
    if (c.photo) {
      await page.getByTestId("sample-photo").click();
      await page.locator('img[alt="Uploaded notebook page"]').waitFor();
    } else {
      await page.getByTestId(`sample-${c.sample}`).click();
    }
    const respP = page.waitForResponse((r) => r.url().endsWith("/api/courselab") && r.request().method() === "POST", { timeout: 60000 });
    const t0 = Date.now();
    await page.getByTestId("run").click();
    const resp = await respP;
    const r = await resp.json();
    await page.getByTestId("result").waitFor();
    const wall = Date.now() - t0;
    await page.screenshot({ path: `${OUT}/${c.id}.png`, fullPage: true });
    let pass = Boolean(c.expect(r));
    let repeatNote = "";
    if (c.repeatOf) {
      const prev = results.find((x) => x.id === c.repeatOf);
      // Repeat check = same decision: identical set of error/warning findings (code + step).
      const sig = (x) => JSON.stringify(x.deviations.filter((d) => d.severity !== "info").map((d) => `${d.code}@${d.stepN}`).sort());
      const tbl = (x) => JSON.stringify(x.comparisons.map((k) => [k.stepN, k.status]).sort());
      const same = prev && sig(prev.raw) === sig(r);
      repeatNote = same ? `same findings as run 01${tbl(prev.raw) === tbl(r) ? ", identical comparison table" : "; comparison table differs in info rows"}` : "different findings from run 01";
      pass = pass && Boolean(same);
    }
    results.push({
      id: c.id,
      rubric: c.rubric,
      server: c.server,
      mode: r.mode,
      pass,
      errors: errs(r),
      warnings: r.deviations.filter((d) => d.severity === "warning").length,
      topFinding: r.deviations[0]?.title ?? "no deviations",
      tokens: r.ledger.reduce((a, l) => a + l.promptTokens + l.completionTokens, 0),
      modelMs: r.ledger.reduce((a, l) => a + l.ms, 0),
      wallMs: wall,
      models: [...new Set(r.ledger.map((l) => `${l.provider}:${l.model}`))].join(", ") || "none",
      repeatNote,
      screenshot: `${c.id}.png`,
      raw: r,
    });
    console.log(`${pass ? "PASS" : "FAIL"} ${c.id} [${r.mode}] ${results.at(-1).topFinding}`);
    if (c.server === "live") await sleep(7000); // stay inside Groq free-tier tokens/minute
  }
  // Failure UI: empty manual → visible error + retry button
  await page.goto(`http://127.0.0.1:43201/`);
  await page.getByTestId("manual").fill("");
  await page.getByTestId("run").click();
  await page.getByRole("button", { name: "Retry" }).waitFor();
  await page.screenshot({ path: `${OUT}/09-input-error-retry.png` });
  results.push({ id: "09-input-error-retry", rubric: "R5 visible error + retry", server: "live", mode: "n/a", pass: true, errors: 0, warnings: 0, topFinding: "“Paste a lab-manual excerpt first.” + Retry", tokens: 0, modelMs: 0, wallMs: 0, models: "none", repeatNote: "", screenshot: "09-input-error-retry.png" });
  console.log("PASS 09-input-error-retry");
  await browser.close();
} finally {
  procs.forEach((p) => {
    try {
      process.kill(-p.pid, "SIGTERM"); // kill the whole group (npx → next-server)
    } catch {}
  });
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n");
const md = [
  `# Course Lab eval run (${new Date().toISOString()})`,
  "",
  "Generated by `npm run eval:courselab` (Playwright, production build, live free-tier keys).",
  "",
  "| Case | Rubric | Path | Pass | Errors / warnings | Top finding | Models | Tokens | Model ms | Screenshot |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...results.map(
    (r) =>
      `| ${r.id} | ${r.rubric} | ${r.mode} | ${r.pass ? "✅" : "❌"} | ${r.errors} / ${r.warnings} | ${r.topFinding}${r.repeatNote ? ` (${r.repeatNote})` : ""} | ${r.models} | ${r.tokens} | ${r.modelMs} | [png](${r.screenshot}) |`,
  ),
  "",
].join("\n");
writeFileSync(`${OUT}/results.md`, md);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
