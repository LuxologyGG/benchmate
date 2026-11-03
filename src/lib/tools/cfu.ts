/**
 * Deterministic CFU/mL from colony count, plated volume, and dilution factor.
 * CFU/mL = N / (V_plated × D)
 */

export function computeCfu(input: {
  colonyCount: number;
  platedVolumeMl: number;
  dilutionFactor: number;
}): {
  cfuPerMl: number;
  colonyCount: number;
  platedVolumeMl: number;
  dilutionFactor: number;
  formula: string;
} {
  const { colonyCount, platedVolumeMl, dilutionFactor } = input;
  const denom = platedVolumeMl * dilutionFactor;
  const cfuPerMl = denom > 0 ? colonyCount / denom : 0;
  return {
    cfuPerMl,
    colonyCount,
    platedVolumeMl,
    dilutionFactor,
    formula: `CFU/mL = N / (V × D) = ${colonyCount} / (${platedVolumeMl} × ${dilutionFactor})`,
  };
}
