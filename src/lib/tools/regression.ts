export function linearRegression(input: {
  x: number[];
  y: number[];
  xLabel?: string;
  yLabel?: string;
}): {
  slope: number;
  intercept: number;
  rSquared: number;
  n: number;
  equation: string;
  residualStdError: number;
  predict: Array<{ x: number; yHat: number; residual: number }>;
} {
  const { x, y } = input;
  if (x.length !== y.length || x.length < 2) {
    throw new Error("linearRegression requires ≥2 paired (x,y) points");
  }
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let ssxx = 0;
  let ssyy = 0;
  let ssxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    ssxx += dx * dx;
    ssyy += dy * dy;
    ssxy += dx * dy;
  }

  if (ssxx === 0) throw new Error("x values have zero variance");

  const slope = ssxy / ssxx;
  const intercept = meanY - slope * meanX;
  const rSquared = ssyy === 0 ? 1 : (ssxy * ssxy) / (ssxx * ssyy);

  const predict = x.map((xi, i) => {
    const yHat = slope * xi + intercept;
    return { x: xi, yHat, residual: y[i] - yHat };
  });

  const sse = predict.reduce((a, p) => a + p.residual * p.residual, 0);
  const residualStdError = n > 2 ? Math.sqrt(sse / (n - 2)) : Math.sqrt(sse);

  const xLabel = input.xLabel ?? "x";
  const yLabel = input.yLabel ?? "y";
  const slopeStr = slope.toPrecision(4);
  const intStr = intercept.toPrecision(4);
  const sign = intercept >= 0 ? "+" : "−";
  const equation = `${yLabel} = ${slopeStr}·${xLabel} ${sign} ${Math.abs(intercept).toPrecision(4)}`;

  return {
    slope,
    intercept,
    rSquared,
    n,
    equation: `${equation} (R²=${rSquared.toFixed(4)}; intercept=${intStr})`,
    residualStdError,
    predict,
  };
}

/** Invert Beer's law: A = ε·b·c → c = (A − intercept) / slope */
export function beersLawConcentration(input: {
  absorbance: number;
  slope: number;
  intercept?: number;
}): { concentration: number; formula: string } {
  const intercept = input.intercept ?? 0;
  if (input.slope === 0) throw new Error("slope cannot be zero");
  return {
    concentration: (input.absorbance - intercept) / input.slope,
    formula: "c = (A − b) / m",
  };
}
