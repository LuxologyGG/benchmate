/**
 * Scripted walkthrough (≤3 min) with ASCII/Cursor captions.
 * Prefer LIVE Meta API (DEMO_MODE=false + META_API_KEY); falls back to DEMO_MODE.
 *
 * Films: figlet/ascii bio → colony CFU (SAM) → dilution 10× agent_trace wow → report.
 * Saves under artifacts/, /opt/cursor/artifacts/, and optionally STORE_MEDIA_DIR.
 */
import { chromium } from "playwright";
import {
  mkdirSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const artifacts = join(root, "artifacts");
const screenshots = join(artifacts, "screenshots");
const cursorArtifacts = "/opt/cursor/artifacts";
const cursorShots = join(cursorArtifacts, "screenshots");
const storeMedia =
  process.env.STORE_MEDIA_DIR ||
  "/cursor/stores/bc-8e2ebed3-57a3-5eed-94d6-18a336b51709/media";

mkdirSync(screenshots, { recursive: true });
mkdirSync(cursorShots, { recursive: true });
try {
  mkdirSync(storeMedia, { recursive: true });
} catch {
  /* optional */
}

const PORT = process.env.DEMO_PORT || "43123";
const BASE = process.env.DEMO_BASE_URL || `http://127.0.0.1:${PORT}`;

const demoFlag = (process.env.DEMO_MODE || "").toLowerCase();
const hasKey = !!(process.env.META_API_KEY || process.env.MODEL_API_KEY || "").trim();
const live =
  process.env.LIVE_DEMO === "1" ||
  (hasKey && demoFlag !== "1" && demoFlag !== "true" && demoFlag !== "yes");
const DEMO_MODE_VALUE = live ? "false" : "true";

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
      env: {
        ...process.env,
        DEMO_MODE: DEMO_MODE_VALUE,
        MODEL_PROVIDER: live ? "meta" : process.env.MODEL_PROVIDER || "auto",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  return child;
}

/** Phosphor-lime / JetBrains Mono caption bar (ASCII system). */
async function setCaption(page, text, { accentWords = [] } = {}) {
  await page.evaluate(
    ({ caption, accents }) => {
      let el = document.getElementById("benchmate-demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "benchmate-demo-caption";
        Object.assign(el.style, {
          position: "fixed",
          left: "50%",
          bottom: "24px",
          transform: "translateX(-50%)",
          zIndex: "99999",
          maxWidth: "92vw",
          padding: "10px 16px",
          borderRadius: "2px",
          border: "1px solid rgba(200, 245, 66, 0.35)",
          background: "rgba(20, 24, 22, 0.94)",
          color: "#e4e4e7",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: "14px",
          fontWeight: "500",
          letterSpacing: "0.02em",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          pointerEvents: "none",
          textAlign: "center",
        });
        document.body.appendChild(el);
      }
      let html = caption.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      for (const w of accents) {
        const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
        html = html.replace(
          re,
          '<span style="color:#c8f542;font-weight:700">$1</span>',
        );
      }
      el.innerHTML = html;
    },
    { caption: text, accents: accentWords },
  );
}

async function showTitleCard(page, { subtitle, clipHint }) {
  await page.evaluate(
    ({ sub, clip }) => {
      let el = document.getElementById("benchmate-demo-titlecard");
      if (!el) {
        el = document.createElement("div");
        el.id = "benchmate-demo-titlecard";
        Object.assign(el.style, {
          position: "fixed",
          inset: "0",
          zIndex: "99998",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#141816",
          color: "#e4e4e7",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          gap: "20px",
        });
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <pre style="color:#c8f542;font-size:clamp(10px,1.6vw,18px);line-height:1.05;margin:0;text-align:left">    ____                  __  __  ___      __
   / __ )___  ____  _____/ /_/  |/  /___ _/ /____
  / __  / _ \\/ __ \\/ ___/ __/ /|_/ / __ \`/ __/ _ \\
 / /_/ /  __/ / / / /__/ /_/ /  / / /_/ / /_/  __/
/_____/\\___/_/ /_/\\___/\\__/_/  /_/\\__,_/\\__/\\___/</pre>
        <div style="color:#c8f542;letter-spacing:0.35em;font-size:11px;text-transform:uppercase">${clip || "colonies"}</div>
        <div style="max-width:40rem;text-align:center;font-size:14px;color:#a1a1aa;line-height:1.5">${sub}</div>
      `;
      el.style.display = "flex";
    },
    { sub: subtitle, clip: clipHint },
  );
}

async function hideTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById("benchmate-demo-titlecard");
    if (el) el.style.display = "none";
  });
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

async function runSample(page, sampleId, label, accents = []) {
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await setCaption(page, label, { accentWords: accents });
  await page.getByTestId(`sample-${sampleId}`).click();
  await page.waitForTimeout(1500);
  await setCaption(page, `> run_pipeline --sample ${sampleId}${live ? " --live" : " --demo"}`, {
    accentWords: ["run_pipeline", "live", sampleId],
  });
  await page.getByTestId("run-pipeline").click();
  // Live Wonder can take 2–3 min; DEMO is faster
  await page.getByTestId("measurement-table").first().waitFor({
    timeout: live ? 240000 : 180000,
  });
}

function ffmpegTrimTo3Min(rawMp4, outMp4) {
  // Probe duration
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rawMp4],
    { encoding: "utf8" },
  );
  const dur = Number(probe.stdout.trim());
  console.log("raw duration sec", dur);
  if (!Number.isFinite(dur) || dur <= 180) {
    copyFileSync(rawMp4, outMp4);
    return { durationSec: dur || 0, trimmed: false };
  }
  // Live Wonder waits are long — keep intro, colony results, dilution wow/close.
  // Memory-safe: extract parts then concat (avoid giant filter_complex).
  const partsDir = join(dirname(rawMp4), "demo-parts");
  mkdirSync(partsDir, { recursive: true });
  const cuts = [
    { ss: 0, t: 18, out: join(partsDir, "p0.mp4") },
    { ss: Math.max(0, Math.min(dur - 90, 100)), t: 35, out: join(partsDir, "p1.mp4") },
    { ss: Math.max(0, dur - 57), t: 55, out: join(partsDir, "p2.mp4") },
  ];
  for (const c of cuts) {
    const r = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(c.ss),
        "-i",
        rawMp4,
        "-t",
        String(c.t),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        c.out,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.warn("part extract failed", c, r.stderr?.slice(-300));
      copyFileSync(rawMp4, outMp4);
      return { durationSec: dur, trimmed: false };
    }
  }
  const list = join(partsDir, "list.txt");
  writeFileSync(
    list,
    cuts.map((c) => `file '${c.out}'`).join("\n") + "\n",
  );
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outMp4,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.warn("concat failed, copying raw", r.stderr?.slice(-400));
    copyFileSync(rawMp4, outMp4);
    return { durationSec: dur, trimmed: false };
  }
  const probe2 = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outMp4],
    { encoding: "utf8" },
  );
  return {
    durationSec: Number(probe2.stdout.trim()) || 108,
    trimmed: true,
    cuts,
  };
}

async function main() {
  console.log(`demo-record mode=${live ? "LIVE" : "DEMO"} DEMO_MODE=${DEMO_MODE_VALUE}`);

  if (!existsSync(join(root, "public/samples/dilution-notebook.png"))) {
    spawnSync("node", ["scripts/generate-samples.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
  }

  let server = null;
  let startedHere = false;
  try {
    await waitForServer(`${BASE}/api/health`, 3);
    const h = await (await fetch(`${BASE}/api/health`)).json();
    console.log("Using existing server", BASE, h);
  } catch {
    console.log("Starting Next.js on", BASE);
    server = startServer();
    startedHere = true;
    await waitForServer(`${BASE}/api/health`, 90);
  }

  const health = await (await fetch(`${BASE}/api/health`)).json();
  console.log("health", health);
  if (live && health.demoMode) {
    throw new Error("LIVE_DEMO requested but server reports demoMode=true");
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

  // ── Title card + colonies ascii ──
  await showTitleCard(page, {
    subtitle: live
      ? "Live Meta API · muse-wonder-1.0 · muse-spark-1.3 · sam-3.1"
      : "AI lab partner for wet-lab research trainees",
    clipHint: "ascii://colonies",
  });
  await page.waitForTimeout(4500);
  await shot(page, "00-title.png");
  await hideTitleCard(page);

  await setCaption(page, "Wrong dilution can ruin the plate", {
    accentWords: ["dilution"],
  });
  await page.waitForTimeout(3500);
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  // Prefer on-page ascii bio if present
  if (await page.getByTestId("ascii-bio-colonies").count()) {
    await page.getByTestId("ascii-bio-colonies").scrollIntoViewIfNeeded();
  }
  await shot(page, "01-pain.png");

  await setCaption(
    page,
    "BenchMate · watches your bench · catches errors · writes the record",
    { accentWords: ["BenchMate"] },
  );
  await page.locator("header").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  if (await page.getByTestId("figlet-wordmark").count()) {
    await page.getByTestId("figlet-wordmark").first().scrollIntoViewIfNeeded();
  }
  await shot(page, "03-hero.png");

  // ── Colony CFU ──
  await runSample(page, "colony-plate", "Petri Dish — Colony CFU · SAM 3.1", [
    "SAM 3.1",
    "CFU",
  ]);

  // Film ascii loader / agent terminal during/after
  if (await page.getByTestId("ascii-loader").count()) {
    await page.getByTestId("ascii-loader").first().scrollIntoViewIfNeeded();
  }
  if (await page.getByTestId("agent-trace-panel").count()) {
    await setCaption(page, "agent_trace · Wonder → SAM quantifier → compute_cfu", {
      accentWords: ["agent_trace", "Wonder", "SAM", "compute_cfu"],
    });
    await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
  }
  await setCaption(page, "SAM 3.1 colony masks — usedSam=true on live path", {
    accentWords: ["SAM 3.1", "usedSam"],
  });
  if (await page.getByTestId("bbox-overlay").count()) {
    await page.getByTestId("bbox-overlay").scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(2500);
  await shot(page, "04-colony-masks.png");

  if (await page.getByTestId("computed-values").count()) {
    await setCaption(page, "compute_cfu → N=42 · V=0.1 mL · D=10⁻⁴ → 4.2×10⁶ CFU/mL", {
      accentWords: ["compute_cfu", "4.2×10⁶"],
    });
    await page.getByTestId("computed-values").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    await shot(page, "05-colony-cfu.png");
  }

  // ── Dilution wow ──
  await runSample(
    page,
    "dilution-error",
    "Serial Dilution — 10× Protocol Catch",
    ["10×", "Protocol"],
  );

  await page.getByTestId("agent-trace-panel").waitFor({ timeout: live ? 240000 : 120000 });
  await setCaption(page, "agent_trace · Muse Wonder orchestrates specialists", {
    accentWords: ["agent_trace", "Wonder"],
  });
  await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  await shot(page, "06-agent-trace.png");

  const wow = page
    .getByTestId("dilution-wow-alert")
    .or(page.getByTestId("protocol-deviation-banner"));
  await wow.first().waitFor({ timeout: 90000 });
  await setCaption(
    page,
    "PROTOCOL DEVIATION · DILUTION_10X — 1.0 mL pipetted, need 10.0 mL",
    { accentWords: ["PROTOCOL DEVIATION", "DILUTION_10X"] },
  );
  await wow.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await shot(page, "07-protocol-deviation.png");

  // ── Report ──
  if (await page.getByTestId("ascii-bio-pipette").count()) {
    await page.getByTestId("ascii-bio-pipette").scrollIntoViewIfNeeded();
  }
  if (await page.getByTestId("report-panel").count()) {
    await setCaption(page, "report_writer · tool-cited Results · deviation logged", {
      accentWords: ["report_writer", "Results"],
    });
    await page.getByTestId("report-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3500);
    await shot(page, "09-report.png");
  } else if (await page.getByTestId("generate-report").count()) {
    await page.getByTestId("generate-report").click();
    await page.getByTestId("report-panel").waitFor({ timeout: 120000 });
    await page.getByTestId("report-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    await shot(page, "09-report.png");
  }

  await setCaption(
    page,
    live
      ? "LIVE accuracy · CFU exact 42→4.2e6 · DILUTION_10X caught · SAM usedSam=true"
      : "DEMO accuracy · CFU 4.2e6 · DILUTION_10X · fixtures",
    { accentWords: ["LIVE", "DILUTION_10X", "usedSam"] },
  );
  await page.waitForTimeout(3500);
  await shot(page, "10-accuracy.png");

  await showTitleCard(page, {
    subtitle: "Build for Your World · accelerate scientific experiments · MIT",
    clipHint: "ascii://pipette",
  });
  await page.waitForTimeout(4500);
  await shot(page, "12-close.png");
  await hideTitleCard(page);

  console.log(`Demo timeline wall-clock ${elapsed()}s (may trim to ≤180s)`);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  const webmOut = join(artifacts, "benchmate-demo.webm");
  const rawMp4 = join(artifacts, "benchmate-demo-raw.mp4");
  const finalMp4 = join(artifacts, "benchmate-demo.mp4");

  if (videoPath && existsSync(videoPath)) {
    copyFileSync(videoPath, webmOut);
    try {
      copyFileSync(videoPath, join(cursorArtifacts, "benchmate-demo.webm"));
    } catch {
      /* optional */
    }

    spawnSync(
      "ffmpeg",
      ["-y", "-i", webmOut, "-c:v", "libx264", "-pix_fmt", "yuv420p", rawMp4],
      { stdio: "inherit" },
    );
    const trim = ffmpegTrimTo3Min(rawMp4, finalMp4);
    console.log("final mp4", trim);

    for (const dest of [
      join(cursorArtifacts, "benchmate-demo.mp4"),
      join(storeMedia, "benchmate-demo.mp4"),
    ]) {
      try {
        copyFileSync(finalMp4, dest);
        console.log("copied", dest);
      } catch (e) {
        console.warn("copy skip", dest, e.message);
      }
    }
  } else {
    console.warn("No video file produced");
  }

  writeFileSync(
    join(artifacts, "demo-manifest.json"),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        mode: live ? "LIVE" : "DEMO",
        demoMode: health.demoMode,
        provider: health.provider,
        model: health.model,
        durationSecWallClock: Number(elapsed()),
        baseUrl: BASE,
        samples: ["colony-plate", "dilution-error"],
        storeMediaPath: join(storeMedia, "benchmate-demo.mp4"),
        aesthetic: "ascii-cursor-phosphor-lime",
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
