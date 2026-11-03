#!/usr/bin/env node
/**
 * Muse build orchestrator for BenchMate.
 * - Muse Wonder (muse-wonder-1.0): planner + reviewer
 * - Muse Spark 1.3 (muse-spark-1.3): contributor / implementer
 * Spend cap ~$40 (MUSE_BUILD_SPEND_CAP). Logs docs/BUILD_LOG.md
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { chat, extractJson, listModels, spend } from "./client.mjs";
import { applyOps, listKeyPaths, readRepoFile, repoRoot } from "./apply.mjs";

const WONDER = process.env.META_WONDER_MODEL || "muse-wonder-1.0";
const SPARK = process.env.META_SPARK_MODEL || "muse-spark-1.3";
const MAX_TASKS = Number(process.env.MUSE_BUILD_MAX_TASKS || 6);
const ROOT = repoRoot();
const STATE_DIR = join(ROOT, "scripts/muse-build/state");
const LOG_PATH = join(ROOT, "docs/BUILD_LOG.md");

mkdirSync(STATE_DIR, { recursive: true });
mkdirSync(join(ROOT, "docs"), { recursive: true });

const PRODUCT_BRIEF = `BenchMate is a Meta Global AI Developer Hackathon project (deadline Nov 4 2026).
Solo builder Camron Farjami (U-M). Next.js TypeScript app: lab notebook / instrument photos → verified lab report.
Pipeline: Muse Spark vision JSON → tool-using agent (deterministic chemistry tools) → verifier → report writer → PDF/DOCX.
Providers: Meta Model API (muse-spark-1.3, sam-3.1) + Baseten Muse Spark Open + DEMO_MODE fixtures.
Must: npm run build passes, DEMO_MODE works, live META_API_KEY mode works, Playwright demo:record, README + SUBMISSION.md, MIT, push to GitHub LuxologyGG/benchmate.
UI: polished lab aesthetic (teal), not a chatbot.`;

function inventorySnippet() {
  const paths = listKeyPaths();
  const bits = paths.map((p) => `- ${p.path} ${p.exists ? "✓" : "✗"}`).join("\n");
  const pkg = readRepoFile("package.json");
  return `Key paths:\n${bits}\n\npackage.json scripts: ${pkg.exists ? JSON.stringify(JSON.parse(pkg.content).scripts) : "missing"}`;
}

async function planTasks() {
  console.log(`[Wonder] Planning with ${WONDER}…`);
  const result = await chat({
    model: WONDER,
    role: "planner",
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
    messages: [
      {
        role: "developer",
        content: `You are Muse Wonder, lead engineer for BenchMate. Break remaining work into ≤${MAX_TASKS} concrete implementation tasks for Muse Spark subagents.
Return ONLY JSON:
{"summary":string,"tasks":[{"id":string,"title":string,"priority":1-5,"files":string[],"acceptance":string,"instructions":string}]}
Focus on gaps: live Meta API robustness, SAM 3.1 wiring polish, UI empty/loading/error states, docs for Meta tooling narrative, demo overlays, export polish, tests. Do NOT ask for API keys in files. Prefer small surgical edits.`,
      },
      {
        role: "user",
        content: `${PRODUCT_BRIEF}\n\nCurrent inventory:\n${inventorySnippet()}\n\nPropose the highest-value remaining tasks.`,
      },
    ],
  });
  const plan = extractJson(result.content);
  writeFileSync(join(STATE_DIR, "plan.json"), JSON.stringify(plan, null, 2));
  return plan;
}

async function implementTask(task, priorNotes) {
  console.log(`[Spark] Implementing ${task.id}: ${task.title}`);
  const contextFiles = (task.files || []).slice(0, 6).map((f) => readRepoFile(f));
  const result = await chat({
    model: SPARK,
    role: "contributor",
    taskId: task.id,
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
    messages: [
      {
        role: "developer",
        content: `You are Muse Spark 1.3, a coding contributor. Implement ONE task by returning file operations JSON ONLY:
{"notes":string,"ops":[{"op":"write"|"patch"|"append","path":string,"content"?:string,"find"?:string,"replace"?:string}]}
Rules:
- Prefer "patch" with unique find/replace for existing files; "write" for new files.
- Never write secrets, API keys, or .env.local.
- Keep TypeScript/React valid; match existing BenchMate style (teal lab UI, shadcn).
- Keep changes focused on the task acceptance criteria.
- Paths relative to repo root (e.g. src/lib/foo.ts).`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task,
          priorNotes,
          files: contextFiles,
        }),
      },
    ],
  });
  const payload = extractJson(result.content);
  const applyResults = applyOps(payload.ops || []);
  writeFileSync(
    join(STATE_DIR, `task-${task.id}.json`),
    JSON.stringify({ task, payload, applyResults }, null, 2),
  );
  return { payload, applyResults };
}

async function reviewTask(task, implementation) {
  console.log(`[Wonder] Reviewing ${task.id}…`);
  if (!spend.canAfford(0.2)) {
    return {
      approved: false,
      skipped: true,
      feedback: "Review skipped — spend cap",
      followupOps: [],
    };
  }
  const touched = (implementation.applyResults || [])
    .filter((r) => r.ok)
    .map((r) => readRepoFile(r.path, 8000));
  const result = await chat({
    model: WONDER,
    role: "reviewer",
    taskId: task.id,
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
    messages: [
      {
        role: "developer",
        content: `You are Muse Wonder reviewing Muse Spark's BenchMate patch. Return JSON:
{"approved":boolean,"score":1-10,"feedback":string,"followupOps":[{"op":"write"|"patch"|"append","path":string,"content"?:string,"find"?:string,"replace"?:string}]}
Approve if acceptance is mostly met. Use followupOps sparingly for critical fixes only.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task,
          applyResults: implementation.applyResults,
          notes: implementation.payload?.notes,
          files: touched,
        }),
      },
    ],
  });
  const review = extractJson(result.content);
  if (Array.isArray(review.followupOps) && review.followupOps.length) {
    review.followupResults = applyOps(review.followupOps);
  }
  writeFileSync(
    join(STATE_DIR, `review-${task.id}.json`),
    JSON.stringify(review, null, 2),
  );
  return review;
}

function renderBuildLog({ models, plan, results, cursorNotes }) {
  const s = spend.summary();
  const lines = [];
  lines.push(`# BenchMate Muse Build Log`);
  lines.push(``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Meta Model API orchestration`);
  lines.push(``);
  lines.push(`| Role | Model |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Planner / lead | \`${WONDER}\` |`);
  lines.push(`| Contributor (subagent) | \`${SPARK}\` |`);
  lines.push(`| Reviewer | \`${WONDER}\` |`);
  lines.push(`| Final quality pass | Cursor agent (human-in-the-loop) |`);
  lines.push(``);
  lines.push(`Verified available models via \`GET /v1/models\`:`);
  lines.push(``);
  lines.push((models || []).map((m) => `- \`${m}\``).join("\n") || "_n/a_");
  lines.push(``);
  lines.push(`## Spend tracker`);
  lines.push(``);
  lines.push(`- Cap: **$${s.capUsd}**`);
  lines.push(`- Estimated spend: **$${s.totalUsd}**`);
  lines.push(`- Remaining: **$${s.remainingUsd}**`);
  lines.push(`- API calls: **${s.calls}**`);
  if (s.haltedReason) lines.push(`- Halted: ${s.haltedReason}`);
  lines.push(``);
  lines.push(`### Per-call ledger`);
  lines.push(``);
  lines.push(
    `| When | Role | Model | Task | Prompt tok | Completion tok | Cost USD | Running total |`,
  );
  lines.push(`| --- | --- | --- | --- | ---: | ---: | ---: | ---: |`);
  for (const c of spend.calls) {
    lines.push(
      `| ${c.at} | ${c.role} | \`${c.model}\` | ${c.taskId || "—"} | ${c.promptTokens} | ${c.completionTokens} | ${c.costUsd.toFixed(4)} | ${c.totalUsd.toFixed(4)} |`,
    );
  }
  lines.push(``);
  lines.push(`## Plan (Wonder)`);
  lines.push(``);
  lines.push(plan?.summary || "");
  lines.push(``);
  for (const t of plan?.tasks || []) {
    lines.push(`### ${t.id} — ${t.title}`);
    lines.push(`- Priority: ${t.priority}`);
    lines.push(`- Files: ${(t.files || []).join(", ")}`);
    lines.push(`- Acceptance: ${t.acceptance}`);
    lines.push(``);
  }
  lines.push(`## Execution results`);
  lines.push(``);
  for (const r of results) {
    lines.push(`### ${r.task.id} — ${r.task.title}`);
    lines.push(`- Spark notes: ${r.implementation?.payload?.notes || ""}`);
    lines.push(
      `- Apply: ${(r.implementation?.applyResults || [])
        .map((a) => `${a.ok ? "OK" : "FAIL"} ${a.op} ${a.path}${a.error ? " (" + a.error + ")" : ""}`)
        .join("; ") || "none"}`,
    );
    lines.push(
      `- Wonder review: ${r.review?.approved ? "approved" : "changes requested"} (score ${r.review?.score ?? "?"}) — ${r.review?.feedback || ""}`,
    );
    lines.push(``);
  }
  lines.push(`## Cursor final quality pass`);
  lines.push(``);
  lines.push(cursorNotes || "_Pending Cursor polish (build, demo, push)._");
  lines.push(``);
  lines.push(`## Why this matters for the hackathon`);
  lines.push(``);
  lines.push(
    `BenchMate is not only *powered by* Muse at runtime — it was partially *built by* Muse Wonder + Muse Spark in an orchestrated planner/contributor/reviewer loop, with a hard spend governor and a Cursor final pass. That is a concrete “Use of Meta AI Tooling” story for judges.`,
  );
  lines.push(``);
  return lines.join("\n");
}

async function main() {
  console.log("Repo root:", ROOT);
  let models = [];
  try {
    models = await listModels();
    console.log("Models:", models.join(", "));
    if (!models.includes(WONDER)) {
      console.warn(`Warning: ${WONDER} not in /v1/models list`);
    }
    if (!models.includes(SPARK)) {
      console.warn(`Warning: ${SPARK} not in /v1/models list`);
    }
  } catch (err) {
    console.error("Failed to list models:", err.message);
    spend.halt(err.message);
    writeFileSync(
      LOG_PATH,
      renderBuildLog({
        models: [],
        plan: { summary: "Aborted before plan", tasks: [] },
        results: [],
        cursorNotes: `Model list failed: ${err.message}`,
      }),
    );
    process.exit(1);
  }

  let plan;
  try {
    plan = await planTasks();
  } catch (err) {
    console.error("Planning failed:", err.message);
    writeFileSync(
      LOG_PATH,
      renderBuildLog({
        models,
        plan: { summary: `Planning failed: ${err.message}`, tasks: [] },
        results: [],
        cursorNotes: "Cursor will finish remaining work without Muse plan.",
      }),
    );
    process.exit(1);
  }

  const tasks = (plan.tasks || [])
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .slice(0, MAX_TASKS);

  const results = [];
  const priorNotes = [];

  for (const task of tasks) {
    if (!spend.canAfford(0.35)) {
      console.warn("Stopping task loop — spend cap:", spend.summary());
      break;
    }
    try {
      const implementation = await implementTask(task, priorNotes.slice(-5));
      priorNotes.push(`${task.id}: ${implementation.payload?.notes || ""}`);
      let review = { approved: true, feedback: "review skipped", score: null };
      if (spend.canAfford(0.25)) {
        review = await reviewTask(task, implementation);
      }
      results.push({ task, implementation, review });
    } catch (err) {
      console.error(`Task ${task.id} failed:`, err.message);
      if (spend.haltedReason) break;
      results.push({
        task,
        implementation: { payload: { notes: err.message }, applyResults: [] },
        review: { approved: false, feedback: err.message },
      });
    }
  }

  const log = renderBuildLog({
    models,
    plan,
    results,
    cursorNotes:
      "Cursor will run `npm run build`, fix any failures, polish live DEMO vs API mode, record demo video, update README/SUBMISSION, and push to GitHub.",
  });
  writeFileSync(LOG_PATH, log);
  writeFileSync(
    join(STATE_DIR, "spend.json"),
    JSON.stringify({ summary: spend.summary(), calls: spend.calls }, null, 2),
  );
  console.log("Wrote", LOG_PATH);
  console.log("Spend summary:", spend.summary());
}

main().catch((err) => {
  console.error(err);
  try {
    writeFileSync(
      LOG_PATH,
      renderBuildLog({
        models: [],
        plan: { summary: "Fatal error", tasks: [] },
        results: [],
        cursorNotes: String(err?.message || err),
      }),
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
