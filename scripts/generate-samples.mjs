import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "samples");
mkdirSync(outDir, { recursive: true });

function svgToPng(name, svg) {
  return sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, name))
    .then(() => console.log("wrote", name));
}

const beersSpec = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2744"/>
      <stop offset="100%" stop-color="#1a3a5c"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#bg)"/>
  <rect x="80" y="60" width="800" height="520" rx="18" fill="#0b1c2e" stroke="#3d7ea6" stroke-width="3"/>
  <text x="120" y="110" fill="#7ec8e3" font-family="Courier New, monospace" font-size="22">SPECTRO-UV 1200</text>
  <text x="120" y="150" fill="#9bb4c8" font-family="Courier New, monospace" font-size="16">MODE: ABSORBANCE</text>
  <rect x="200" y="190" width="560" height="90" rx="8" fill="#041018" stroke="#2a8f6f" stroke-width="2"/>
  <text x="230" y="245" fill="#5dffb0" font-family="Courier New, monospace" font-size="42" font-weight="700">λ = 635 nm</text>
  <rect x="200" y="310" width="560" height="120" rx="8" fill="#041018" stroke="#e8b84a" stroke-width="2"/>
  <text x="230" y="360" fill="#9bb4c8" font-family="Courier New, monospace" font-size="18">ABSORBANCE</text>
  <text x="230" y="410" fill="#ffe08a" font-family="Courier New, monospace" font-size="56" font-weight="700">0.412</text>
  <text x="520" y="410" fill="#9bb4c8" font-family="Courier New, monospace" font-size="28">AU</text>
  <text x="120" y="500" fill="#6a8499" font-family="Courier New, monospace" font-size="14">SAMPLE: UNKNOWN CuSO4  |  PATH: 1.00 cm  |  BLANK: AUTOZERO</text>
  <text x="120" y="540" fill="#4a657a" font-family="sans-serif" font-size="12">BenchMate demo fixture — Beer's law spectrophotometer screen</text>
</svg>`;

const beersNotebook = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720">
  <rect width="960" height="720" fill="#f3efe6"/>
  <rect x="40" y="30" width="880" height="660" fill="#fffdf8" stroke="#d4cbb8"/>
  ${Array.from({ length: 28 }, (_, i) => `<line x1="80" y1="${70 + i * 22}" x2="880" y2="${70 + i * 22}" stroke="#d9e2f0" stroke-width="1"/>`).join("")}
  <line x1="120" y1="50" x2="120" y2="670" stroke="#f0b4b4" stroke-width="1.5"/>
  <text x="140" y="95" fill="#1e3a5f" font-family="Georgia, serif" font-size="26" font-style="italic">Beer's Law — CuSO₄ calibration</text>
  <text x="140" y="130" fill="#334" font-family="Comic Sans MS, cursive" font-size="18">λ = 635 nm   b = 1.00 cm</text>
  <text x="140" y="175" fill="#1e3a5f" font-family="Comic Sans MS, cursive" font-size="20" font-weight="700">Trial   [CuSO4] (M)   Absorbance</text>
  <text x="140" y="210" fill="#222" font-family="Comic Sans MS, cursive" font-size="19">1       0.00          0.002</text>
  <text x="140" y="245" fill="#222" font-family="Comic Sans MS, cursive" font-size="19">2       0.05          0.118</text>
  <text x="140" y="280" fill="#222" font-family="Comic Sans MS, cursive" font-size="19">3       0.10          0.241</text>
  <text x="140" y="315" fill="#222" font-family="Comic Sans MS, cursive" font-size="19">4       0.15          0.355</text>
  <text x="140" y="350" fill="#222" font-family="Comic Sans MS, cursive" font-size="19">5       0.20          0.472</text>
  <text x="140" y="410" fill="#1e3a5f" font-family="Comic Sans MS, cursive" font-size="20">Unknown Abs = 0.412</text>
  <text x="140" y="450" fill="#444" font-family="Comic Sans MS, cursive" font-size="17">Notes: rinse cuvette 2× with sample. Wipe fingerprints.</text>
  <text x="140" y="520" fill="#888" font-family="sans-serif" font-size="12">BenchMate demo fixture — handwritten calibration table</text>
</svg>`;

const titrationBurette = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8eef5"/>
      <stop offset="100%" stop-color="#c5d3e0"/>
    </linearGradient>
  </defs>
  <rect width="720" height="960" fill="url(#g)"/>
  <rect x="300" y="40" width="50" height="720" rx="8" fill="#dce9f5" stroke="#5a7a94" stroke-width="3"/>
  <rect x="308" y="200" width="34" height="480" fill="#9fd0ff" opacity="0.55"/>
  <line x1="300" y1="220" x2="350" y2="220" stroke="#c0392b" stroke-width="2"/>
  <text x="370" y="225" fill="#c0392b" font-family="sans-serif" font-size="18" font-weight="700">24.35 mL</text>
  ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => {
    const y = 80 + i * 60;
    return `<line x1="290" y1="${y}" x2="300" y2="${y}" stroke="#333" stroke-width="2"/><text x="230" y="${y + 5}" fill="#333" font-family="monospace" font-size="14">${v}</text>`;
  }).join("")}
  <ellipse cx="325" cy="780" rx="28" ry="12" fill="#7aa8c9"/>
  <text x="80" y="860" fill="#1e3a5f" font-family="sans-serif" font-size="22" font-weight="700">50 mL burette — Trial 1 final volume</text>
  <text x="80" y="900" fill="#666" font-family="sans-serif" font-size="13">BenchMate demo fixture — titration burette</text>
</svg>`;

const titrationNotebook = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720">
  <rect width="960" height="720" fill="#efeae0"/>
  <rect x="40" y="30" width="880" height="660" fill="#fffef9" stroke="#cfc6b4"/>
  ${Array.from({ length: 28 }, (_, i) => `<line x1="80" y1="${70 + i * 22}" x2="880" y2="${70 + i * 22}" stroke="#dde5f0" stroke-width="1"/>`).join("")}
  <line x1="120" y1="50" x2="120" y2="670" stroke="#e8b0b0" stroke-width="1.5"/>
  <text x="140" y="95" fill="#1e3a5f" font-family="Georgia, serif" font-size="24" font-style="italic">HCl vs NaOH titration</text>
  <text x="140" y="130" fill="#333" font-family="Comic Sans MS, cursive" font-size="17">NaOH = 0.1000 M   Indicator: phenolphthalein (2 drops)</text>
  <text x="140" y="175" fill="#1e3a5f" font-family="Comic Sans MS, cursive" font-size="18" font-weight="700">Trial  V_HCl   Init    Final   V_NaOH</text>
  <text x="140" y="215" fill="#222" font-family="Comic Sans MS, cursive" font-size="18">1     25.00   0.20    24.55   24.35</text>
  <text x="140" y="250" fill="#222" font-family="Comic Sans MS, cursive" font-size="18">2     25.00   0.10    24.40   24.30</text>
  <text x="140" y="285" fill="#222" font-family="Comic Sans MS, cursive" font-size="18">3     25.00   1.05    25.50   24.45</text>
  <text x="140" y="350" fill="#444" font-family="Comic Sans MS, cursive" font-size="17">Endpoint: faint pink persists ~30 s</text>
  <text x="140" y="390" fill="#444" font-family="Comic Sans MS, cursive" font-size="17">Expected [HCl] ≈ 0.100 M</text>
  <text x="140" y="520" fill="#888" font-family="sans-serif" font-size="12">BenchMate demo fixture — titration notebook</text>
</svg>`;

const balanceScreen = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
  <rect width="960" height="640" fill="#1a1f24"/>
  <rect x="100" y="80" width="760" height="440" rx="20" fill="#2a3038" stroke="#6a7380" stroke-width="4"/>
  <text x="140" y="140" fill="#8fa0b0" font-family="sans-serif" font-size="20">ANALYTICAL BALANCE XA205</text>
  <rect x="160" y="180" width="640" height="160" rx="10" fill="#0d1116" stroke="#3d9e6f" stroke-width="2"/>
  <text x="200" y="280" fill="#5dffa8" font-family="Courier New, monospace" font-size="64" font-weight="700">2.8470 g</text>
  <text x="140" y="400" fill="#aab4c0" font-family="sans-serif" font-size="18">STABLE  ·  NaCl sample  ·  draft shield closed</text>
  <text x="140" y="460" fill="#7a8694" font-family="sans-serif" font-size="14">Tare: 0.0000 g   |   MM NaCl = 58.44 g/mol   |   Flask: 100.0 mL</text>
  <text x="140" y="560" fill="#667" font-family="sans-serif" font-size="12">BenchMate demo fixture — analytical balance</text>
</svg>`;

/** Deterministic colony positions matching src/lib/demo/colony-fixtures.ts (42 colonies). */
function hash01(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildColonyPlateSvg() {
  const W = 960;
  const H = 960;
  const cx = W * 0.5;
  const cy = H * 0.48;
  const R = W * 0.36;
  const colonies = [];
  const rings = [
    { n: 1, r: 0.02 },
    { n: 6, r: 0.12 },
    { n: 12, r: 0.22 },
    { n: 14, r: 0.3 },
    { n: 9, r: 0.35 },
  ];
  let i = 0;
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      if (colonies.length >= 42) break;
      const angle = (2 * Math.PI * k) / ring.n + hash01(i) * 0.2;
      const rr = ring.r * (0.92 + hash01(i + 3) * 0.16);
      const x = 0.5 + rr * Math.cos(angle);
      const y = 0.48 + rr * Math.sin(angle);
      const size = 0.012 + hash01(i + 7) * 0.018;
      const dx = x - 0.5;
      const dy = y - 0.48;
      if (Math.sqrt(dx * dx + dy * dy) + size > 0.36) {
        i++;
        continue;
      }
      colonies.push({ x, y, size, shade: 40 + hash01(i + 19) * 50 });
      i++;
    }
  }
  while (colonies.length < 42) {
    const t = colonies.length;
    const angle = hash01(t + 50) * 2 * Math.PI;
    const rr = 0.08 + hash01(t + 60) * 0.24;
    colonies.push({
      x: 0.5 + rr * Math.cos(angle),
      y: 0.48 + rr * Math.sin(angle),
      size: 0.014,
      shade: 55,
    });
  }
  const dots = colonies
    .slice(0, 42)
    .map((c) => {
      const px = c.x * W;
      const py = c.y * H;
      const r = c.size * W * 0.55;
      const fill = `rgb(${90 + c.shade * 0.3},${40 + c.shade * 0.2},${30})`;
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="0.92"/>`;
    })
    .join("\n  ");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="agar" cx="50%" cy="48%" r="55%">
      <stop offset="0%" stop-color="#f0e6c8"/>
      <stop offset="70%" stop-color="#e2d4a8"/>
      <stop offset="100%" stop-color="#cbb888"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#2a3328"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 18}" fill="#d8dde0" stroke="#8a9299" stroke-width="10"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#agar)" stroke="#b0a070" stroke-width="3"/>
  ${dots}
  <text x="48" y="900" fill="#e8efe4" font-family="sans-serif" font-size="22" font-weight="700">LB agar · E. coli · 10⁻⁴ dilution</text>
  <text x="48" y="932" fill="#a8b8a4" font-family="sans-serif" font-size="13">BenchMate demo fixture — petri dish colony plate (42 colonies)</text>
</svg>`;
}

const colonyLabel = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
  <rect width="960" height="540" fill="#f4f1ea"/>
  <rect x="48" y="40" width="864" height="460" fill="#fffdf8" stroke="#cfc6b4"/>
  <text x="80" y="100" fill="#1e3a5f" font-family="Georgia, serif" font-size="28" font-style="italic">Plate metadata</text>
  <text x="80" y="160" fill="#222" font-family="Comic Sans MS, cursive" font-size="22">Organism: E. coli K-12</text>
  <text x="80" y="210" fill="#222" font-family="Comic Sans MS, cursive" font-size="22">Medium: LB agar</text>
  <text x="80" y="260" fill="#222" font-family="Comic Sans MS, cursive" font-size="22">Dilution: 1×10⁻⁴</text>
  <text x="80" y="310" fill="#222" font-family="Comic Sans MS, cursive" font-size="22">Volume plated: 0.10 mL</text>
  <text x="80" y="360" fill="#222" font-family="Comic Sans MS, cursive" font-size="22">Incubation: 37 °C · 18 h</text>
  <text x="80" y="430" fill="#1e3a5f" font-family="Comic Sans MS, cursive" font-size="20">Expected: count colonies → CFU/mL = N/(V×D)</text>
  <text x="80" y="480" fill="#888" font-family="sans-serif" font-size="12">BenchMate demo fixture — colony plate label</text>
</svg>`;

await Promise.all([
  svgToPng("beers-law-spectrophotometer.png", beersSpec),
  svgToPng("beers-law-notebook.png", beersNotebook),
  svgToPng("titration-burette.png", titrationBurette),
  svgToPng("titration-notebook.png", titrationNotebook),
  svgToPng("balance-screen.png", balanceScreen),
  svgToPng("colony-plate.png", buildColonyPlateSvg()),
  svgToPng("colony-plate-label.png", colonyLabel),
]);

// Also copy fixture JSON sidecars
const fixturesDir = join(__dirname, "..", "fixtures");
mkdirSync(join(fixturesDir, "beers-law"), { recursive: true });
mkdirSync(join(fixturesDir, "titration"), { recursive: true });
mkdirSync(join(fixturesDir, "balance"), { recursive: true });
mkdirSync(join(fixturesDir, "colony-plate"), { recursive: true });

writeFileSync(
  join(fixturesDir, "beers-law", "README.md"),
  "# Beer's Law fixture\n\nSample images in `/public/samples/beers-law-*.png`. DEMO_MODE replays structured extraction/agent/verify/report from `src/lib/demo/fixtures.ts`.\n",
);
writeFileSync(
  join(fixturesDir, "titration", "README.md"),
  "# Titration fixture\n\nSample images in `/public/samples/titration-*.png`.\n",
);
writeFileSync(
  join(fixturesDir, "balance", "README.md"),
  "# Balance fixture\n\nSample image in `/public/samples/balance-screen.png`.\n",
);
writeFileSync(
  join(fixturesDir, "colony-plate", "README.md"),
  `# Colony plate fixture (hero)

Sample images:
- \`/public/samples/colony-plate.png\` — 42 colonies on LB agar
- \`/public/samples/colony-plate-label.png\` — dilution / volume metadata

Ground truth: N=42, V=0.1 mL, D=1e-4 → **CFU/mL = 4.2×10⁶**

DEMO_MODE uses fixture SAM segmentations in \`src/lib/demo/colony-fixtures.ts\` and deterministic \`compute_cfu\`.
`,
);

console.log("Sample generation complete.");
