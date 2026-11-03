export type UncertaintyOp = "add" | "subtract" | "multiply" | "divide" | "scale";

export function propagateUncertainty(input: {
  operation: UncertaintyOp;
  a: { value: number; uncertainty: number };
  b?: { value: number; uncertainty: number };
  /** For scale: multiply a by constant k */
  k?: number;
}): {
  value: number;
  uncertainty: number;
  relativeUncertainty: number;
  formula: string;
} {
  const { operation, a, b, k } = input;

  switch (operation) {
    case "add":
    case "subtract": {
      if (!b) throw new Error("b required for add/subtract");
      const value = operation === "add" ? a.value + b.value : a.value - b.value;
      const uncertainty = Math.hypot(a.uncertainty, b.uncertainty);
      return {
        value,
        uncertainty,
        relativeUncertainty: value === 0 ? Infinity : Math.abs(uncertainty / value),
        formula:
          operation === "add"
            ? "δ(a+b) = √(δa² + δb²)"
            : "δ(a−b) = √(δa² + δb²)",
      };
    }
    case "multiply":
    case "divide": {
      if (!b) throw new Error("b required for multiply/divide");
      const value = operation === "multiply" ? a.value * b.value : a.value / b.value;
      const relA = a.value === 0 ? Infinity : a.uncertainty / Math.abs(a.value);
      const relB = b.value === 0 ? Infinity : b.uncertainty / Math.abs(b.value);
      const relativeUncertainty = Math.hypot(relA, relB);
      const uncertainty = Math.abs(value) * relativeUncertainty;
      return {
        value,
        uncertainty,
        relativeUncertainty,
        formula:
          operation === "multiply"
            ? "δ(ab)/|ab| = √((δa/a)² + (δb/b)²)"
            : "δ(a/b)/|a/b| = √((δa/a)² + (δb/b)²)",
      };
    }
    case "scale": {
      if (k === undefined) throw new Error("k required for scale");
      const value = a.value * k;
      const uncertainty = Math.abs(k) * a.uncertainty;
      return {
        value,
        uncertainty,
        relativeUncertainty: value === 0 ? Infinity : Math.abs(uncertainty / value),
        formula: "δ(k·a) = |k|·δa",
      };
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/** Round a value to match significant figures from an uncertainty (1–2 sig figs on δ). */
export function roundWithUncertainty(input: {
  value: number;
  uncertainty: number;
}): { value: number; uncertainty: number; display: string } {
  if (input.uncertainty <= 0 || !Number.isFinite(input.uncertainty)) {
    return {
      value: input.value,
      uncertainty: input.uncertainty,
      display: String(input.value),
    };
  }
  const order = Math.floor(Math.log10(input.uncertainty));
  const factor = Math.pow(10, order);
  const leading = input.uncertainty / factor;
  const uncSig = leading < 3.5 ? 2 : 1;
  const uncRounded =
    Math.round(input.uncertainty / Math.pow(10, order - uncSig + 1)) *
    Math.pow(10, order - uncSig + 1);
  const decimals = Math.max(0, -Math.floor(Math.log10(uncRounded)));
  const valueRounded =
    Math.round(input.value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return {
    value: valueRounded,
    uncertainty: uncRounded,
    display: `${valueRounded} ± ${uncRounded}`,
  };
}
