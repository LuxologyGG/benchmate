/**
 * Scripted DEMO_MODE walkthrough (~3 min) with caption overlays.
 * Films Core colony CFU (SAM masks) + Orchestration Serial Dilution 10× wow
 * (live agent trace + protocol deviation banner), then report / accuracy close.
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

async function runSample(page, sampleId, label) {
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await setCaption(page, label);
  await page.getByTestId(`sample-${sampleId}`).click();
  await page.waitForTimeout(2000);
  await setCaption(page, `Run pipeline · ${sampleId}`);
  await page.getByTestId("run-pipeline").click();
  // Orchestrate may render measurement tables in both extract + verify panels
  await page.getByTestId("measurement-table").first().waitFor({ timeout: 180000 });
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

  // ── 0:00–0:20 pain (no build tooling) ──
  await setCaption(page, "Wrong dilution can ruin the plate");
  await page.waitForTimeout(5000);
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await shot(page, "01-pain.png");
  await setCaption(
    page,
    "Miscounted colonies · 10× pipetting error · wasted culture — wet-lab trainees need a partner",
  );
  await page.waitForTimeout(5000);
  await shot(page, "02-problem.png");

  await page.locator("header").scrollIntoViewIfNeeded();
  await setCaption(page, "BenchMate · AI lab partner that watches your bench");
  await page.waitForTimeout(3000);
  await shot(page, "03-hero.png");

  // ── Colony CFU + SAM masks ──
  await runSample(
    page,
    "colony-plate",
    "Petri Dish — Colony CFU Count (SAM 3.1 hero)",
  );
  await setCaption(page, "SAM 3.1 colony masks — count what you see on the plate");
  await page.waitForTimeout(3500);
  if (await page.getByTestId("bbox-overlay").count()) {
    await page.getByTestId("bbox-overlay").scrollIntoViewIfNeeded();
  }
  await shot(page, "04-colony-masks.png");
  await page.waitForTimeout(2500);

  if (await page.getByTestId("computed-values").count()) {
    await setCaption(page, "compute_cfu: N=42 · V=0.1 mL · D=10⁻⁴ → 4.2×10⁶ CFU/mL");
    await page.getByTestId("computed-values").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    await shot(page, "05-colony-cfu.png");
  }

  // ── Serial Dilution 10× wow + live agent trace (through ~1:30) ──
  await runSample(
    page,
    "dilution-error",
    "Serial Dilution — 10× Protocol Catch (wow)",
  );

  await page.getByTestId("agent-trace-panel").waitFor({ timeout: 120000 });
  await setCaption(page, "Live agent trace — Muse Wonder orchestrates specialists");
  await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await shot(page, "06-agent-trace.png");

  // Protocol deviation banner / wow alert
  const wow = page.getByTestId("dilution-wow-alert").or(page.getByTestId("protocol-deviation-banner"));
  await wow.first().waitFor({ timeout: 60000 });
  await setCaption(
    page,
    "PROTOCOL DEVIATION: 10× dilution error — 1.0 mL pipetted, protocol needs 10.0 mL",
  );
  await wow.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);
  await shot(page, "07-protocol-deviation.png");

  if (await page.getByTestId("computed-values").count()) {
    await page.getByTestId("computed-values").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await shot(page, "08-dilution-math.png");
  }

  // ── Report + accuracy (~1:30–2:15) ──
  // Orchestrate may already write the report; otherwise confirm → generate
  if (await page.getByTestId("report-panel").count()) {
    await setCaption(page, "Verified report · tool-cited Results · deviation logged");
    await page.getByTestId("report-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
    await shot(page, "09-report.png");
  } else {
    if (await page.getByTestId("confirm-all").count()) {
      await setCaption(page, "Trainee confirms flagged cells");
      await page.getByTestId("confirm-all").click();
      await page.waitForTimeout(1500);
    }
    if (await page.getByTestId("generate-report").count()) {
      await page.getByTestId("generate-report").click();
    }
    await page.getByTestId("report-panel").waitFor({ timeout: 120000 });
    await setCaption(page, "Verified report · tool-cited Results · deviation logged");
    await page.getByTestId("report-markdown").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
    await shot(page, "09-report.png");
  }

  await setCaption(
    page,
    "Accuracy: CFU 4.2×10⁶ · dilution 10× catch · deterministic tools",
  );
  await page.waitForTimeout(4000);
  if (await page.getByTestId("export-pdf").count()) {
    await page.getByTestId("export-pdf").click();
    await page.waitForTimeout(2000);
  }
  await shot(page, "10-accuracy-export.png");

  // ── Model roles + close ──
  await setCaption(
    page,
    "Wonder orchestrates · Spark sees/plans/verifies/writes · SAM 3.1 segments · tools own the math",
  );
  await page.locator("header").scrollIntoViewIfNeeded();
  await page.waitForTimeout(7000);
  await shot(page, "11-model-roles.png");

  const soFar = Date.now() - t0;
  const targetMs = 165_000;
  await setCaption(
    page,
    "Build for Your World — accelerate scientific experiments · BenchMate · MIT",
  );
  if (soFar < targetMs) {
    await page.waitForTimeout(targetMs - soFar);
  } else {
    await page.waitForTimeout(4000);
  }
  await shot(page, "12-close.png");
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

    try {
      await new Promise((resolve, reject) => {
        const ff = spawn(
          "ffmpeg",
          [
            "-y",
            "-i",
            webmOut,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            join(artifacts, "benchmate-demo.mp4"),
          ],
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
        samples: ["colony-plate", "dilution-error"],
        screenshots: [
          "01-pain.png",
          "02-problem.png",
          "03-hero.png",
          "04-colony-masks.png",
          "05-colony-cfu.png",
          "06-agent-trace.png",
          "07-protocol-deviation.png",
          "08-dilution-math.png",
          "09-report.png",
          "10-accuracy-export.png",
          "11-model-roles.png",
          "12-close.png",
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
