export function molarity(input: {
  moles?: number;
  liters?: number;
  grams?: number;
  molarMass?: number;
  molarity?: number;
  compute: "molarity" | "moles" | "liters" | "grams";
}): {
  result: number;
  unit: string;
  formula: string;
  intermediates: Record<string, number>;
} {
  const intermediates: Record<string, number> = {};

  let moles = input.moles;
  if (moles === undefined && input.grams !== undefined && input.molarMass) {
    moles = input.grams / input.molarMass;
    intermediates.moles_from_mass = moles;
  }

  switch (input.compute) {
    case "molarity": {
      if (moles === undefined || input.liters === undefined || input.liters === 0) {
        throw new Error("molarity requires moles (or grams+molarMass) and liters");
      }
      const result = moles / input.liters;
      return {
        result,
        unit: "M",
        formula: "M = n / V",
        intermediates: { ...intermediates, moles, liters: input.liters },
      };
    }
    case "moles": {
      if (input.molarity !== undefined && input.liters !== undefined) {
        const result = input.molarity * input.liters;
        return {
          result,
          unit: "mol",
          formula: "n = M × V",
          intermediates: { molarity: input.molarity, liters: input.liters },
        };
      }
      if (input.grams !== undefined && input.molarMass) {
        const result = input.grams / input.molarMass;
        return {
          result,
          unit: "mol",
          formula: "n = m / MM",
          intermediates: { grams: input.grams, molarMass: input.molarMass },
        };
      }
      throw new Error("moles requires (molarity+liters) or (grams+molarMass)");
    }
    case "liters": {
      if (moles === undefined || input.molarity === undefined || input.molarity === 0) {
        throw new Error("liters requires moles and molarity");
      }
      const result = moles / input.molarity;
      return {
        result,
        unit: "L",
        formula: "V = n / M",
        intermediates: { ...intermediates, moles, molarity: input.molarity },
      };
    }
    case "grams": {
      if (moles === undefined || input.molarMass === undefined) {
        throw new Error("grams requires moles and molarMass");
      }
      const result = moles * input.molarMass;
      return {
        result,
        unit: "g",
        formula: "m = n × MM",
        intermediates: { ...intermediates, moles, molarMass: input.molarMass },
      };
    }
    default:
      throw new Error(`Unknown compute mode: ${input.compute}`);
  }
}

export function dilution(input: {
  m1?: number;
  v1?: number;
  m2?: number;
  v2?: number;
  solveFor: "m2" | "v2" | "m1" | "v1";
}): { result: number; formula: string } {
  const { m1, v1, m2, v2, solveFor } = input;
  switch (solveFor) {
    case "m2":
      if (m1 === undefined || v1 === undefined || v2 === undefined || v2 === 0) {
        throw new Error("m1, v1, v2 required");
      }
      return { result: (m1 * v1) / v2, formula: "M2 = M1·V1 / V2" };
    case "v2":
      if (m1 === undefined || v1 === undefined || m2 === undefined || m2 === 0) {
        throw new Error("m1, v1, m2 required");
      }
      return { result: (m1 * v1) / m2, formula: "V2 = M1·V1 / M2" };
    case "m1":
      if (v1 === undefined || v1 === 0 || m2 === undefined || v2 === undefined) {
        throw new Error("v1, m2, v2 required");
      }
      return { result: (m2 * v2) / v1, formula: "M1 = M2·V2 / V1" };
    case "v1":
      if (m1 === undefined || m1 === 0 || m2 === undefined || v2 === undefined) {
        throw new Error("m1, m2, v2 required");
      }
      return { result: (m2 * v2) / m1, formula: "V1 = M2·V2 / M1" };
  }
}
