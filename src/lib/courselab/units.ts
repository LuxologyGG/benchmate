import type { Dimension } from "./types";

/** Deterministic unit normalization. Every factor converts to the base unit of its dimension. */
const UNITS: Record<string, { dim: Dimension; factor: number; base: string }> = {
  l: { dim: "volume", factor: 1000, base: "mL" },
  ml: { dim: "volume", factor: 1, base: "mL" },
  ul: { dim: "volume", factor: 0.001, base: "mL" },
  "µl": { dim: "volume", factor: 0.001, base: "mL" },
  "μl": { dim: "volume", factor: 0.001, base: "mL" },
  g: { dim: "mass", factor: 1, base: "g" },
  mg: { dim: "mass", factor: 0.001, base: "g" },
  ug: { dim: "mass", factor: 1e-6, base: "g" },
  "µg": { dim: "mass", factor: 1e-6, base: "g" },
  "μg": { dim: "mass", factor: 1e-6, base: "g" },
  kg: { dim: "mass", factor: 1000, base: "g" },
  s: { dim: "time", factor: 1 / 60, base: "min" },
  sec: { dim: "time", factor: 1 / 60, base: "min" },
  min: { dim: "time", factor: 1, base: "min" },
  h: { dim: "time", factor: 60, base: "min" },
  hr: { dim: "time", factor: 60, base: "min" },
  "°c": { dim: "temperature", factor: 1, base: "°C" },
  c: { dim: "temperature", factor: 1, base: "°C" },
  m: { dim: "concentration", factor: 1, base: "M" },
  mm: { dim: "concentration", factor: 1e-3, base: "M" },
  um: { dim: "concentration", factor: 1e-6, base: "M" },
  "µm": { dim: "concentration", factor: 1e-6, base: "M" },
  "μm": { dim: "concentration", factor: 1e-6, base: "M" },
  colonies: { dim: "count", factor: 1, base: "colonies" },
  x: { dim: "count", factor: 1, base: "×" },
  times: { dim: "count", factor: 1, base: "×" },
  inversions: { dim: "count", factor: 1, base: "×" },
  "×": { dim: "count", factor: 1, base: "×" },
};

export function canonicalUnitKey(unit: string): string {
  let u = (unit ?? "").trim().toLowerCase();
  u = u.replace(/\s+/g, "");
  u = u.replace(/^deg(rees)?c$/, "°c").replace(/^ºc$/, "°c");
  u = u.replace(/^(mls|milliliters?|millilitres?)$/, "ml");
  u = u.replace(/^(microliters?|microlitres?|μls?)$/, "µl");
  u = u.replace(/^(liters?|litres?)$/, "l");
  u = u.replace(/^(minutes?|mins)$/, "min");
  u = u.replace(/^(seconds?|secs)$/, "s");
  u = u.replace(/^(hours?|hrs)$/, "h");
  u = u.replace(/^(grams?)$/, "g");
  u = u.replace(/^(milligrams?)$/, "mg");
  u = u.replace(/^(molar|mol\/l)$/, "m");
  u = u.replace(/^(millimolar|mmol\/l)$/, "mm");
  return u;
}

export function normalize(value: number, unit: string): { dim: Dimension; base: number; baseUnit: string } {
  const key = canonicalUnitKey(unit);
  // "M" vs "m" ambiguity: lowercase key "m" always means molar here (no metres in a wet lab protocol).
  const spec = UNITS[key];
  if (!spec) return { dim: "unknown", base: value, baseUnit: unit };
  return { dim: spec.dim, base: value * spec.factor, baseUnit: spec.base };
}

export function dimensionOf(unit: string): Dimension {
  return normalize(1, unit).dim;
}

export function fmt(value: number, unit: string): string {
  const v = Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)
    ? value.toExponential(2)
    : Number(value.toPrecision(4)).toString();
  return `${v} ${unit}`.trim();
}
