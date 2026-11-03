/**
 * Offline deterministic colony/band counter for multi-image eval fixtures.
 * Hero DEMO_MODE path uses Core `runSamQuantifier` instead (see eval-colony.mjs).
 */
import sharp from "sharp";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function connectedComponents(mask, width, height, minArea, maxArea) {
  const seen = new Uint8Array(width * height);
  const blobs = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i] || seen[i]) continue;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % width;
        const cy = (cur / width) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!mask[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (area < minArea || area > maxArea) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (bw > 0 && bh > 0 && (bw / bh > 3.5 || bh / bw > 3.5)) continue;
      const cx = sumX / area;
      const cy = sumY / area;
      blobs.push({
        x: cx,
        y: cy,
        r: Math.sqrt(area / Math.PI),
        area,
        score: clamp(0.55 + area / 400, 0.55, 0.98),
      });
    }
  }
  return blobs;
}

export async function countPetriPlate(imagePath) {
  const t0 = Date.now();
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx = width / 2;
  const cy = height / 2;
  const plateR = Math.min(width, height) * 0.4;

  const luminance = new Float32Array(width * height);
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    luminance[i] =
      0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }

  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > plateR * 0.92) continue;
      const i = y * width + x;
      if (luminance[i] < 95) mask[i] = 1;
    }
  }

  const blobs = connectedComponents(mask, width, height, 12, 900);
  const proposals = blobs.map((b, idx) => ({
    id: `sam-colony-${idx + 1}`,
    x: b.x / width,
    y: b.y / height,
    r: b.r / width,
    score: b.score,
  }));

  return {
    type: "petri_plate",
    predictedCount: proposals.length,
    proposals,
    method: "offline_deterministic_cv",
    provider: "demo",
    model: "deterministic-blob",
    elapsedMs: Date.now() - t0,
  };
}

function connectedBandComponents(mask, width, height, minArea, maxArea) {
  const seen = new Uint8Array(width * height);
  const blobs = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i] || seen[i]) continue;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % width;
        const cy = (cur / width) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!mask[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (area < minArea || area > maxArea) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (bh > 28 || bw < 12 || bw / Math.max(bh, 1) < 1.8) continue;
      blobs.push({
        x: sumX / area,
        y: sumY / area,
        r: Math.sqrt(area / Math.PI),
        area,
        bw,
        bh,
        score: clamp(0.55 + area / 800, 0.55, 0.98),
      });
    }
  }
  return blobs;
}

export async function countGelBands(imagePath) {
  const t0 = Date.now();
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      const lum =
        0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
      if (x < 36 || x > width - 36 || y < 48 || y > height - 48) continue;
      if (lum > 140) mask[y * width + x] = 1;
    }
  }

  const blobs = connectedBandComponents(mask, width, height, 20, 4000);
  const merged = [];
  const sorted = [...blobs].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const b of sorted) {
    const near = merged.find(
      (m) => Math.abs(m.x - b.x) < width * 0.08 && Math.abs(m.y - b.y) < 12,
    );
    if (near) {
      near.area += b.area;
      near.y = (near.y + b.y) / 2;
      continue;
    }
    merged.push({ ...b });
  }

  const proposals = merged.map((b, idx) => ({
    id: `sam-band-${idx + 1}`,
    lane: Math.max(1, Math.round((b.x / width) * 6)),
    x: (b.x - b.bw / 2) / width,
    y: (b.y - b.bh / 2) / height,
    w: b.bw / width,
    h: Math.max(0.004, b.bh / height),
    score: b.score,
  }));

  return {
    type: "gel",
    predictedCount: proposals.length,
    proposals,
    method: "offline_deterministic_cv",
    provider: "demo",
    model: "deterministic-blob",
    elapsedMs: Date.now() - t0,
  };
}

export async function countColonyImage(imagePath, type) {
  if (type === "gel") return countGelBands(imagePath);
  return countPetriPlate(imagePath);
}
