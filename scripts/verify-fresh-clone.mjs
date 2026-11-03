/**
 * Verifies fresh-clone DEMO_MODE path after `npm install`.
 *
 *   npm install
 *   cp .env.example .env.local
 *   npm run generate:colony-fixtures   # if fixtures/colony-eval missing
 *   npm run test:tools
 *   DEMO_MODE=1 npm run eval:colony
 *   DEMO_MODE=1 npm run test:e2e
 *   npm run test:live-smoke            # self-skips without key
 *   DEMO_MODE=1 npm run dev -- -p 43123
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs", "eval");
mkdirSync(outDir, { recursive: true });

function run(cmd, args, env = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
  }
}

const steps = [];
function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
}

try {
  record(
    "node_modules present",
    existsSync(join(root, "node_modules", "next")),
    "run npm install first",
  );
  if (!existsSync(join(root, "node_modules", "next"))) {
    throw new Error("npm install required");
  }

  record(
    "Core colony-plate fixture",
    existsSync(join(root, "fixtures", "colony-plate", "README.md")),
  );
  record(
    "public colony-plate sample",
    existsSync(join(root, "public", "samples", "colony-plate.png")),
  );

  if (!existsSync(join(root, "fixtures", "colony-eval", "labels.json"))) {
    run("npm", ["run", "generate:colony-fixtures"]);
  }
  record(
    "colony-eval fixtures",
    existsSync(join(root, "fixtures", "colony-eval", "labels.json")),
  );

  run("npm", ["run", "test:tools"]);
  record("test:tools", true);

  run("npm", ["run", "test:orchestration"]);
  record("test:orchestration", true);

  run("npm", ["run", "eval:colony"], { DEMO_MODE: "true" });
  record("eval:colony", true);

  run("npm", ["run", "test:e2e"], { DEMO_MODE: "true" });
  record("test:e2e DEMO_MODE (Wonder CFU + 10x dilution)", true);

  run("node", ["scripts/test-live-smoke.mjs"], { DEMO_MODE: "true" });
  record("test:live-smoke (optional)", true, "self-skips without key");

  const report = {
    ok: true,
    verifiedAt: new Date().toISOString(),
    commands: [
      "npm install",
      "cp .env.example .env.local",
      "npm run generate:colony-fixtures",
      "npm run test:tools",
      "npm run test:orchestration",
      "DEMO_MODE=1 npm run eval:colony",
      "DEMO_MODE=1 npm run test:e2e",
      "npm run test:live-smoke",
      "DEMO_MODE=1 npm run dev -- -p 43123",
    ],
    steps,
  };
  writeFileSync(
    join(outDir, "fresh-clone-check.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log("\nFresh-clone DEMO_MODE verification passed.");
} catch (err) {
  writeFileSync(
    join(outDir, "fresh-clone-check.json"),
    JSON.stringify(
      {
        ok: false,
        verifiedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        steps,
      },
      null,
      2,
    ) + "\n",
  );
  console.error(err);
  process.exit(1);
}
