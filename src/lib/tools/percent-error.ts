export function percentError(input: {
  experimental: number;
  theoretical: number;
}): { percentError: number; absoluteError: number; formula: string } {
  if (input.theoretical === 0) {
    throw new Error("theoretical value cannot be zero for percent error");
  }
  const absoluteError = input.experimental - input.theoretical;
  const percentError =
    (Math.abs(absoluteError) / Math.abs(input.theoretical)) * 100;
  return {
    percentError,
    absoluteError,
    formula: "% error = |experimental − theoretical| / |theoretical| × 100",
  };
}

export function percentYield(input: {
  actual: number;
  theoretical: number;
}): { percentYield: number; formula: string } {
  if (input.theoretical === 0) {
    throw new Error("theoretical yield cannot be zero");
  }
  return {
    percentYield: (input.actual / input.theoretical) * 100,
    formula: "% yield = actual / theoretical × 100",
  };
}
