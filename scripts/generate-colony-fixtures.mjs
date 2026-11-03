/**
 * Generate labeled synthetic petri-plate and gel images for colony/band eval.
 * All pixels are original BenchMate fixtures (CC0 / public domain for this repo).
 *
 * Writes:
 *   fixtures/colony-eval/images/*.png
 *   fixtures/colony-eval/labels.json
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "fixtures", "colony-eval", "images");
mkdirSync(outDir, { recursive: true });

/** Deterministic PRNG (mulberry32) so labels stay stable across regenerations. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function placeColonies(rand, count, cx, cy, radius, minSep) {
  const colonies = [];
  let attempts = 0;
  while (colonies.length < count && attempts < count * 200) {
    attempts += 1;
    const ang = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (radius * 0.86);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    const size = 4 + rand() * 9;
    if (colonies.every((c) => dist(c.x, c.y, x, y) >= minSep + size * 0.35)) {
      colonies.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        r: Math.round(size * 10) / 10,
        color: rand() > 0.7 ? "#5a3a28" : "#2a2218",
      });
    }
  }
  return colonies;
}

async function writePlate({ id, seed, targetCount, size = 512, note }) {
  const rand = mulberry32(seed);
  const cx = size / 2;
  const cy = size / 2;
  const plateR = size * 0.42;
  const minSep = targetCount > 40 ? 7 : targetCount > 20 ? 10 : 14;
  const colonies = placeColonies(rand, targetCount, cx, cy, plateR, minSep);
  const agar = `rgb(${210 + Math.floor(rand() * 20)},${195 + Math.floor(rand() * 15)},${150 + Math.floor(rand() * 20)})`;

  const colonySvg = colonies
    .map(
      (c) =>
        `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.color}" opacity="0.92"/>`,
    )
    .join("");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="agar" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${agar}"/>
      <stop offset="100%" stop-color="#c4b48a"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#1a1f24"/>
  <circle cx="${cx}" cy="${cy}" r="${plateR + 14}" fill="#d8dde2" stroke="#8a9299" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${plateR}" fill="url(#agar)" stroke="#6e7568" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${plateR - 2}" fill="none" stroke="#ffffff22" stroke-width="8"/>
  ${colonySvg}
  <text x="16" y="${size - 16}" fill="#9aa3ad" font-family="monospace" font-size="12">${id} · n=${colonies.length}</text>
</svg>`;

  const file = `${id}.png`;
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, file));
  return {
    id,
    file,
    type: "petri_plate",
    groundTruthCount: colonies.length,
    manualCountSeconds: Math.round(8 + colonies.length * 1.4),
    colonies: colonies.map((c, i) => ({
      id: `c${i + 1}`,
      x: c.x / size,
      y: c.y / size,
      r: c.r / size,
    })),
    notes: note,
    license: "CC0-1.0",
    source: "synthetic-benchmate",
    attribution: "Original synthetic fixture generated for BenchMate eval (no third-party imagery).",
  };
}

async function writeGel({ id, seed, lanes, bandsPerLane, sizeW = 480, sizeH = 640, note }) {
  const rand = mulberry32(seed);
  const marginX = 48;
  const marginY = 56;
  const laneGap = (sizeW - marginX * 2) / lanes;
  const bands = [];

  const laneSvg = [];
  for (let L = 0; L < lanes; L++) {
    const lx = marginX + laneGap * (L + 0.5);
    const count = Array.isArray(bandsPerLane) ? bandsPerLane[L] : bandsPerLane;
    const ys = [];
    let attempts = 0;
    while (ys.length < count && attempts < count * 80) {
      attempts += 1;
      const y = marginY + 40 + rand() * (sizeH - marginY * 2 - 80);
      if (ys.every((yy) => Math.abs(yy - y) > 18)) ys.push(y);
    }
    ys.sort((a, b) => a - b);
    for (const [bi, y] of ys.entries()) {
      const thickness = 3 + rand() * 4;
      const width = laneGap * (0.55 + rand() * 0.25);
      const opacity = 0.55 + rand() * 0.4;
      bands.push({
        id: `L${L + 1}-b${bi + 1}`,
        lane: L + 1,
        x: (lx - width / 2) / sizeW,
        y: (y - thickness / 2) / sizeH,
        w: width / sizeW,
        h: thickness / sizeH,
      });
      laneSvg.push(
        `<rect x="${lx - width / 2}" y="${y - thickness / 2}" width="${width}" height="${thickness}" rx="1" fill="#e8f7ff" opacity="${opacity}"/>`,
      );
    }
    laneSvg.push(
      `<text x="${lx}" y="${sizeH - 18}" text-anchor="middle" fill="#8ec8e0" font-family="monospace" font-size="11">L${L + 1}</text>`,
    );
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${sizeW}" height="${sizeH}">
  <defs>
    <linearGradient id="gelbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1520"/>
      <stop offset="100%" stop-color="#152536"/>
    </linearGradient>
  </defs>
  <rect width="${sizeW}" height="${sizeH}" fill="url(#gelbg)"/>
  <rect x="24" y="28" width="${sizeW - 48}" height="${sizeH - 56}" rx="8" fill="#0a121c" stroke="#2a4a62" stroke-width="2"/>
  ${Array.from({ length: lanes }, (_, L) => {
    const lx = marginX + laneGap * (L + 0.5);
    return `<line x1="${lx}" y1="${marginY}" x2="${lx}" y2="${sizeH - marginY}" stroke="#1c3348" stroke-width="${laneGap * 0.72}"/>`;
  }).join("")}
  ${laneSvg.join("")}
  <text x="16" y="22" fill="#7aa0b8" font-family="monospace" font-size="12">${id} · bands=${bands.length}</text>
</svg>`;

  const file = `${id}.png`;
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, file));
  return {
    id,
    file,
    type: "gel",
    groundTruthCount: bands.length,
    manualCountSeconds: Math.round(10 + bands.length * 1.1),
    bands,
    lanes,
    notes: note,
    license: "CC0-1.0",
    source: "synthetic-benchmate",
    attribution: "Original synthetic fixture generated for BenchMate eval (no third-party imagery).",
  };
}

const cases = [];

// 12 petri plates spanning sparse → dense
const plateSpecs = [
  { id: "plate-001", seed: 101, n: 5, note: "Sparse E. coli-like colonies" },
  { id: "plate-002", seed: 102, n: 8, note: "Sparse with slight clustering" },
  { id: "plate-003", seed: 103, n: 12, note: "Low-medium density" },
  { id: "plate-004", seed: 104, n: 16, note: "Teaching-lab density" },
  { id: "plate-005", seed: 105, n: 20, note: "Medium density" },
  { id: "plate-006", seed: 106, n: 24, note: "Medium with size variation" },
  { id: "plate-007", seed: 107, n: 30, note: "Upper-medium density" },
  { id: "plate-008", seed: 108, n: 36, note: "Busy plate" },
  { id: "plate-009", seed: 109, n: 42, note: "Dense plate" },
  { id: "plate-010", seed: 110, n: 48, note: "Dense, smaller colonies" },
  { id: "plate-011", seed: 111, n: 10, note: "Odd count sanity check" },
  { id: "plate-012", seed: 112, n: 55, note: "High density stress case" },
];

for (const p of plateSpecs) {
  cases.push(await writePlate({ id: p.id, seed: p.seed, targetCount: p.n, note: p.notes ?? p.note }));
}

// 6 gels with band annotations
const gelSpecs = [
  { id: "gel-001", seed: 201, lanes: 4, bandsPerLane: [3, 4, 3, 5], note: "4-lane DNA ladder style" },
  { id: "gel-002", seed: 202, lanes: 5, bandsPerLane: [2, 3, 2, 4, 3], note: "5-lane PCR products" },
  { id: "gel-003", seed: 203, lanes: 3, bandsPerLane: [5, 5, 4], note: "3-lane comparison" },
  { id: "gel-004", seed: 204, lanes: 6, bandsPerLane: [2, 2, 3, 2, 4, 3], note: "6-lane screening gel" },
  { id: "gel-005", seed: 205, lanes: 4, bandsPerLane: [6, 5, 6, 4], note: "Higher band count" },
  { id: "gel-006", seed: 206, lanes: 2, bandsPerLane: [8, 7], note: "Two-lane dense banding" },
];

for (const g of gelSpecs) {
  cases.push(
    await writeGel({
      id: g.id,
      seed: g.seed,
      lanes: g.lanes,
      bandsPerLane: g.bandsPerLane,
      note: g.note,
    }),
  );
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  description:
    "Labeled public-domain (CC0) synthetic petri-plate colony and gel-band fixtures for BenchMate Eval/QA.",
  license: "CC0-1.0",
  count: cases.length,
  cases,
};

writeFileSync(
  join(root, "fixtures", "colony-eval", "labels.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`Wrote ${cases.length} fixtures to fixtures/colony-eval/`);
console.log(
  `Plates: ${cases.filter((c) => c.type === "petri_plate").length}, gels: ${cases.filter((c) => c.type === "gel").length}`,
);
console.log(
  `Total colonies: ${cases.filter((c) => c.type === "petri_plate").reduce((s, c) => s + c.groundTruthCount, 0)}`,
);
console.log(
  `Total bands: ${cases.filter((c) => c.type === "gel").reduce((s, c) => s + c.groundTruthCount, 0)}`,
);
