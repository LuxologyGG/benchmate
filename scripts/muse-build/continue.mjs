#!/usr/bin/env node
/**
 * Resume Muse Spark on ONE small surgical task (patch-only) so BUILD_LOG
 * records a successful contributor apply. Spend continues from prior ledger.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { chat, extractJson, spend } from "./client.mjs";
import { applyOps, readRepoFile, repoRoot } from "./apply.mjs";

const ROOT = repoRoot();
const SPARK = process.env.META_SPARK_MODEL || "muse-spark-1.3";
const WONDER = process.env.META_WONDER_MODEL || "muse-wonder-1.0";
const STATE = join(ROOT, "scripts/muse-build/state");
const LOG = join(ROOT, "docs/BUILD_LOG.md");

// Restore prior spend if present
const spendPath = join(STATE, "spend.json");
if (existsSync(spendPath)) {
  try {
    const prev = JSON.parse(readFileSync(spendPath, "utf8"));
    for (const c of prev.calls || []) {
      spend.calls.push(c);
      spend.total = Math.max(spend.total, c.totalUsd || 0);
    }
  } catch {
    /* ignore */
  }
}

const TASK = {
  id: "meta-client-timeout-doc",
  title: "Document Meta client timeout + retry in .env.example comment block",
  files: [".env.example"],
  instructions:
    "Using a single patch op, append a short commented section to .env.example explaining META_REQUEST_TIMEOUT_MS, retry behavior (429/5xx), and that keys must never be committed. Do not remove existing lines. Return JSON ops only.",
};

async function main() {
  if (!spend.canAfford(0.2)) {
    console.error("Spend cap hit", spend.summary());
    process.exit(1);
  }

  const file = readRepoFile(".env.example", 4000);
  console.log(`[Spark] ${TASK.id}`);
  const spark = await chat({
    model: SPARK,
    role: "contributor",
    taskId: TASK.id,
    response_format: { type: "json_object" },
    max_completion_tokens: 1500,
    messages: [
      {
        role: "developer",
        content:
          'Return ONLY compact JSON: {"notes":string,"ops":[{"op":"append"|"patch","path":".env.example","content"?:string,"find"?:string,"replace"?:string}]}. Prefer one append of ≤12 comment lines. No secrets.',
      },
      {
        role: "user",
        content: JSON.stringify({ task: TASK, file }),
      },
    ],
  });

  const payload = extractJson(spark.content);
  const applyResults = applyOps(payload.ops || []);
  console.log("apply", applyResults);

  let review = null;
  if (spend.canAfford(0.15) && applyResults.some((r) => r.ok)) {
    console.log(`[Wonder] review ${TASK.id}`);
    const after = readRepoFile(".env.example", 4000);
    const rev = await chat({
      model: WONDER,
      role: "reviewer",
      taskId: TASK.id,
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
      messages: [
        {
          role: "developer",
          content:
            'Review the .env.example change. Return {"approved":boolean,"score":1-10,"feedback":string,"followupOps":[]}',
        },
        {
          role: "user",
          content: JSON.stringify({ task: TASK, applyResults, after }),
        },
      ],
    });
    review = extractJson(rev.content);
  }

  writeFileSync(
    join(STATE, `task-${TASK.id}.json`),
    JSON.stringify({ task: TASK, payload, applyResults, review }, null, 2),
  );
  writeFileSync(
    spendPath,
    JSON.stringify({ summary: spend.summary(), calls: spend.calls }, null, 2),
  );

  // Append success section to BUILD_LOG
  const extra = `

## Continued Muse pass (patch-sized)

### ${TASK.id} — ${TASK.title}
- Spark notes: ${payload.notes || ""}
- Apply: ${applyResults.map((a) => `${a.ok ? "OK" : "FAIL"} ${a.op} ${a.path}`).join("; ")}
- Wonder review: ${review ? `${review.approved ? "approved" : "changes"} (score ${review.score}) — ${review.feedback}` : "n/a"}

### Spend after continue
- Estimated spend: **$${spend.summary().totalUsd}** / $${spend.summary().capUsd}
`;
  if (existsSync(LOG)) {
    writeFileSync(LOG, readFileSync(LOG, "utf8") + extra);
  }
  console.log("Spend", spend.summary());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
