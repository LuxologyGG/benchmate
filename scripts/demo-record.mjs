/**
 * Scripted DEMO_MODE walkthrough (~3 min) with caption overlays.
 * Saves video + screenshots under artifacts/ and /opt/cursor/artifacts/
 */
import { chromium } from "playwright";
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const artifacts = join(root, "artifacts");
const screenshots = join(artifacts, "screenshots");
const cursorArtifacts = "/opt/cursor/artifacts";
const cursorShots = join(cursorArtifacts, "screenshots");

mkdirSync(screenshots, { recursive: true });
mkdirSync(cursorShots, { recursive: true });

const PORT = process.env.DEMO_PORT || "43123";
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${url}`);
}

function startServer() {
  const child = spawn(
    "npx",
    ["next", "dev", "-p", PORT, "-H", "127.0.0.1"],
    {
      cwd: root,
      env: { ...process.env, DEMO_MODE: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  return child;
}

async function setCaption(page, text) {
  await page.evaluate((caption) => {
    let el = document.getElementById("benchmate-demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "benchmate-demo-caption";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        maxWidth: "90vw",
        padding: "12px 20px",
        borderRadius: "999px",
        background: "rgba(15, 61, 56, 0.92)",
        color: "white",
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        fontSize: "16px",
        fontWeight: "600",
        letterSpacing: "0.01em",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        textAlign: "center",
      });
      document.body.appendChild(el);
    }
    el.textContent = caption;
  }, text);
}

async function shot(page, name) {
  const path = join(screenshots, name);
  await page.screenshot({ path, fullPage: false });
  try {
    copyFileSync(path, join(cursorShots, name));
  } catch {
    /* optional */
  }
  console.log("screenshot", name);
}

async function main() {
  let server = null;
  let startedHere = false;
  try {
    await waitForServer(`${BASE}/api/health`, 3);
    console.log("Using existing server on", BASE);
  } catch {
    console.log("Starting Next.js on", BASE);
    server = startServer();
    startedHere = true;
    await waitForServer(`${BASE}/api/health`, 90);
  }

  const videoDir = join(artifacts, "video-tmp");
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  const t0 = Date.now();
  const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1);

  await page.goto(BASE, { waitUntil: "networkidle" });
  await setCaption(page, "BenchMate · Meta Global AI Developer Hackathon");
  await page.waitForTimeout(4000);
  await shot(page, "01-hero.png");

  await setCaption(
    page,
    "Problem: handwritten notebooks + instrument screens → verified reports",
  );
  await page.waitForTimeout(5000);
  await shot(page, "02-problem.png");

  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await setCaption(page, "DEMO_MODE · Load Beer's law CuSO₄ sample");
  await page.getByTestId("sample-beers-law").click();
  await page.waitForTimeout(2500);
  await shot(page, "03-sample-selected.png");

  await setCaption(page, "Run agentic pipeline (vision → tools → verify → report)");
  await page.getByTestId("run-pipeline").click();

  // Prefer success path; if live API errors, fall back to DEMO_MODE reload once
  try {
    await page.getByTestId("measurement-table").waitFor({ timeout: 180000 });
  } catch {
    console.warn("Live pipeline slow/failed — restarting page with DEMO_MODE hint via fixture path");
    await page.goto(`${BASE}?demo=1`, { waitUntil: "networkidle" });
    await setCaption(page, "DEMO_MODE fallback fixtures (live path available with META_API_KEY)");
    await page.getByTestId("sample-beers-law").click();
    await page.waitForTimeout(1500);
    await page.getByTestId("run-pipeline").click();
    await page.getByTestId("measurement-table").waitFor({ timeout: 120000 });
  }
  await setCaption(page, "Vision: Muse Spark extracts units + sig figs");
  await page.waitForTimeout(4000);
  await page.getByTestId("bbox-overlay").scrollIntoViewIfNeeded();
  await shot(page, "04-vision-bboxes.png");
  await page.waitForTimeout(3500);

  await page.getByTestId("agent-steps").waitFor({ timeout: 240000 });
  await setCaption(
    page,
    "Tools: linear_regression · beers_law_concentration — code, not LLM math",
  );
  await page.getByTestId("computed-values").scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await shot(page, "05-tools-computed.png");

  if (await page.getByTestId("calibration-chart").count()) {
    await page.getByTestId("calibration-chart").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3500);
    await shot(page, "06-calibration-chart.png");
  }

  await page.getByTestId("verify-panel").waitFor({ timeout: 240000 });
  await setCaption(page, "Verifier: second Muse pass flags inconsistencies");
  await page.getByTestId("verify-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await shot(page, "07-verifier.png");

  await setCaption(page, "Confirm flagged cells");
  await page.getByTestId("confirm-all").click();
  await page.waitForTimeout(2000);

  await setCaption(page, "Report writer: Introduction → Conclusion");
  await page.getByTestId("generate-report").click();
  await page.getByTestId("report-panel").waitFor({ timeout: 240000 });
  await page.getByTestId("report-markdown").scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);
  await shot(page, "08-report.png");

  await setCaption(page, "Export Markdown · PDF · DOCX with tool citations");
  await page.getByTestId("export-md").click();
  await page.waitForTimeout(2000);
  await page.getByTestId("export-pdf").click();
  await page.waitForTimeout(2500);

  // Pad to ~3 minutes if needed
  const soFar = Date.now() - t0;
  const targetMs = 170_000;
  if (soFar < targetMs) {
    await setCaption(
      page,
      "BenchMate · Muse Spark + deterministic tools · MIT · Camron Farjami (U-M)",
    );
    await page.locator("header").scrollIntoViewIfNeeded();
    await page.waitForTimeout(targetMs - soFar);
  }

  await shot(page, "09-close.png");
  console.log(`Demo timeline ${elapsed()}s`);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  const webmOut = join(artifacts, "benchmate-demo.webm");
  if (videoPath && existsSync(videoPath)) {
    copyFileSync(videoPath, webmOut);
    try {
      copyFileSync(videoPath, join(cursorArtifacts, "benchmate-demo.webm"));
    } catch {
      /* optional */
    }
    console.log("Saved", webmOut);

    // Best-effort mp4 via ffmpeg if present
    try {
      await new Promise((resolve, reject) => {
        const ff = spawn(
          "ffmpeg",
          ["-y", "-i", webmOut, "-c:v", "libx264", "-pix_fmt", "yuv420p", join(artifacts, "benchmate-demo.mp4")],
          { stdio: "inherit" },
        );
        ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg " + code))));
      });
      copyFileSync(
        join(artifacts, "benchmate-demo.mp4"),
        join(cursorArtifacts, "benchmate-demo.mp4"),
      );
      console.log("Saved mp4");
    } catch (e) {
      console.warn("mp4 conversion skipped:", e.message);
    }
  } else {
    console.warn("No video file produced");
  }

  writeFileSync(
    join(artifacts, "demo-manifest.json"),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        durationSecApprox: Number(elapsed()),
        baseUrl: BASE,
        screenshots: [
          "01-hero.png",
          "02-problem.png",
          "03-sample-selected.png",
          "04-vision-bboxes.png",
          "05-tools-computed.png",
          "06-calibration-chart.png",
          "07-verifier.png",
          "08-report.png",
          "09-close.png",
        ],
        video: "benchmate-demo.webm",
      },
      null,
      2,
    ),
  );

  if (startedHere && server) {
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
