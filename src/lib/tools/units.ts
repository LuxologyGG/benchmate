const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  ug: 1e-6,
  µg: 1e-6,
  lb: 453.59237,
};

const VOLUME_TO_L: Record<string, number> = {
  l: 1,
  L: 1,
  ml: 0.001,
  mL: 0.001,
  ul: 1e-6,
  µL: 1e-6,
  uL: 1e-6,
};

const CONC_TO_MOL_L: Record<string, number> = {
  M: 1,
  mol_L: 1,
  "mol/L": 1,
  mM: 0.001,
  uM: 1e-6,
  µM: 1e-6,
};

function normalizeUnit(unit: string): string {
  return unit.trim();
}

export function convertUnit(input: {
  value: number;
  fromUnit: string;
  toUnit: string;
}): { value: number; fromUnit: string; toUnit: string; factor: number } {
  const from = normalizeUnit(input.fromUnit);
  const to = normalizeUnit(input.toUnit);

  if (from === to) {
    return { value: input.value, fromUnit: from, toUnit: to, factor: 1 };
  }

  const massFrom = MASS_TO_G[from];
  const massTo = MASS_TO_G[to];
  if (massFrom !== undefined && massTo !== undefined) {
    const grams = input.value * massFrom;
    const value = grams / massTo;
    return { value, fromUnit: from, toUnit: to, factor: massFrom / massTo };
  }

  const volFrom = VOLUME_TO_L[from] ?? VOLUME_TO_L[from.replace("L", "l")];
  const volTo = VOLUME_TO_L[to] ?? VOLUME_TO_L[to.replace("L", "l")];
  if (volFrom !== undefined && volTo !== undefined) {
    const liters = input.value * volFrom;
    const value = liters / volTo;
    return { value, fromUnit: from, toUnit: to, factor: volFrom / volTo };
  }

  const cFrom = CONC_TO_MOL_L[from];
  const cTo = CONC_TO_MOL_L[to];
  if (cFrom !== undefined && cTo !== undefined) {
    const molar = input.value * cFrom;
    const value = molar / cTo;
    return { value, fromUnit: from, toUnit: to, factor: cFrom / cTo };
  }

  throw new Error(`Unsupported unit conversion: ${from} → ${to}`);
}
