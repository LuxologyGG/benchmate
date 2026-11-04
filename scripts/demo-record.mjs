/**
 * BenchMate demo v4 — LIVE Meta API walkthrough ≤2:00 with ASCII captions.
 * Films: problem hook → colony CFU (SAM) → dilution 10× agent_trace wow →
 * gel 15 bands (live /api/quant) → lab record → Build for Your World close.
 *
 * Outputs: artifacts/BenchMate-demo-v4.mp4 (+ store media/BenchMate-demo-v4.mp4)
 * Also copies to benchmate-demo.mp4 as canonical alias.
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
const MAX_SEC = Number(process.env.DEMO_MAX_SEC || 118);

const demoFlag = (process.env.DEMO_MODE || "").toLowerCase();
const hasKey = !!(process.env.META_API_KEY || process.env.MODEL_API_KEY || "").trim();
const live =
  process.env.LIVE_DEMO === "1" ||
  (hasKey && demoFlag !== "1" && demoFlag !== "true" && demoFlag !== "yes");
const DEMO_MODE_VALUE = live ? "false" : "true";

/** Beat markers for post-trim (wall-clock sec from t0). */
const beats = [];

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

function mark(name, t0) {
  const sec = (Date.now() - t0) / 1000;
  beats.push({ name, sec: Number(sec.toFixed(2)) });
  console.log(`beat ${name} @ ${sec.toFixed(1)}s`);
  return sec;
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
      // Accent plain text first — never regex-replace inside style attrs
      // (e.g. accenting "42" must not match #c8f542).
      const esc = (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const sorted = [...accents].sort((a, b) => b.length - a.length);
      let html = "";
      let i = 0;
      const lower = caption.toLowerCase();
      while (i < caption.length) {
        let hit = null;
        for (const w of sorted) {
          if (lower.startsWith(w.toLowerCase(), i)) {
            hit = caption.slice(i, i + w.length);
            break;
          }
        }
        if (hit) {
          html += `<span style="color:#c8f542;font-weight:700">${esc(hit)}</span>`;
          i += hit.length;
        } else {
          html += esc(caption[i]);
          i += 1;
        }
      }
      el.innerHTML = html;
    },
    { caption: text, accents: accentWords },
  );
}

async function showTitleCard(page, { subtitle, clipHint, lines = [] }) {
  await page.evaluate(
    ({ sub, clip, extra }) => {
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
          gap: "16px",
        });
        document.body.appendChild(el);
      }
      const extras = (extra || [])
        .map(
          (l) =>
            `<div style="max-width:42rem;text-align:center;font-size:13px;color:#a1a1aa;line-height:1.45">${l}</div>`,
        )
        .join("");
      el.innerHTML = `
        <pre style="color:#c8f542;font-size:clamp(10px,1.6vw,18px);line-height:1.05;margin:0;text-align:left">    ____                  __  __  ___      __
   / __ )___  ____  _____/ /_/  |/  /___ _/ /____
  / __  / _ \\/ __ \\/ ___/ __/ /|_/ / __ \`/ __/ _ \\
 / /_/ /  __/ / / / /__/ /_/ /  / / /_/ / /_/  __/
/_____/\\___/_/ /_/\\___/\\__/_/  /_/\\__,_/\\__/\\___/</pre>
        <div style="color:#c8f542;letter-spacing:0.35em;font-size:11px;text-transform:uppercase">${clip || "colonies"}</div>
        <div style="max-width:42rem;text-align:center;font-size:14px;color:#e4e4e7;line-height:1.5">${sub}</div>
        ${extras}
      `;
      el.style.display = "flex";
    },
    { sub: subtitle, clip: clipHint, extra: lines },
  );
}

async function hideTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById("benchmate-demo-titlecard");
    if (el) el.style.display = "none";
  });
}

async function showGelCard(page, { dataUrl, bandCount, usedSam, notes }) {
  await page.evaluate(
    ({ img, bands, sam, noteLines }) => {
      let el = document.getElementById("benchmate-demo-gelcard");
      if (!el) {
        el = document.createElement("div");
        el.id = "benchmate-demo-gelcard";
        Object.assign(el.style, {
          position: "fixed",
          inset: "0",
          zIndex: "99997",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "40px",
          background: "#141816",
          color: "#e4e4e7",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          padding: "40px",
        });
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <img src="${img}" alt="gel-001" style="max-height:70vh;max-width:42vw;border:1px solid rgba(200,245,66,0.35);border-radius:2px;object-fit:contain;background:#0a0c0b" />
        <div style="display:flex;flex-direction:column;gap:14px;max-width:28rem">
          <div style="color:#c8f542;letter-spacing:0.28em;font-size:11px;text-transform:uppercase">gel-001 · densitometry</div>
          <div style="font-size:42px;font-weight:700;color:#c8f542;line-height:1">${bands}<span style="font-size:18px;color:#e4e4e7;font-weight:500"> / 15 bands</span></div>
          <div style="font-size:13px;color:#a1a1aa">SAM 3.1 ∪ intensity profile · usedSam=${sam ? "true" : "false"}</div>
          <div style="font-size:12px;color:#71717a;line-height:1.5">${(noteLines || []).slice(0, 3).join("<br/>")}</div>
          <div style="margin-top:8px;font-size:13px;color:#e4e4e7">Live Meta API · exact ladder read</div>
        </div>
      `;
      el.style.display = "flex";
    },
    {
      img: dataUrl,
      bands: bandCount,
      sam: usedSam,
      noteLines: notes || [],
    },
  );
}

async function hideGelCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById("benchmate-demo-gelcard");
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

async function runSample(page, sampleId, label, accents = [], t0) {
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await setCaption(page, label, { accentWords: accents });
  await page.getByTestId(`sample-${sampleId}`).click();
  await page.waitForTimeout(900);
  mark(`sample-${sampleId}-selected`, t0);
  await setCaption(
    page,
    `> run_pipeline --sample ${sampleId}${live ? " --live" : " --demo"}`,
    { accentWords: ["run_pipeline", "live", sampleId] },
  );
  await page.getByTestId("run-pipeline").click();
  mark(`sample-${sampleId}-run`, t0);

  // Film phage / loader / agent_trace while Wonder thinks (long live waits)
  const timeoutMs =
    live && sampleId === "dilution-error"
      ? 420000
      : live
        ? 300000
        : 180000;
  const deadline = Date.now() + timeoutMs;
  let sawLoader = false;
  while (Date.now() < deadline) {
    if (!sawLoader && (await page.getByTestId("ascii-loader").count())) {
      await page.getByTestId("ascii-loader").first().scrollIntoViewIfNeeded();
      sawLoader = true;
      await setCaption(page, "ascii://phage · Muse Wonder dispatching specialists…", {
        accentWords: ["phage", "Wonder"],
      });
      await page.waitForTimeout(2600);
    }
    if (await page.getByTestId("agent-trace-panel").count()) {
      await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
    }
    // Success: measurements landed OR dilution wow banner OR report
    const ready =
      (await page.getByTestId("measurement-table").count()) > 0 ||
      (await page.getByTestId("dilution-wow-alert").count()) > 0 ||
      (await page.getByTestId("protocol-deviation-banner").count()) > 0 ||
      (await page.getByTestId("report-panel").count()) > 0;
    if (ready) break;
    if ((await page.getByTestId("error-alert").count()) > 0) {
      const errText = await page.getByTestId("error-alert").innerText();
      throw new Error(`Pipeline error on ${sampleId}: ${errText}`);
    }
    await page.waitForTimeout(1500);
  }
  const readyFinal =
    (await page.getByTestId("measurement-table").count()) > 0 ||
    (await page.getByTestId("dilution-wow-alert").count()) > 0 ||
    (await page.getByTestId("protocol-deviation-banner").count()) > 0 ||
    (await page.getByTestId("report-panel").count()) > 0;
  if (!readyFinal) {
    throw new Error(
      `Timeout waiting for ${sampleId} results after ${timeoutMs}ms`,
    );
  }
  mark(`sample-${sampleId}-done`, t0);
}

/**
 * Stitch interesting beats to ≤ MAX_SEC using recorded markers.
 * Prefer keep: intro, colony results, dilution wow, gel, report, close.
 */
function ffmpegTrimToMax(rawMp4, outMp4, markers, maxSec) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rawMp4],
    { encoding: "utf8" },
  );
  const dur = Number(probe.stdout.trim());
  console.log("raw duration sec", dur, "markers", markers);
  if (!Number.isFinite(dur) || dur <= maxSec) {
    copyFileSync(rawMp4, outMp4);
    return { durationSec: dur || 0, trimmed: false };
  }

  const find = (name) => markers.find((m) => m.name === name)?.sec ?? null;
  const introEnd = find("hook-end") ?? 10;
  const colonyDone = find("sample-colony-plate-done");
  const dilutionDone = find("sample-dilution-error-done");
  const wowStart = find("wow-start") ?? dilutionDone;
  const gelStart = find("gel-start");
  const reportStart = find("report-start");
  const closeStart = find("close-start");

  // Cuts: short intro + colony result window + dilution wow + gel + report/close
  const partsDir = join(dirname(rawMp4), "demo-parts-v4");
  mkdirSync(partsDir, { recursive: true });

  const cuts = [];
  // Intro / problem hook (~9s)
  cuts.push({ ss: 0, t: Math.min(9.5, introEnd + 0.5), out: join(partsDir, "p0.mp4"), label: "intro" });

  // Colony results: last ~22s before done (masks + CFU)
  if (colonyDone != null) {
    const start = Math.max(introEnd, colonyDone - 22);
    cuts.push({
      ss: start,
      t: Math.min(22, colonyDone - start + 2),
      out: join(partsDir, "p1.mp4"),
      label: "colony",
    });
  }

  // Dilution wow: from wow-start (or last 28s of dilution) ~28s
  if (wowStart != null) {
    const start = Math.max(0, wowStart - 4);
    const end = gelStart ?? reportStart ?? Math.min(dur, wowStart + 30);
    cuts.push({
      ss: start,
      t: Math.min(28, Math.max(12, end - start)),
      out: join(partsDir, "p2.mp4"),
      label: "dilution-wow",
    });
  } else if (dilutionDone != null) {
    cuts.push({
      ss: Math.max(0, dilutionDone - 26),
      t: 28,
      out: join(partsDir, "p2.mp4"),
      label: "dilution-wow",
    });
  }

  // Gel card (~14s)
  if (gelStart != null) {
    cuts.push({
      ss: gelStart,
      t: 14,
      out: join(partsDir, "p3.mp4"),
      label: "gel",
    });
  }

  // Report + close (~22s from report, else last 22s)
  if (reportStart != null) {
    const start = reportStart;
    const t = Math.min(24, dur - start);
    cuts.push({ ss: start, t, out: join(partsDir, "p4.mp4"), label: "report-close" });
  } else if (closeStart != null) {
    cuts.push({
      ss: Math.max(0, closeStart - 8),
      t: Math.min(22, dur - Math.max(0, closeStart - 8)),
      out: join(partsDir, "p4.mp4"),
      label: "close",
    });
  } else {
    cuts.push({
      ss: Math.max(0, dur - 20),
      t: 20,
      out: join(partsDir, "p4.mp4"),
      label: "tail",
    });
  }

  // Budget: if sum > maxSec, shrink middle holds proportionally
  let sumT = cuts.reduce((a, c) => a + c.t, 0);
  if (sumT > maxSec) {
    const scale = (maxSec - 1) / sumT;
    for (const c of cuts) c.t = Math.max(6, c.t * scale);
  }

  for (const c of cuts) {
    console.log("extract", c.label, "ss=", c.ss.toFixed?.(1) ?? c.ss, "t=", c.t.toFixed?.(1) ?? c.t);
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
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        c.out,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.warn("part extract failed", c.label, r.stderr?.slice(-400));
      copyFileSync(rawMp4, outMp4);
      return { durationSec: dur, trimmed: false, error: "extract-failed" };
    }
  }

  const list = join(partsDir, "list.txt");
  writeFileSync(list, cuts.map((c) => `file '${c.out}'`).join("\n") + "\n");
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
      "veryfast",
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
    return { durationSec: dur, trimmed: false, error: "concat-failed" };
  }
  const probe2 = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outMp4],
    { encoding: "utf8" },
  );
  return {
    durationSec: Number(probe2.stdout.trim()) || 0,
    trimmed: true,
    cuts: cuts.map(({ label, ss, t }) => ({ label, ss, t })),
  };
}

async function fileToDataUrl(filePath) {
  const buf = readFileSync(filePath);
  const b64 = buf.toString("base64");
  const ext = filePath.endsWith(".png") ? "png" : "jpeg";
  return `data:image/${ext};base64,${b64}`;
}

async function runLiveGelQuant() {
  const gelPath = join(root, "fixtures/colony-eval/images/gel-001.png");
  if (!existsSync(gelPath)) {
    throw new Error("gel-001.png missing");
  }
  const dataUrl = await fileToDataUrl(gelPath);
  const res = await fetch(`${BASE}/api/quant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, mode: "gel-densitometry" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `gel quant failed ${res.status}`);
  return { dataUrl, quant: json.quant };
}

async function main() {
  console.log(
    `demo-record v4 mode=${live ? "LIVE" : "DEMO"} DEMO_MODE=${DEMO_MODE_VALUE} maxSec=${MAX_SEC}`,
  );

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
  mark("start", t0);

  // ── 0:00–0:10 problem hook (no build tooling) ──
  await showTitleCard(page, {
    subtitle: "Wrong dilution can ruin the plate.",
    clipHint: "ascii://colonies",
    lines: [
      live
        ? "Live Meta API · muse-wonder-1.0 · muse-spark-1.3 · sam-3.1"
        : "AI lab partner for wet-lab research trainees",
    ],
  });
  await page.waitForTimeout(4200);
  await shot(page, "00-title.png");
  await hideTitleCard(page);

  await setCaption(page, "No more ruined plates from a 10× pipetting miss", {
    accentWords: ["10×"],
  });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  if (await page.getByTestId("ascii-bio-colonies").count()) {
    await page.getByTestId("ascii-bio-colonies").scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(3500);
  await shot(page, "01-pain.png");
  mark("hook-end", t0);

  await setCaption(
    page,
    "BenchMate · watches your bench · catches errors · writes the record",
    { accentWords: ["BenchMate", "watches", "catches", "writes"] },
  );
  if (await page.getByTestId("figlet-wordmark").count()) {
    await page.getByTestId("figlet-wordmark").first().scrollIntoViewIfNeeded();
  } else {
    await page.locator("header").scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(2200);
  await shot(page, "03-hero.png");

  // ── Colony CFU hero ──
  await runSample(page, "colony-plate", "Petri Dish — Colony CFU · SAM 3.1", [
    "SAM 3.1",
    "CFU",
  ], t0);

  if (await page.getByTestId("agent-trace-panel").count()) {
    await setCaption(page, "agent_trace · Wonder → SAM quantifier → compute_cfu", {
      accentWords: ["agent_trace", "Wonder", "SAM", "compute_cfu"],
    });
    await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
  }

  await setCaption(page, "SAM 3.1 colony masks — usedSam=true · N=42", {
    accentWords: ["SAM 3.1", "usedSam", "N=42"],
  });
  if (await page.getByTestId("bbox-overlay").count()) {
    await page.getByTestId("bbox-overlay").scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(2200);
  await shot(page, "04-colony-masks.png");
  mark("colony-masks", t0);

  if (await page.getByTestId("computed-values").count()) {
    await setCaption(page, "compute_cfu → N=42 · V=0.1 mL · D=10⁻⁴ → 4.2×10⁶ CFU/mL", {
      accentWords: ["compute_cfu", "4.2×10⁶", "42"],
    });
    await page.getByTestId("computed-values").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2800);
    await shot(page, "05-colony-cfu.png");
  }
  mark("colony-results-end", t0);

  // ── Dilution 10× wow ──
  await runSample(
    page,
    "dilution-error",
    "Serial Dilution — 10× Protocol Catch",
    ["10×", "Protocol"],
    t0,
  );

  await page.getByTestId("agent-trace-panel").waitFor({
    timeout: live ? 240000 : 120000,
  });
  mark("wow-start", t0);
  await setCaption(page, "agent_trace · Muse Wonder orchestrates specialists", {
    accentWords: ["agent_trace", "Wonder"],
  });
  await page.getByTestId("agent-trace-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2800);
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
  await page.waitForTimeout(3500);
  await shot(page, "07-protocol-deviation.png");
  mark("wow-end", t0);

  // ── Gel 15 bands (live quant, frugal 1 SAM call) ──
  mark("gel-start", t0);
  await setCaption(page, "Gel densitometry · SAM 3.1 ∪ intensity → 15 bands", {
    accentWords: ["15 bands", "SAM 3.1"],
  });
  console.log("Running live gel-001 quant…");
  const gel = await runLiveGelQuant();
  const bandCount =
    gel.quant?.primary?.bandCount ?? gel.quant?.primary?.colonyCount ?? 0;
  console.log("gel result", {
    bandCount,
    usedSam: gel.quant?.usedSam,
    demoMode: gel.quant?.demoMode,
    notes: gel.quant?.notes,
  });
  await showGelCard(page, {
    dataUrl: gel.dataUrl,
    bandCount,
    usedSam: !!gel.quant?.usedSam,
    notes: gel.quant?.notes || [],
  });
  await page.waitForTimeout(5200);
  await shot(page, "08-gel-bands.png");
  await hideGelCard(page);
  mark("gel-end", t0);

  // ── Lab record (report panel sits below PHOTOS — must scroll) ──
  mark("report-start", t0);
  await setCaption(page, "Lab record · tool-cited Results · deviation logged", {
    accentWords: ["Lab record", "Results", "DILUTION_10X"],
  });
  try {
    await page.getByTestId("report-panel").waitFor({ timeout: 20000 });
  } catch {
    if (await page.getByTestId("generate-report").count()) {
      await page.getByTestId("generate-report").click();
      await page.getByTestId("report-panel").waitFor({ timeout: 120000 });
    }
  }
  if (await page.getByTestId("report-panel").count()) {
    await page.getByTestId("report-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
    await shot(page, "09-report.png");
  } else {
    console.warn("report-panel missing — continuing to close");
  }

  // ── Close: Build for Your World ──
  mark("close-start", t0);
  await showTitleCard(page, {
    subtitle: "Build for Your World",
    clipHint: "ascii://pipette",
    lines: [
      "For wet-lab research trainees — not homework chatbots.",
      "Anchored in Camron Farjami’s research at USC Norris &amp; Loma Linda.",
      "Homa · homa.bio · accelerate scientific experiments",
    ],
  });
  await page.waitForTimeout(4800);
  await shot(page, "12-close.png");
  await hideTitleCard(page);
  mark("end", t0);

  console.log(`Demo timeline wall-clock ${elapsed()}s (trim to ≤${MAX_SEC}s)`);
  console.log("beats", JSON.stringify(beats, null, 2));

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  const webmOut = join(artifacts, "benchmate-demo.webm");
  const rawMp4 = join(artifacts, "benchmate-demo-raw.mp4");
  const finalMp4 = join(artifacts, "BenchMate-demo-v4.mp4");
  const aliasMp4 = join(artifacts, "benchmate-demo.mp4");

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
    // Keep full raw for archive
    try {
      copyFileSync(rawMp4, join(storeMedia, "benchmate-demo-live-full.mp4"));
    } catch {
      /* optional */
    }

    const trim = ffmpegTrimToMax(rawMp4, finalMp4, beats, MAX_SEC);
    console.log("final mp4", trim);
    copyFileSync(finalMp4, aliasMp4);

    for (const dest of [
      join(cursorArtifacts, "BenchMate-demo-v4.mp4"),
      join(cursorArtifacts, "benchmate-demo.mp4"),
      join(storeMedia, "BenchMate-demo-v4.mp4"),
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
        version: "v4",
        mode: live ? "LIVE" : "DEMO",
        demoMode: health.demoMode,
        provider: health.provider,
        model: health.model,
        durationSecWallClock: Number(elapsed()),
        maxSec: MAX_SEC,
        baseUrl: BASE,
        samples: ["colony-plate", "dilution-error", "gel-001"],
        beats,
        storeMediaPath: join(storeMedia, "BenchMate-demo-v4.mp4"),
        aesthetic: "ascii-cursor-phosphor-lime",
        framing: "Build for Your World · wet-lab trainees · Camron / USC Norris / Loma Linda",
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
