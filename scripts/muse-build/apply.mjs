import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  appendFileSync,
} from "fs";
import { dirname, join, resolve, relative } from "path";

const ROOT = resolve(join(dirname(new URL(import.meta.url).pathname), "../.."));

const BLOCKED = [
  /^\.env\.local$/i,
  /^\.env\.[^.]+\.local$/i,
  /^\.env$/i,
  /meta_api_key/i,
  /^uploads\//i,
  /^\.git\//i,
  /node_modules\//i,
];
// .env.example is intentionally allowed (no secrets)

export function repoRoot() {
  return ROOT;
}

export function safePath(relPath) {
  const cleaned = relPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (cleaned.includes("..")) throw new Error(`Path traversal blocked: ${relPath}`);
  for (const re of BLOCKED) {
    if (re.test(cleaned)) throw new Error(`Blocked path: ${cleaned}`);
  }
  const abs = resolve(ROOT, cleaned);
  if (!abs.startsWith(ROOT)) throw new Error(`Escapes root: ${cleaned}`);
  return { abs, rel: relative(ROOT, abs) };
}

export function readRepoFile(relPath, maxChars = 12000) {
  const { abs, rel } = safePath(relPath);
  if (!existsSync(abs)) return { rel, exists: false, content: null };
  const content = readFileSync(abs, "utf8");
  return {
    rel,
    exists: true,
    content:
      content.length > maxChars
        ? content.slice(0, maxChars) + "\n/* …truncated… */\n"
        : content,
  };
}

export function listKeyPaths() {
  const interesting = [
    "package.json",
    "README.md",
    "SUBMISSION.md",
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/components/benchmate/app-shell.tsx",
    "src/lib/config.ts",
    "src/lib/meta-client.ts",
    "src/lib/sam-client.ts",
    "src/lib/agent/vision.ts",
    "src/lib/agent/agent-loop.ts",
    "src/lib/agent/verifier.ts",
    "src/lib/agent/report-writer.ts",
    "src/lib/tools/index.ts",
    "src/lib/demo/fixtures.ts",
    "scripts/demo-record.mjs",
    ".env.example",
  ];
  return interesting.map((p) => {
    const { abs, rel } = safePath(p);
    return { path: rel, exists: existsSync(abs) };
  });
}

/**
 * Apply Spark file ops: { op: "write"|"patch"|"append", path, content, find?, replace? }
 */
export function applyOps(ops = []) {
  const results = [];
  for (const op of ops) {
    try {
      const { abs, rel } = safePath(op.path);
      mkdirSync(dirname(abs), { recursive: true });
      if (op.op === "write") {
        writeFileSync(abs, op.content ?? "", "utf8");
        results.push({ ok: true, op: "write", path: rel, bytes: (op.content || "").length });
      } else if (op.op === "append") {
        appendFileSync(abs, op.content ?? "", "utf8");
        results.push({ ok: true, op: "append", path: rel });
      } else if (op.op === "patch") {
        if (!existsSync(abs)) throw new Error("file missing for patch");
        const prev = readFileSync(abs, "utf8");
        if (!op.find) throw new Error("patch requires find");
        if (!prev.includes(op.find)) throw new Error("find string not in file");
        const next = prev.replace(op.find, op.replace ?? "");
        writeFileSync(abs, next, "utf8");
        results.push({ ok: true, op: "patch", path: rel });
      } else {
        throw new Error(`Unknown op ${op.op}`);
      }
    } catch (err) {
      results.push({
        ok: false,
        op: op.op,
        path: op.path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
