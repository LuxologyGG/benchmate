/**
 * Optional live Meta API smoke — skipped unless META_API_KEY is set and DEMO_MODE off.
 * Minimizes spend: models list + one tiny chat (no SAM colony live call by default).
 *
 * Usage:
 *   source scripts/load-meta-key.sh
 *   DEMO_MODE=0 node scripts/test-live-smoke.mjs
 *
 * Optional SAM smoke (costs more): LIVE_SAM_SMOKE=1 DEMO_MODE=0 node scripts/test-live-smoke.mjs
 */
import assert from "assert";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { estimateCost, estimateSamCost } from "./muse-build/pricing.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const key = (process.env.META_API_KEY || process.env.MODEL_API_KEY || "").trim();
const demo = (process.env.DEMO_MODE || "").toLowerCase();
const forceDemo = demo === "1" || demo === "true" || demo === "yes";

if (!key || forceDemo) {
  console.log(
    JSON.stringify({
      skipped: true,
      reason: !key
        ? "No META_API_KEY/MODEL_API_KEY — live smoke skipped."
        : "DEMO_MODE forced on — live smoke skipped.",
      apiSpendUsd: 0,
    }),
  );
  process.exit(0);
}

const base = (process.env.META_API_BASE_URL || "https://api.meta.ai/v1").replace(
  /\/$/,
  "",
);

async function main() {
  let estimatedUsd = 0;
  let calls = 0;

  const modelsRes = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  calls += 1;
  assert.ok(modelsRes.ok, `models HTTP ${modelsRes.status}`);
  const modelsJson = await modelsRes.json();
  const ids = (modelsJson.data || modelsJson.models || [])
    .map((m) => m.id || m)
    .filter(Boolean);
  console.log("models sample:", ids.slice(0, 8).join(", ") || "(none listed)");

  // Spark burns reasoning_tokens — need headroom or content is null
  const chatRes = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.META_MODEL || "muse-spark-1.3",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_completion_tokens: 512,
      temperature: 0,
    }),
  });
  calls += 1;
  const chatText = await chatRes.text();
  assert.ok(chatRes.ok, `chat HTTP ${chatRes.status}: ${chatText.slice(0, 300)}`);
  const chat = JSON.parse(chatText);
  estimatedUsd += estimateCost(
    process.env.META_MODEL || "muse-spark-1.3",
    chat.usage || {},
  );
  const content = chat.choices?.[0]?.message?.content || "";
  assert.ok(
    String(content).length > 0,
    `empty Spark content (finish=${chat.choices?.[0]?.finish_reason}, reasoning=${chat.usage?.completion_tokens_details?.reasoning_tokens})`,
  );

  let sam = null;
  if (process.env.LIVE_SAM_SMOKE === "1") {
    const sample = join(root, "public", "samples", "colony-plate.png");
    assert.ok(existsSync(sample), "colony-plate.png required for LIVE_SAM_SMOKE");
    const apiBase = process.env.DEMO_BASE_URL;
    if (!apiBase) {
      sam = {
        skipped: true,
        reason: "Set DEMO_BASE_URL to a running server with DEMO_MODE=0 for live SAM quant smoke",
      };
    } else {
      const dataUrl = `data:image/png;base64,${readFileSync(sample).toString("base64")}`;
      const res = await fetch(`${apiBase}/api/quant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          mode: "colony",
          cfu: { platedVolumeMl: 0.1, dilutionFactor: 1e-4 },
        }),
      });
      calls += 1;
      estimatedUsd += estimateSamCost({ images_processed: 1 });
      const body = await res.json();
      assert.ok(res.ok, JSON.stringify(body).slice(0, 300));
      sam = {
        colonyCount: body.quant?.primary?.colonyCount,
        cfuPerMl: body.quant?.primary?.cfuPerMl,
        usedSam: body.quant?.usedSam,
        demoMode: body.quant?.demoMode,
      };
      assert.equal(sam.demoMode, false, "expected live path (demoMode=false)");
      assert.equal(sam.usedSam, true, "expected usedSam=true");
    }
  }

  console.log(
    JSON.stringify(
      {
        skipped: false,
        ok: true,
        model: process.env.META_MODEL || "muse-spark-1.3",
        replyPreview: String(content).slice(0, 80),
        sam,
        apiSpendUsdEstimate: Number(estimatedUsd.toFixed(4)),
        calls,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
