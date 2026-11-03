/**
 * Live Meta API eval — hero colony (SAM) + plate/gel sample + Wonder orchestration
 * (colony CFU + Serial Dilution 10× catch). Tracks spend against LIVE_EVAL_SPEND_CAP.
 *
 * Usage:
 *   DEMO_MODE=false META_API_KEY=... npm run eval:live
 *
 * Optional:
 *   LIVE_EVAL_SPEND_CAP=35
 *   LIVE_EVAL_SKIP_ORCHESTRATE=1   # quant-only (cheaper)
 *   LIVE_EVAL_PORT=43177
 *   LIVE_PRIOR_SAM_IMAGES=20       # fold earlier probe spend into tracker
 */
import assert from "assert";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";
import { SpendTracker } from "./muse-build/pricing.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs", "eval");
mkdirSync(outDir, { recursive: true });

const key = (process.env.META_API_KEY || process.env.MODEL_API_KEY || "").trim();
const demo = (process.env.DEMO_MODE || "").toLowerCase();
const forceDemo = demo === "1" || demo === "true" || demo === "yes";
const CAP = Number(process.env.LIVE_EVAL_SPEND_CAP || 35);
const PORT = process.env.LIVE_EVAL_PORT || "43177";
const EXTERNAL = process.env.DEMO_BASE_URL;
const BASE = EXTERNAL || `http://127.0.0.1:${PORT}`;
const SKIP_ORCH = process.env.LIVE_EVAL_SKIP_ORCHESTRATE === "1";

if (!key || forceDemo) {
  console.error(
    JSON.stringify({
      skipped: true,
      reason: !key
        ? "META_API_KEY required for live eval"
        : "DEMO_MODE is on — set DEMO_MODE=false",
    }),
  );
  process.exit(1);
}

const spend = new SpendTracker(CAP);
const PRIOR_SAM_IMAGES = Number(process.env.LIVE_PRIOR_SAM_IMAGES || 20);
spend.record({
  model: "sam-3.1",
  usage: { images_processed: PRIOR_SAM_IMAGES },
  role: "prior_probe",
  note: "Estimated SAM images from earlier live probes this session",
});
spend.record({
  model: "muse-spark-1.3",
  usage: { prompt_tokens: 200, completion_tokens: 800 },
  role: "prior_probe",
  note: "Estimated Spark/Wonder debug chat tokens this session",
});

function dataUrlFor(relPath) {
  const p = join(root, relPath);
  assert.ok(existsSync(p), `missing ${relPath}`);
  const buf = readFileSync(p);
  const mime = relPath.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function waitForOk(url, tries = 120) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${url}: ${lastErr}`);
}

function startServer() {
  const child = spawn(
    "npx",
    ["next", "dev", "-p", PORT, "-H", "127.0.0.1"],
    {
      cwd: root,
      env: {
        ...process.env,
        DEMO_MODE: "false",
        META_API_KEY: key,
        MODEL_PROVIDER: "meta",
        META_API_BASE_URL: process.env.META_API_BASE_URL || "https://api.meta.ai/v1",
        META_MODEL: process.env.META_MODEL || "muse-spark-1.3",
        META_WONDER_MODEL: process.env.META_WONDER_MODEL || "muse-wonder-1.0",
        META_SAM_MODEL_ID: process.env.META_SAM_MODEL_ID || "sam-3.1",
        META_REQUEST_TIMEOUT_MS: process.env.META_REQUEST_TIMEOUT_MS || "90000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  return child;
}

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

async function orchestrate(body) {
  const res = await fetch(`${BASE}/api/orchestrate`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 500),
      traces: [],
      result: null,
    };
  }
  const traces = [];
  let result = null;
  let error = null;
  let event = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (event === "trace") traces.push(data);
      else if (event === "result") result = data;
      else if (event === "error") error = data;
    }
  }
  return { ok: !error, status: res.status, traces, result, error };
}

function runLiveQuant(imageRel, mode, cfu) {
  const tmp = join(__dirname, "_eval_live_quant.ts");
  const dataUrl = dataUrlFor(imageRel);
  writeFileSync(
    tmp,
    `
import { runSamQuantifier } from "../src/lib/quant/sam-quantifier";

process.env.DEMO_MODE = "false";

async function main() {
  const t0 = Date.now();
  const result = await runSamQuantifier({
    dataUrl: ${JSON.stringify(dataUrl)},
    mode: ${JSON.stringify(mode)},
    cfu: ${JSON.stringify(cfu || { platedVolumeMl: 0.1, dilutionFactor: 1e-4 })},
  });
  console.log(JSON.stringify({
    elapsedMs: Date.now() - t0,
    success: result.success,
    usedSam: result.usedSam,
    demoMode: result.demoMode,
    primary: result.primary,
    segmentations: result.segmentations.length,
    notes: result.notes,
  }));
}
main().catch((e) => { console.error(e); process.exit(1); });
`,
  );
  try {
    const res = spawnSync("npx", ["--yes", "tsx", tmp], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        DEMO_MODE: "false",
        META_API_KEY: key,
      },
      timeout: 180_000,
    });
    if (res.status !== 0) {
      process.stderr.write(res.stderr || "");
      process.stdout.write(res.stdout || "");
      throw new Error(`live quant failed for ${imageRel}`);
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

function pctErr(pred, gt) {
  if (!gt) return pred === 0 ? 0 : 1;
  return Math.abs(pred - gt) / gt;
}

async function main() {
  console.log(`Live eval spend floor so far: $${spend.total.toFixed(4)} / $${CAP}`);

  if (!existsSync(join(root, "public/samples/dilution-notebook.png"))) {
    console.log("Generating samples (incl. dilution-notebook)…");
    spawnSync("node", ["scripts/generate-samples.mjs"], {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
    });
  }

  // ── 1) Hero colony SAM quant ──────────────────────────────────────────
  if (!spend.canAfford(0.05)) throw new Error(spend.haltedReason || "budget");
  console.log("\n## Live hero: colony-plate via runSamQuantifier");
  const hero = runLiveQuant("public/samples/colony-plate.png", "colony");
  spend.record({
    model: "sam-3.1",
    usage: { images_processed: 1 },
    role: "hero_quant",
    note: "hero colony SAM (early-stop after first hit)",
  });
  console.log(
    JSON.stringify(
      {
        usedSam: hero.usedSam,
        demoMode: hero.demoMode,
        colonyCount: hero.primary?.colonyCount,
        cfuPerMl: hero.primary?.cfuPerMl,
        segs: hero.segmentations,
        notes: hero.notes,
      },
      null,
      2,
    ),
  );
  assert.equal(hero.demoMode, false, "hero must be live");
  assert.equal(hero.usedSam, true, "hero must use SAM");
  const heroCount = hero.primary?.colonyCount ?? 0;
  const heroCfu = hero.primary?.cfuPerMl ?? 0;

  // ── 2) plate-001 + gel-001 live SAM ─────────────────────────────────
  const labels = JSON.parse(
    readFileSync(join(root, "fixtures/colony-eval/labels.json"), "utf8"),
  );
  const plate = labels.cases.find((c) => c.id === "plate-001");
  const gel = labels.cases.find((c) => c.id === "gel-001");

  console.log("\n## Live plate-001");
  const plateLive = runLiveQuant(
    `fixtures/colony-eval/images/${plate.file}`,
    "colony",
  );
  spend.record({
    model: "sam-3.1",
    usage: { images_processed: 1 },
    role: "plate_001",
  });
  const platePred = plateLive.primary?.colonyCount ?? 0;
  console.log({
    gt: plate.groundTruthCount,
    pred: platePred,
    usedSam: plateLive.usedSam,
    demoMode: plateLive.demoMode,
  });

  console.log("\n## Live gel-001 (gel-densitometry)");
  const gelLive = runLiveQuant(
    `fixtures/colony-eval/images/${gel.file}`,
    "gel-densitometry",
  );
  spend.record({
    model: "sam-3.1",
    usage: { images_processed: 2 },
    role: "gel_001",
    note: "up to 2 gel prompts before early-stop",
  });
  const gelPred =
    gelLive.primary?.bandCount ?? gelLive.primary?.colonyCount ?? 0;
  console.log({
    gt: gel.groundTruthCount,
    pred: gelPred,
    mode: gelLive.primary?.mode,
    usedSam: gelLive.usedSam,
  });

  let orchColony = null;
  let orchDilution = null;
  let child;

  if (!SKIP_ORCH && spend.canAfford(2.0)) {
    if (!EXTERNAL) child = startServer();
    try {
      await waitForOk(`${BASE}/api/health`);
      const health = await json("GET", "/api/health");
      assert.equal(health.data.demoMode, false, "server must be live");
      console.log("\n## Health", health.data);

      console.log("\n## Live Wonder orchestration: colony-plate");
      const t0 = Date.now();
      orchColony = await orchestrate({
        sampleId: "colony-plate",
        writeReport: true,
        images: [
          {
            id: "plate",
            name: "colony-plate.png",
            dataUrl: dataUrlFor("public/samples/colony-plate.png"),
          },
          {
            id: "label",
            name: "colony-plate-label.png",
            dataUrl: dataUrlFor("public/samples/colony-plate-label.png"),
          },
        ],
      });
      const colonyMs = Date.now() - t0;
      spend.record({
        model: "sam-3.1",
        usage: { images_processed: 3 },
        role: "orch_colony_sam",
      });
      spend.record({
        model: "muse-wonder-1.0",
        usage: { prompt_tokens: 2500, completion_tokens: 1200 },
        role: "orch_colony_wonder",
      });
      spend.record({
        model: "muse-spark-1.3",
        usage: { prompt_tokens: 18000, completion_tokens: 6000 },
        role: "orch_colony_spark",
        note: "extract/readout/calc/verifier/report envelope",
      });
      console.log({
        ok: orchColony.ok,
        error: orchColony.error,
        traceCount: orchColony.traces?.length,
        ms: colonyMs,
        deviations: orchColony.result?.deviations?.map((d) => d.code),
        colonyCount:
          orchColony.result?.extraction?.quantitation?.colonyCount ??
          orchColony.result?.extraction?.measurements?.find((m) =>
            /colony/i.test(m.label || ""),
          )?.value,
        provider: orchColony.result?.provider,
        orchestratorModel: orchColony.result?.orchestratorModel,
      });

      if (spend.canAfford(2.0)) {
        console.log("\n## Live Wonder orchestration: dilution-error");
        const t1 = Date.now();
        orchDilution = await orchestrate({
          sampleId: "dilution-error",
          writeReport: true,
          images: [
            {
              id: "nb",
              name: "dilution-notebook.png",
              dataUrl: dataUrlFor("public/samples/dilution-notebook.png"),
            },
          ],
        });
        const dilMs = Date.now() - t1;
        spend.record({
          model: "sam-3.1",
          usage: { images_processed: 3 },
          role: "orch_dilution_sam",
        });
        spend.record({
          model: "muse-wonder-1.0",
          usage: { prompt_tokens: 2500, completion_tokens: 1500 },
          role: "orch_dilution_wonder",
        });
        spend.record({
          model: "muse-spark-1.3",
          usage: { prompt_tokens: 16000, completion_tokens: 5000 },
          role: "orch_dilution_spark",
        });
        const codes = (orchDilution.result?.deviations || []).map((d) => d.code);
        const flagCodes = (orchDilution.result?.verification?.flags || []).map(
          (f) => f.code,
        );
        console.log({
          ok: orchDilution.ok,
          error: orchDilution.error,
          traceCount: orchDilution.traces?.length,
          ms: dilMs,
          deviationCodes: codes,
          flagCodes,
          hasDilution10x:
            codes.includes("DILUTION_10X") || flagCodes.includes("DILUTION_10X"),
        });
      } else {
        console.warn("Skipping dilution orch — spend cap");
      }
    } finally {
      if (child) child.kill("SIGTERM");
    }
  } else if (!SKIP_ORCH) {
    console.warn("Skipping orchestration — approaching spend cap");
  }

  const demoHero = { count: 42, cfu: 4.2e6 };
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: "LIVE Meta API — muse-wonder-1.0 / muse-spark-1.3 / sam-3.1",
    apiSpendUsdEstimate: Number(spend.total.toFixed(4)),
    spendCapUsd: CAP,
    spendSummary: spend.summary(),
    comparison: {
      hero: {
        groundTruthCount: 42,
        groundTruthCfuPerMl: 4.2e6,
        demo: {
          predictedCount: demoHero.count,
          predictedCfuPerMl: demoHero.cfu,
          usedSam: false,
        },
        live: {
          predictedCount: heroCount,
          predictedCfuPerMl: heroCfu,
          usedSam: hero.usedSam,
          demoMode: hero.demoMode,
          absError: Math.abs(heroCount - 42),
          exact: heroCount === 42,
          within10pct: pctErr(heroCount, 42) <= 0.1,
          notes: hero.notes,
        },
      },
      plate_001: {
        groundTruthCount: plate.groundTruthCount,
        livePredicted: platePred,
        absError: Math.abs(platePred - plate.groundTruthCount),
        within10pct: pctErr(platePred, plate.groundTruthCount) <= 0.1,
        usedSam: plateLive.usedSam,
      },
      gel_001: {
        groundTruthCount: gel.groundTruthCount,
        livePredicted: gelPred,
        absError: Math.abs(gelPred - gel.groundTruthCount),
        within10pct: pctErr(gelPred, gel.groundTruthCount) <= 0.1,
        usedSam: gelLive.usedSam,
        mode: gelLive.primary?.mode,
      },
      dilution: {
        liveCaught:
          (orchDilution?.result?.deviations || []).some(
            (d) => d.code === "DILUTION_10X",
          ) ||
          (orchDilution?.result?.verification?.flags || []).some(
            (f) => f.code === "DILUTION_10X",
          ),
        traceCount: orchDilution?.traces?.length ?? 0,
        orchestratorModel: orchDilution?.result?.orchestratorModel,
      },
      wonderColony: {
        ok: orchColony?.ok ?? false,
        traceCount: orchColony?.traces?.length ?? 0,
        orchestratorModel: orchColony?.result?.orchestratorModel,
        provider: orchColony?.result?.provider,
      },
    },
  };

  writeFileSync(
    join(outDir, "live-accuracy.json"),
    JSON.stringify(payload, null, 2) + "\n",
  );
  console.log("\n## Spend summary", spend.summary());
  console.log(`Wrote ${join(outDir, "live-accuracy.json")}`);

  if (!payload.comparison.hero.live.within10pct) {
    console.warn("WARNING: live hero colony count outside 10% of GT");
  }
  if (orchDilution && !payload.comparison.dilution.liveCaught) {
    console.warn("WARNING: live dilution orchestration did not flag DILUTION_10X");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
