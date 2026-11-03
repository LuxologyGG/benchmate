/**
 * End-to-end DEMO_MODE API smoke (no Meta API spend).
 *
 * Covers:
 *  1) Core /api/quant hero: 42 colonies → 4.2e6 CFU/mL
 *  2) Wonder→quantifier via /api/orchestrate (colony-plate)
 *  3) Serial Dilution 10× protocol-deviation via /api/orchestrate (dilution-error)
 *  4) Classic extract→agent→verify→report still works
 *
 * Usage: DEMO_MODE=1 npm run test:e2e
 */
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PORT = process.env.DEMO_PORT || "43155";
const EXTERNAL = process.env.DEMO_BASE_URL;
const BASE = EXTERNAL || `http://127.0.0.1:${PORT}`;

async function waitForOk(url, tries = 90) {
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
        DEMO_MODE: "true",
        META_API_KEY: "",
        MODEL_API_KEY: "",
        BASETEN_API_KEY: "",
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
    data = { raw: text };
  }
  return { status: res.status, data };
}

/** Parse SSE from /api/orchestrate into { traces, result, error }. */
async function orchestrate(body) {
  const res = await fetch(`${BASE}/api/orchestrate`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  assert.ok(res.ok, `orchestrate HTTP ${res.status}`);
  const text = await res.text();
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
  return { traces, result, error, raw: text };
}

function sampleDataUrl(name) {
  const sample = join(root, "public", "samples", name);
  if (existsSync(sample)) {
    return `data:image/png;base64,${readFileSync(sample).toString("base64")}`;
  }
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

async function run() {
  assert.ok(
    existsSync(join(root, "fixtures", "colony-eval", "labels.json")),
    "colony-eval fixtures missing — run npm run generate:colony-fixtures",
  );
  assert.ok(
    existsSync(join(root, "fixtures", "colony-plate", "README.md")),
    "Core colony-plate fixture missing",
  );

  let child;
  if (!EXTERNAL) child = startServer();

  try {
    await waitForOk(`${BASE}/api/health`);

    const health = await json("GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);
    assert.equal(health.data.demoMode, true, "expected DEMO_MODE");

    // ── 1) Direct Core quantifier ─────────────────────────────────────
    const colonyUrl = sampleDataUrl("colony-plate.png");
    const quant = await json("POST", "/api/quant", {
      dataUrl: colonyUrl,
      mode: "colony",
      cfu: { platedVolumeMl: 0.1, dilutionFactor: 1e-4 },
    });
    assert.equal(quant.status, 200, JSON.stringify(quant.data).slice(0, 300));
    const q = quant.data.quant ?? quant.data;
    assert.equal(q.demoMode, true);
    assert.equal(q.primary?.mode, "colony");
    assert.equal(q.primary?.colonyCount, 42);
    assert.ok(Math.abs((q.primary?.cfuPerMl ?? 0) - 4.2e6) < 1e-6);

    // ── 2) Wonder → SAM quantifier (colony CFU hero) ──────────────────
    const wonderColony = await orchestrate({
      sampleId: "colony-plate",
      writeReport: true,
      images: [
        { id: "img-0", name: "colony-plate.png", dataUrl: colonyUrl },
        {
          id: "img-1",
          name: "colony-plate-label.png",
          dataUrl: sampleDataUrl("colony-plate-label.png"),
        },
      ],
    });
    assert.ok(!wonderColony.error, JSON.stringify(wonderColony.error));
    assert.ok(wonderColony.result, "missing Wonder colony result");
    assert.equal(wonderColony.result.orchestratorModel, "muse-wonder-1.0");
    assert.equal(wonderColony.result.provider, "demo");
    const colonyCount =
      wonderColony.result.quant?.primary?.colonyCount ??
      wonderColony.result.extraction?.quantSummary?.colonyCount ??
      wonderColony.result.agent?.computed?.find(
        (c) => /colony|cfu/i.test(c.label || "") || c.id?.includes("colony"),
      )?.value;
    // Prefer quant payload; fall back to scanning computed/report
    let resolvedCount = colonyCount;
    let resolvedCfu =
      wonderColony.result.quant?.primary?.cfuPerMl ??
      wonderColony.result.extraction?.quantSummary?.cfuPerMl;
    if (resolvedCount == null || resolvedCfu == null) {
      const computed = wonderColony.result.agent?.computed || [];
      const n = computed.find(
        (c) =>
          c.id === "c-count" ||
          /colony count/i.test(c.label || "") ||
          c.unit === "colonies",
      );
      const cfu = computed.find(
        (c) =>
          c.id === "c-cfu" ||
          /cfu/i.test(c.label || "") ||
          /CFU/.test(c.unit || ""),
      );
      if (n) resolvedCount = n.value;
      if (cfu) resolvedCfu = cfu.value;
    }
    // Trace must mention SAM quantifier + CFU path
    assert.ok(
      wonderColony.traces.some((t) => t.role === "sam_quantifier"),
      "expected sam_quantifier trace events",
    );
    assert.ok(
      wonderColony.traces.some(
        (t) =>
          /4\.2e\+?6|4200000|4\.20e\+6|colonies/i.test(
            `${t.title || ""} ${t.detail || ""}`,
          ) || t.payload?.colonyCount === 42,
      ),
      `expected CFU/colony mention in trace: ${JSON.stringify(wonderColony.traces.slice(0, 6))}`,
    );
    if (resolvedCount != null) assert.equal(Number(resolvedCount), 42);
    if (resolvedCfu != null) {
      assert.ok(Math.abs(Number(resolvedCfu) - 4.2e6) < 1e-3);
    }
    assert.ok(wonderColony.result.report?.markdown?.length > 20);

    // ── 3) Serial Dilution 10× protocol-deviation wow ─────────────────
    const wonderDilution = await orchestrate({
      sampleId: "dilution-error",
      writeReport: true,
      images: [
        {
          id: "img-0",
          name: "dilution-stock.png",
          dataUrl: sampleDataUrl("beers-law-spectrophotometer.png"),
        },
        {
          id: "img-1",
          name: "dilution-notebook.png",
          dataUrl: sampleDataUrl("beers-law-notebook.png"),
        },
      ],
    });
    assert.ok(!wonderDilution.error, JSON.stringify(wonderDilution.error));
    assert.ok(wonderDilution.result);
    assert.equal(wonderDilution.result.orchestratorModel, "muse-wonder-1.0");
    const deviations = wonderDilution.result.deviations || [];
    assert.ok(deviations.length >= 1, "expected protocol deviations");
    assert.ok(
      deviations.some((d) => d.code === "DILUTION_10X"),
      `expected DILUTION_10X, got ${JSON.stringify(deviations)}`,
    );
    assert.ok(
      wonderDilution.traces.some((t) => t.kind === "protocol_deviation"),
      "expected protocol_deviation trace event",
    );
    assert.ok(
      (wonderDilution.result.verification?.flags || []).some(
        (f) => f.code === "DILUTION_10X",
      ) ||
        /10/.test(wonderDilution.result.report?.markdown || "") ||
        /DILUTION/.test(wonderDilution.result.report?.markdown || ""),
      "expected dilution flag or report mention",
    );
    const factor = wonderDilution.result.agent?.computed?.find(
      (c) => c.id === "c-factor",
    );
    if (factor) assert.equal(factor.value, 10);

    // ── 4) Classic beers-law pipeline still works ─────────────────────
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const extract = await json("POST", "/api/extract", {
      sampleId: "beers-law",
      images: [
        {
          id: "img-0",
          name: "beers-law-spectrophotometer.png",
          dataUrl: pixel,
        },
      ],
    });
    assert.equal(extract.status, 200);
    const extraction = extract.data.extraction ?? extract.data;
    assert.ok(extraction.measurements?.length > 0);

    const agentRes = await json("POST", "/api/agent", {
      sampleId: "beers-law",
      extraction,
    });
    assert.equal(agentRes.status, 200);
    const agent = agentRes.data.agent ?? agentRes.data;

    const verifyRes = await json("POST", "/api/verify", {
      sampleId: "beers-law",
      extraction,
      images: [{ id: "img-0", name: "beers.png", dataUrl: pixel }],
    });
    assert.equal(verifyRes.status, 200);
    const verification = verifyRes.data.verification ?? verifyRes.data;

    const reportRes = await json("POST", "/api/report", {
      sampleId: "beers-law",
      extraction,
      agent,
      verification,
    });
    assert.equal(reportRes.status, 200);

    console.log("E2E DEMO_MODE tests passed.");
    console.log(
      JSON.stringify(
        {
          health: health.data,
          quantColonyCount: q.primary.colonyCount,
          quantCfuPerMl: q.primary.cfuPerMl,
          wonderColonyTraces: wonderColony.traces.length,
          wonderColonyResolvedCount: resolvedCount ?? null,
          wonderColonyResolvedCfu: resolvedCfu ?? null,
          dilutionCode: deviations[0]?.code,
          dilutionFactor: factor?.value ?? null,
          dilutionTraceKinds: [
            ...new Set(wonderDilution.traces.map((t) => t.kind)),
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    if (child) {
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 2500).unref?.();
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
