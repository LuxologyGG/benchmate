/**
 * Static export of the Course Lab page for GitHub Pages → ./out
 * API routes and the classic (server-backed) app are moved aside during the build, then restored.
 * Usage: npm run build:static
 */
import { execSync } from "node:child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";

const aside = [
  ["src/app/api", ".static-aside-api"],
  ["src/app/classic", ".static-aside-classic"],
];
// Stale generated route types (from dev/server builds) reference the moved-aside routes; start clean.
rmSync(".next", { recursive: true, force: true });
for (const [from, to] of aside) if (existsSync(from)) renameSync(from, to);
try {
  execSync("npx next build", { stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1" } });
  writeFileSync("out/.nojekyll", "");
} finally {
  for (const [from, to] of aside) if (existsSync(to)) renameSync(to, from);
}
