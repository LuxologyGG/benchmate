import type {
  AgentResult,
  ExtractionResult,
  LabReport,
  LabSampleId,
  VerificationResult,
} from "@/lib/types";
import {
  DEMO_COLONY_COUNT,
  DEMO_COLONY_EXPECTED_CFU,
  getDemoColonyParams,
  getDemoColonySegmentations,
} from "@/lib/demo/colony-fixtures";
import {
  beersLawConcentration,
  computeCfu,
  linearRegression,
  molarity,
  percentError,
  propagateUncertainty,
} from "@/lib/tools";

export const SAMPLE_META: Record<
  LabSampleId,
  { title: string; description: string; imageFiles: string[] }
> = {
  "beers-law": {
    title: "Beer's Law Calibration — CuSO₄",
    description:
      "Spectrophotometer screen + handwritten calibration table for copper sulfate standards.",
    imageFiles: [
      "/samples/beers-law-spectrophotometer.png",
      "/samples/beers-law-notebook.png",
    ],
  },
  titration: {
    title: "Acid–Base Titration — HCl vs NaOH",
    description: "Burette readout and notebook titration trials with phenolphthalein endpoint.",
    imageFiles: [
      "/samples/titration-burette.png",
      "/samples/titration-notebook.png",
    ],
  },
  balance: {
    title: "Analytical Balance — Salt Masses",
    description: "Digital balance screen with solid sample masses for molarity prep.",
    imageFiles: ["/samples/balance-screen.png"],
  },
  "colony-plate": {
    title: "Petri Dish — Colony CFU Count",
    description:
      "SAM 3.1 segments colonies; deterministic code counts, areas, and CFU/mL (hero demo).",
    imageFiles: [
      "/samples/colony-plate.png",
      "/samples/colony-plate-label.png",
    ],
  },
};

function beersExtraction(): ExtractionResult {
  return {
    sampleId: "beers-law",
    experimentTitle: "Beer's Law Calibration of CuSO₄(aq)",
    experimentType: "beers-law",
    summary:
      "Five CuSO₄ standards (0.00–0.20 M) measured at 635 nm. Unknown sample absorbance 0.412.",
    provider: "demo",
    model: "demo-fixture",
    boundingBoxes: [
      {
        id: "bb-abs",
        label: "Absorbance readout",
        x: 0.28,
        y: 0.32,
        width: 0.44,
        height: 0.18,
        confidence: 0.94,
      },
      {
        id: "bb-wl",
        label: "Wavelength",
        x: 0.3,
        y: 0.18,
        width: 0.4,
        height: 0.1,
        confidence: 0.91,
      },
      {
        id: "bb-table",
        label: "Calibration table",
        x: 0.12,
        y: 0.22,
        width: 0.76,
        height: 0.55,
        confidence: 0.89,
      },
    ],
    tables: [
      {
        id: "cal-table",
        title: "Calibration standards",
        headers: ["Trial", "[CuSO₄] (M)", "Absorbance"],
        rows: [
          ["1", "0.00", "0.002"],
          ["2", "0.05", "0.118"],
          ["3", "0.10", "0.241"],
          ["4", "0.15", "0.355"],
          ["5", "0.20", "0.472"],
        ],
      },
    ],
    measurements: [
      {
        id: "m-wl",
        label: "Wavelength",
        value: 635,
        unit: "nm",
        significantFigures: 3,
        kind: "wavelength",
        sourceImageId: "img-0",
        rawText: "λ = 635 nm",
        confidence: 0.96,
        boundingBoxId: "bb-wl",
      },
      {
        id: "m-c0",
        label: "Standard 1 concentration",
        value: 0.0,
        unit: "M",
        significantFigures: 2,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.00 M",
        confidence: 0.97,
      },
      {
        id: "m-a0",
        label: "Standard 1 absorbance",
        value: 0.002,
        unit: "AU",
        significantFigures: 1,
        kind: "absorbance",
        sourceImageId: "img-1",
        rawText: "0.002",
        confidence: 0.92,
      },
      {
        id: "m-c1",
        label: "Standard 2 concentration",
        value: 0.05,
        unit: "M",
        significantFigures: 1,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.05 M",
        confidence: 0.95,
      },
      {
        id: "m-a1",
        label: "Standard 2 absorbance",
        value: 0.118,
        unit: "AU",
        significantFigures: 3,
        kind: "absorbance",
        sourceImageId: "img-1",
        rawText: "0.118",
        confidence: 0.94,
      },
      {
        id: "m-c2",
        label: "Standard 3 concentration",
        value: 0.1,
        unit: "M",
        significantFigures: 2,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.10 M",
        confidence: 0.95,
      },
      {
        id: "m-a2",
        label: "Standard 3 absorbance",
        value: 0.241,
        unit: "AU",
        significantFigures: 3,
        kind: "absorbance",
        sourceImageId: "img-1",
        rawText: "0.241",
        confidence: 0.94,
      },
      {
        id: "m-c3",
        label: "Standard 4 concentration",
        value: 0.15,
        unit: "M",
        significantFigures: 2,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.15 M",
        confidence: 0.95,
      },
      {
        id: "m-a3",
        label: "Standard 4 absorbance",
        value: 0.355,
        unit: "AU",
        significantFigures: 3,
        kind: "absorbance",
        sourceImageId: "img-1",
        rawText: "0.355",
        confidence: 0.93,
      },
      {
        id: "m-c4",
        label: "Standard 5 concentration",
        value: 0.2,
        unit: "M",
        significantFigures: 1,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.20 M",
        confidence: 0.95,
      },
      {
        id: "m-a4",
        label: "Standard 5 absorbance",
        value: 0.472,
        unit: "AU",
        significantFigures: 3,
        kind: "absorbance",
        sourceImageId: "img-1",
        rawText: "0.472",
        confidence: 0.94,
      },
      {
        id: "m-unk",
        label: "Unknown absorbance",
        value: 0.412,
        unit: "AU",
        significantFigures: 3,
        kind: "absorbance",
        sourceImageId: "img-0",
        rawText: "Abs 0.412",
        confidence: 0.97,
        boundingBoxId: "bb-abs",
        flagged: true,
        flagReason: "Sig-fig check: instrument shows 3 decimals; confirm blank subtraction.",
      },
      {
        id: "m-path",
        label: "Cuvette path length",
        value: 1.0,
        unit: "cm",
        significantFigures: 2,
        kind: "other",
        sourceImageId: "img-1",
        rawText: "b = 1.00 cm",
        confidence: 0.9,
      },
    ],
  };
}

function titrationExtraction(): ExtractionResult {
  return {
    sampleId: "titration",
    experimentTitle: "Standardization of HCl with NaOH",
    experimentType: "titration",
    summary:
      "Three titration trials of ~25 mL HCl with 0.1000 M NaOH to phenolphthalein endpoint.",
    provider: "demo",
    model: "demo-fixture",
    boundingBoxes: [
      {
        id: "bb-burette",
        label: "Burette volume",
        x: 0.35,
        y: 0.25,
        width: 0.3,
        height: 0.45,
        confidence: 0.9,
      },
      {
        id: "bb-trials",
        label: "Trial table",
        x: 0.1,
        y: 0.2,
        width: 0.8,
        height: 0.6,
        confidence: 0.88,
      },
    ],
    tables: [
      {
        id: "titration-trials",
        title: "Titration trials",
        headers: ["Trial", "V_HCl (mL)", "Initial (mL)", "Final (mL)", "V_NaOH (mL)"],
        rows: [
          ["1", "25.00", "0.20", "24.55", "24.35"],
          ["2", "25.00", "0.10", "24.40", "24.30"],
          ["3", "25.00", "1.05", "25.50", "24.45"],
        ],
      },
    ],
    measurements: [
      {
        id: "t-naoh-m",
        label: "NaOH concentration",
        value: 0.1,
        unit: "M",
        significantFigures: 4,
        kind: "concentration",
        sourceImageId: "img-1",
        rawText: "0.1000 M NaOH",
        confidence: 0.98,
      },
      {
        id: "t-vhcl",
        label: "HCl aliquot volume",
        value: 25.0,
        unit: "mL",
        significantFigures: 4,
        kind: "volume",
        sourceImageId: "img-1",
        rawText: "25.00 mL HCl",
        confidence: 0.96,
      },
      {
        id: "t-v1",
        label: "Trial 1 NaOH volume",
        value: 24.35,
        unit: "mL",
        significantFigures: 4,
        kind: "volume",
        sourceImageId: "img-0",
        rawText: "24.35 mL",
        confidence: 0.93,
        boundingBoxId: "bb-burette",
      },
      {
        id: "t-v2",
        label: "Trial 2 NaOH volume",
        value: 24.3,
        unit: "mL",
        significantFigures: 3,
        kind: "volume",
        sourceImageId: "img-1",
        rawText: "24.30 mL",
        confidence: 0.94,
        flagged: true,
        flagReason: "Sig figs: recorded as 24.30 but trailing zero may be ambiguous.",
      },
      {
        id: "t-v3",
        label: "Trial 3 NaOH volume",
        value: 24.45,
        unit: "mL",
        significantFigures: 4,
        kind: "volume",
        sourceImageId: "img-1",
        rawText: "24.45 mL",
        confidence: 0.92,
      },
      {
        id: "t-ind",
        label: "Indicator",
        value: 2,
        unit: "drops",
        significantFigures: 1,
        kind: "other",
        sourceImageId: "img-1",
        rawText: "2 drops phenolphthalein",
        confidence: 0.9,
      },
    ],
  };
}

function balanceExtraction(): ExtractionResult {
  return {
    sampleId: "balance",
    experimentTitle: "Mass of NaCl for Solution Prep",
    experimentType: "gravimetric",
    summary: "Analytical balance readings for NaCl solid used to prepare 100.0 mL of solution.",
    provider: "demo",
    model: "demo-fixture",
    boundingBoxes: [
      {
        id: "bb-mass",
        label: "Mass display",
        x: 0.22,
        y: 0.35,
        width: 0.56,
        height: 0.22,
        confidence: 0.97,
      },
    ],
    tables: [],
    measurements: [
      {
        id: "b-mass",
        label: "NaCl mass",
        value: 2.847,
        unit: "g",
        significantFigures: 4,
        kind: "mass",
        sourceImageId: "img-0",
        rawText: "2.8470 g",
        confidence: 0.98,
        boundingBoxId: "bb-mass",
        flagged: true,
        flagReason: "Display shows 2.8470 g (5 decimals on last digit); transcription used 4 sig figs beyond units place.",
      },
      {
        id: "b-vol",
        label: "Volumetric flask",
        value: 100.0,
        unit: "mL",
        significantFigures: 4,
        kind: "volume",
        sourceImageId: "img-0",
        rawText: "100.0 mL",
        confidence: 0.9,
      },
      {
        id: "b-mm",
        label: "Molar mass NaCl",
        value: 58.44,
        unit: "g/mol",
        significantFigures: 4,
        kind: "other",
        sourceImageId: "img-0",
        rawText: "MM = 58.44 g/mol",
        confidence: 0.99,
      },
    ],
  };
}

function colonyExtraction(): ExtractionResult {
  const segs = getDemoColonySegmentations();
  const params = getDemoColonyParams();
  const cfu = computeCfu({
    colonyCount: DEMO_COLONY_COUNT,
    platedVolumeMl: params.platedVolumeMl ?? 0.1,
    dilutionFactor: params.dilutionFactor ?? 1e-4,
  });
  const boxes = segs.map((s) => ({
    id: s.id,
    label: s.label,
    x: s.bbox[0],
    y: s.bbox[1],
    width: s.bbox[2],
    height: s.bbox[3],
    confidence: s.score,
  }));
  const meanArea =
    segs.reduce((a, s) => a + s.bbox[2] * s.bbox[3], 0) / Math.max(segs.length, 1);

  return {
    sampleId: "colony-plate",
    experimentTitle: "E. coli colony counting on LB agar",
    experimentType: "colony-count",
    summary: `DEMO: SAM-style segmentation of ${DEMO_COLONY_COUNT} colonies. CFU/mL = ${DEMO_COLONY_EXPECTED_CFU.toExponential(2)} (V=${params.platedVolumeMl} mL, D=${params.dilutionFactor}).`,
    provider: "demo",
    model: "demo-fixture",
    boundingBoxes: boxes,
    tables: [
      {
        id: "colony-summary",
        title: "Colony quantification",
        headers: ["Metric", "Value"],
        rows: [
          ["Colony count", String(DEMO_COLONY_COUNT)],
          ["Plated volume (mL)", String(params.platedVolumeMl)],
          ["Dilution factor", String(params.dilutionFactor)],
          ["CFU/mL", cfu.cfuPerMl.toExponential(3)],
          ["Mean colony area (norm)", meanArea.toExponential(3)],
        ],
      },
    ],
    measurements: [
      {
        id: "c-count",
        label: "Colony count",
        value: DEMO_COLONY_COUNT,
        unit: "colonies",
        significantFigures: 2,
        kind: "colony-count",
        sourceImageId: "img-0",
        rawText: String(DEMO_COLONY_COUNT),
        confidence: 0.95,
      },
      {
        id: "c-vol",
        label: "Plated volume",
        value: params.platedVolumeMl ?? 0.1,
        unit: "mL",
        significantFigures: 1,
        kind: "volume",
        sourceImageId: "img-1",
        rawText: `${params.platedVolumeMl} mL`,
        confidence: 0.99,
      },
      {
        id: "c-dil",
        label: "Dilution factor",
        value: params.dilutionFactor ?? 1e-4,
        unit: "",
        significantFigures: 1,
        kind: "other",
        sourceImageId: "img-1",
        rawText: String(params.dilutionFactor),
        confidence: 0.99,
      },
      {
        id: "c-cfu",
        label: "CFU/mL",
        value: cfu.cfuPerMl,
        unit: "CFU/mL",
        significantFigures: 2,
        kind: "cfu",
        sourceImageId: "img-0",
        rawText: cfu.cfuPerMl.toExponential(2),
        confidence: 0.94,
        flagged: true,
        flagReason: "Confirm dilution series label (10⁻⁴) matches plate metadata.",
      },
      {
        id: "c-area",
        label: "Mean colony area (normalized)",
        value: meanArea,
        unit: "norm²",
        significantFigures: 3,
        kind: "area",
        sourceImageId: "img-0",
        rawText: meanArea.toExponential(3),
        confidence: 0.9,
      },
    ],
    quantitation: {
      mode: "colony",
      colonyCount: DEMO_COLONY_COUNT,
      cfuPerMl: cfu.cfuPerMl,
      platedVolumeMl: params.platedVolumeMl,
      dilutionFactor: params.dilutionFactor,
      notes: ["DEMO_MODE fixture SAM segmentations"],
    },
  };
}

export function getDemoExtraction(sampleId: LabSampleId): ExtractionResult {
  switch (sampleId) {
    case "beers-law":
      return beersExtraction();
    case "titration":
      return titrationExtraction();
    case "balance":
      return balanceExtraction();
    case "colony-plate":
      return colonyExtraction();
  }
}

export function getDemoAgent(sampleId: LabSampleId): AgentResult {
  const now = () => new Date().toISOString();

  if (sampleId === "beers-law") {
    const x = [0, 0.05, 0.1, 0.15, 0.2];
    const y = [0.002, 0.118, 0.241, 0.355, 0.472];
    const fit = linearRegression({
      x,
      y,
      xLabel: "[CuSO₄]",
      yLabel: "A",
    });
    const unk = beersLawConcentration({
      absorbance: 0.412,
      slope: fit.slope,
      intercept: fit.intercept,
    });
    const unc = propagateUncertainty({
      operation: "divide",
      a: { value: 0.412 - fit.intercept, uncertainty: 0.002 },
      b: { value: fit.slope, uncertainty: fit.residualStdError },
    });

    return {
      plan: "Fit Beer's law calibration (A vs concentration), then invert for unknown concentration and propagate uncertainty.",
      provider: "demo",
      model: "demo-fixture",
      steps: [
        {
          id: "s1",
          type: "plan",
          content:
            "1) OLS regression on five standards. 2) Invert for unknown A=0.412. 3) Propagate uncertainty from residual SE.",
          timestamp: now(),
        },
        {
          id: "s2",
          type: "tool_call",
          content: "Calling linear_regression on calibration points",
          toolName: "linear_regression",
          toolInput: { x, y, xLabel: "[CuSO₄]", yLabel: "A" },
          toolOutput: fit as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s3",
          type: "tool_call",
          content: "Calling beers_law_concentration for unknown",
          toolName: "beers_law_concentration",
          toolInput: {
            absorbance: 0.412,
            slope: fit.slope,
            intercept: fit.intercept,
          },
          toolOutput: unk as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s4",
          type: "tool_call",
          content: "Calling propagate_uncertainty on inverted concentration",
          toolName: "propagate_uncertainty",
          toolInput: {
            operation: "divide",
            a: { value: 0.412 - fit.intercept, uncertainty: 0.002 },
            b: { value: fit.slope, uncertainty: fit.residualStdError },
          },
          toolOutput: unc as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s5",
          type: "final",
          content: `Unknown [CuSO₄] = ${unk.concentration.toPrecision(3)} M (R²=${fit.rSquared.toFixed(4)}).`,
          timestamp: now(),
        },
      ],
      computed: [
        {
          id: "c-slope",
          label: "Calibration slope (εb)",
          value: fit.slope,
          unit: "AU/M",
          significantFigures: 4,
          formula: fit.equation,
          citation: {
            toolName: "linear_regression",
            input: { x, y },
            output: { slope: fit.slope, intercept: fit.intercept, rSquared: fit.rSquared },
            usedFor: "Beer's law calibration fit",
          },
        },
        {
          id: "c-intercept",
          label: "Calibration intercept",
          value: fit.intercept,
          unit: "AU",
          significantFigures: 3,
          citation: {
            toolName: "linear_regression",
            input: { x, y },
            output: { intercept: fit.intercept },
            usedFor: "Blank offset in calibration",
          },
        },
        {
          id: "c-r2",
          label: "R²",
          value: fit.rSquared,
          unit: "",
          significantFigures: 4,
          citation: {
            toolName: "linear_regression",
            input: { x, y },
            output: { rSquared: fit.rSquared },
            usedFor: "Linearity of calibration",
          },
        },
        {
          id: "c-unk",
          label: "Unknown [CuSO₄]",
          value: unk.concentration,
          unit: "M",
          significantFigures: 3,
          formula: unk.formula,
          citation: {
            toolName: "beers_law_concentration",
            input: { absorbance: 0.412, slope: fit.slope, intercept: fit.intercept },
            output: unk as unknown as Record<string, unknown>,
            usedFor: "Unknown sample concentration",
          },
        },
        {
          id: "c-unc",
          label: "Concentration uncertainty",
          value: unc.uncertainty,
          unit: "M",
          significantFigures: 2,
          formula: unc.formula,
          citation: {
            toolName: "propagate_uncertainty",
            input: {},
            output: unc as unknown as Record<string, unknown>,
            usedFor: "Error bar on unknown concentration",
          },
        },
      ],
      chartSeries: [
        {
          id: "calibration",
          label: "Beer's law calibration",
          points: x.map((xi, i) => ({ x: xi, y: y[i], label: `Std ${i + 1}` })),
          fit: {
            slope: fit.slope,
            intercept: fit.intercept,
            rSquared: fit.rSquared,
            equation: fit.equation,
          },
        },
      ],
    };
  }

  if (sampleId === "titration") {
    const volumes = [24.35, 24.3, 24.45];
    const meanV = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const molesNaoh = molarity({
      compute: "moles",
      molarity: 0.1,
      liters: meanV / 1000,
    });
    // 1:1 stoichiometry HCl
    const mHcl = molarity({
      compute: "molarity",
      moles: molesNaoh.result,
      liters: 0.025,
    });
    const pe = percentError({ experimental: mHcl.result, theoretical: 0.1 });
    const unc = propagateUncertainty({
      operation: "multiply",
      a: { value: 0.1, uncertainty: 0.0001 },
      b: { value: meanV / 1000, uncertainty: 0.05 / 1000 },
    });

    return {
      plan: "Average NaOH titer volumes, compute moles NaOH, invert for [HCl], compare to expected 0.100 M.",
      provider: "demo",
      model: "demo-fixture",
      steps: [
        {
          id: "s1",
          type: "plan",
          content: "Average three trials → n_NaOH = M·V → [HCl] = n/V_HCl (1:1).",
          timestamp: now(),
        },
        {
          id: "s2",
          type: "tool_call",
          content: "moles NaOH from mean volume",
          toolName: "molarity",
          toolInput: { compute: "moles", molarity: 0.1, liters: meanV / 1000 },
          toolOutput: molesNaoh as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s3",
          type: "tool_call",
          content: "[HCl] from moles / aliquot",
          toolName: "molarity",
          toolInput: { compute: "molarity", moles: molesNaoh.result, liters: 0.025 },
          toolOutput: mHcl as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s4",
          type: "tool_call",
          content: "percent error vs 0.100 M",
          toolName: "percent_error",
          toolInput: { experimental: mHcl.result, theoretical: 0.1 },
          toolOutput: pe as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s5",
          type: "final",
          content: `[HCl] = ${mHcl.result.toPrecision(4)} M; % error = ${pe.percentError.toFixed(2)}%.`,
          timestamp: now(),
        },
      ],
      computed: [
        {
          id: "c-meanv",
          label: "Mean V_NaOH",
          value: meanV,
          unit: "mL",
          significantFigures: 4,
          citation: {
            toolName: "linear_regression",
            input: { note: "arithmetic mean of three trials" },
            output: { meanV },
            usedFor: "Average titer volume",
          },
        },
        {
          id: "c-mhcl",
          label: "[HCl]",
          value: mHcl.result,
          unit: "M",
          significantFigures: 4,
          formula: mHcl.formula,
          citation: {
            toolName: "molarity",
            input: { compute: "molarity", moles: molesNaoh.result, liters: 0.025 },
            output: mHcl as unknown as Record<string, unknown>,
            usedFor: "Analyte concentration",
          },
        },
        {
          id: "c-pe",
          label: "Percent error",
          value: pe.percentError,
          unit: "%",
          significantFigures: 3,
          formula: pe.formula,
          citation: {
            toolName: "percent_error",
            input: { experimental: mHcl.result, theoretical: 0.1 },
            output: pe as unknown as Record<string, unknown>,
            usedFor: "Accuracy vs expected 0.100 M",
          },
        },
        {
          id: "c-unc",
          label: "n_NaOH uncertainty",
          value: unc.uncertainty,
          unit: "mol",
          significantFigures: 2,
          formula: unc.formula,
          citation: {
            toolName: "propagate_uncertainty",
            input: {},
            output: unc as unknown as Record<string, unknown>,
            usedFor: "Uncertainty on moles NaOH",
          },
        },
      ],
    };
  }

  if (sampleId === "colony-plate") {
    const params = getDemoColonyParams();
    const cfu = computeCfu({
      colonyCount: DEMO_COLONY_COUNT,
      platedVolumeMl: params.platedVolumeMl ?? 0.1,
      dilutionFactor: params.dilutionFactor ?? 1e-4,
    });
    return {
      plan: "Count SAM-segmented colonies, then compute CFU/mL = N / (V × D) with plated volume and dilution.",
      provider: "demo",
      model: "demo-fixture",
      steps: [
        {
          id: "s1",
          type: "plan",
          content:
            "1) Use colony count from SAM quantifier. 2) compute_cfu with V and D from plate label.",
          timestamp: now(),
        },
        {
          id: "s2",
          type: "tool_call",
          content: "CFU/mL from colony count",
          toolName: "compute_cfu",
          toolInput: {
            colonyCount: DEMO_COLONY_COUNT,
            platedVolumeMl: params.platedVolumeMl,
            dilutionFactor: params.dilutionFactor,
          },
          toolOutput: cfu as unknown as Record<string, unknown>,
          timestamp: now(),
        },
        {
          id: "s3",
          type: "final",
          content: `${DEMO_COLONY_COUNT} colonies → ${cfu.cfuPerMl.toExponential(2)} CFU/mL`,
          timestamp: now(),
        },
      ],
      computed: [
        {
          id: "c-count",
          label: "Colony count (SAM)",
          value: DEMO_COLONY_COUNT,
          unit: "colonies",
          significantFigures: 2,
          citation: {
            toolName: "sam_quantifier",
            input: { mode: "colony" },
            output: { colonyCount: DEMO_COLONY_COUNT },
            usedFor: "Discrete colony segmentation count",
          },
        },
        {
          id: "c-cfu",
          label: "CFU/mL",
          value: cfu.cfuPerMl,
          unit: "CFU/mL",
          significantFigures: 2,
          formula: cfu.formula,
          citation: {
            toolName: "compute_cfu",
            input: {
              colonyCount: DEMO_COLONY_COUNT,
              platedVolumeMl: params.platedVolumeMl,
              dilutionFactor: params.dilutionFactor,
            },
            output: cfu as unknown as Record<string, unknown>,
            usedFor: "Viable cell density in stock",
          },
        },
      ],
    };
  }

  // balance
  const moles = molarity({
    compute: "moles",
    grams: 2.847,
    molarMass: 58.44,
  });
  const m = molarity({
    compute: "molarity",
    moles: moles.result,
    liters: 0.1,
  });
  const unc = propagateUncertainty({
    operation: "divide",
    a: { value: 2.847, uncertainty: 0.0001 },
    b: { value: 58.44, uncertainty: 0.01 },
  });

  return {
    plan: "Convert mass to moles with MM(NaCl), then divide by flask volume for molarity.",
    provider: "demo",
    model: "demo-fixture",
    steps: [
      {
        id: "s1",
        type: "tool_call",
        content: "n = m / MM",
        toolName: "molarity",
        toolInput: { compute: "moles", grams: 2.847, molarMass: 58.44 },
        toolOutput: moles as unknown as Record<string, unknown>,
        timestamp: now(),
      },
      {
        id: "s2",
        type: "tool_call",
        content: "M = n / V",
        toolName: "molarity",
        toolInput: { compute: "molarity", moles: moles.result, liters: 0.1 },
        toolOutput: m as unknown as Record<string, unknown>,
        timestamp: now(),
      },
      {
        id: "s3",
        type: "final",
        content: `[NaCl] = ${m.result.toPrecision(4)} M`,
        timestamp: now(),
      },
    ],
    computed: [
      {
        id: "c-moles",
        label: "Moles NaCl",
        value: moles.result,
        unit: "mol",
        significantFigures: 4,
        formula: moles.formula,
        citation: {
          toolName: "molarity",
          input: { compute: "moles", grams: 2.847, molarMass: 58.44 },
          output: moles as unknown as Record<string, unknown>,
          usedFor: "Moles from mass",
        },
      },
      {
        id: "c-m",
        label: "[NaCl]",
        value: m.result,
        unit: "M",
        significantFigures: 4,
        formula: m.formula,
        citation: {
          toolName: "molarity",
          input: { compute: "molarity", moles: moles.result, liters: 0.1 },
          output: m as unknown as Record<string, unknown>,
          usedFor: "Solution molarity",
        },
      },
      {
        id: "c-unc",
        label: "Mass/MM uncertainty",
        value: unc.uncertainty,
        unit: "mol",
        significantFigures: 2,
        citation: {
          toolName: "propagate_uncertainty",
          input: {},
          output: unc as unknown as Record<string, unknown>,
          usedFor: "Uncertainty on moles",
        },
      },
    ],
  };
}

export function getDemoVerification(sampleId: LabSampleId): VerificationResult {
  if (sampleId === "beers-law") {
    return {
      provider: "demo",
      model: "demo-fixture",
      overallConfidence: 0.91,
      summary:
        "Extraction matches the spectrophotometer Abs=0.412 and notebook table. One sig-fig / blank note flagged for user confirmation.",
      flags: [
        {
          id: "f1",
          measurementId: "m-unk",
          severity: "warning",
          code: "SIGFIG_BLANK",
          message:
            "Unknown absorbance 0.412 — confirm blank was zeroed; notebook blank reads 0.002 AU.",
          suggestion: "Subtract blank or confirm instrument auto-zero before accepting.",
        },
        {
          id: "f2",
          measurementId: "m-a0",
          severity: "info",
          code: "NEAR_ZERO",
          message: "Blank absorbance 0.002 is near instrument noise floor.",
        },
      ],
    };
  }
  if (sampleId === "titration") {
    return {
      provider: "demo",
      model: "demo-fixture",
      overallConfidence: 0.88,
      summary: "Burette volumes consistent across trials (±0.15 mL). One sig-fig ambiguity flagged.",
      flags: [
        {
          id: "f1",
          measurementId: "t-v2",
          severity: "warning",
          code: "SIGFIG",
          message: "Trial 2 volume 24.30 mL — trailing zero significant figure ambiguous in handwriting.",
          suggestion: "Confirm as 24.30 (4 sig figs) from burette photo.",
        },
      ],
    };
  }
  if (sampleId === "colony-plate") {
    return {
      provider: "demo",
      model: "demo-fixture",
      overallConfidence: 0.92,
      summary:
        "Colony count 42 matches SAM fixture segmentations. Dilution label confirmation flagged.",
      flags: [
        {
          id: "f1",
          measurementId: "c-cfu",
          severity: "warning",
          code: "DILUTION_LABEL",
          message:
            "CFU/mL assumes 10⁻⁴ dilution from plate label — confirm against notebook before reporting.",
          suggestion: "Match dilution series sticker / notebook entry.",
        },
      ],
    };
  }
  return {
    provider: "demo",
    model: "demo-fixture",
    overallConfidence: 0.94,
    summary: "Balance reading clear; minor transcription precision note.",
    flags: [
      {
        id: "f1",
        measurementId: "b-mass",
        severity: "info",
        code: "PRECISION",
        message: "Display shows 2.8470 g; report uses 2.847 g for molarity calc.",
      },
    ],
  };
}

export function buildDemoReport(
  sampleId: LabSampleId,
  extraction: ExtractionResult,
  agent: AgentResult,
): LabReport {
  const citations = agent.computed.map((c) => c.citation);
  const computedLines = agent.computed
    .map(
      (c) =>
        `- **${c.label}**: ${c.value.toPrecision(c.significantFigures)} ${c.unit} _(tool: \`${c.citation.toolName}\`)_`,
    )
    .join("\n");

  if (sampleId === "beers-law") {
    const unk = agent.computed.find((c) => c.id === "c-unk");
    const r2 = agent.computed.find((c) => c.id === "c-r2");
    const sections = {
      introduction: `This experiment applies Beer's law (A = εbc) to determine the concentration of an unknown CuSO₄ solution using a calibration curve constructed from five standards measured at 635 nm.`,
      methods: `Standards of CuSO₄ (0.00–0.20 M) were prepared and absorbance was recorded on a spectrophotometer at λ = 635 nm with a 1.00 cm path length. An unknown sample was measured under identical conditions. BenchMate extracted values from instrument and notebook photos, then fit A vs [CuSO₄] by ordinary least squares.`,
      data: extraction.tables
        .map(
          (t) =>
            `### ${t.title}\n\n| ${t.headers.join(" | ")} |\n| ${t.headers.map(() => "---").join(" | ")} |\n${t.rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`,
        )
        .join("\n\n") + `\n\nUnknown absorbance: **0.412 AU**.`,
      calculations: `Linear regression (tool \`linear_regression\`) yielded ${agent.chartSeries?.[0]?.fit?.equation ?? "A = m·c + b"}. Unknown concentration from \`beers_law_concentration\`: **${unk?.value.toPrecision(3)} M**. Uncertainty via \`propagate_uncertainty\`.`,
      results: computedLines,
      errorAnalysis: `R² = ${r2?.value.toFixed(4)} indicates strong linearity. Residual standard error from the fit was propagated into the unknown concentration. Primary experimental uncertainty sources: pipetting of standards, cuvette placement, and instrument drift.`,
      conclusion: `The unknown CuSO₄ concentration is **${unk?.value.toPrecision(3)} M**. The calibration is linear (R² ≈ ${r2?.value.toFixed(3)}), supporting Beer's law over the measured range.`,
    };
    const markdown = formatMarkdown(extraction.experimentTitle, sections);
    return { title: extraction.experimentTitle, markdown, sections, citations };
  }

  if (sampleId === "titration") {
    const mhcl = agent.computed.find((c) => c.id === "c-mhcl");
    const pe = agent.computed.find((c) => c.id === "c-pe");
    const sections = {
      introduction: `An acid–base titration was used to standardize hydrochloric acid against 0.1000 M NaOH with phenolphthalein indicator.`,
      methods: `Approximately 25.00 mL aliquots of HCl were titrated with standardized NaOH to a faint pink endpoint. Three trials were recorded from burette initial/final volumes. Deterministic tools computed moles and molarity; no LLM arithmetic was used for final numbers.`,
      data: extraction.tables
        .map(
          (t) =>
            `### ${t.title}\n\n| ${t.headers.join(" | ")} |\n| ${t.headers.map(() => "---").join(" | ")} |\n${t.rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`,
        )
        .join("\n\n"),
      calculations: `Mean V_NaOH used with \`molarity\` (n = M·V) and 1:1 stoichiometry to obtain [HCl]. Percent error vs 0.100 M via \`percent_error\`.`,
      results: computedLines,
      errorAnalysis: `Trial volumes agree within 0.15 mL. Endpoint overshoot and burette reading (±0.05 mL) dominate random error. Propagated uncertainty on n_NaOH reported via \`propagate_uncertainty\`.`,
      conclusion: `[HCl] = **${mhcl?.value.toPrecision(4)} M** with percent error **${pe?.value.toFixed(2)}%** relative to 0.100 M.`,
    };
    return {
      title: extraction.experimentTitle,
      markdown: formatMarkdown(extraction.experimentTitle, sections),
      sections,
      citations,
    };
  }

  if (sampleId === "colony-plate") {
    const cfu = agent.computed.find((c) => c.id === "c-cfu");
    const sections = {
      introduction: `Bacterial colony forming units (CFU) were quantified from a petri-dish photograph. Meta SAM 3.1 segmented discrete colonies; deterministic code counted colonies and computed CFU/mL.`,
      methods: `An LB agar plate (10⁻⁴ dilution, 0.1 mL plated) was imaged. SAM 3.1 produced colony segmentations. Tool \`compute_cfu\` applied CFU/mL = N / (V × D). No LLM arithmetic was used for the reported density.`,
      data: extraction.tables
        .map(
          (t) =>
            `### ${t.title}\n\n| ${t.headers.join(" | ")} |\n| ${t.headers.map(() => "---").join(" | ")} |\n${t.rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`,
        )
        .join("\n\n"),
      calculations: cfu?.formula ?? "CFU/mL = N / (V × D)",
      results: computedLines,
      errorAnalysis: `Primary uncertainties: overlapping colonies (under-count), edge colonies clipped by the dish rim, and dilution labeling. Confirm dilution series before publication.`,
      conclusion: `Stock density ≈ **${cfu?.value.toExponential(2)} CFU/mL** from ${DEMO_COLONY_COUNT} counted colonies.`,
    };
    return {
      title: extraction.experimentTitle,
      markdown: formatMarkdown(extraction.experimentTitle, sections),
      sections,
      citations,
    };
  }

  const m = agent.computed.find((c) => c.id === "c-m");
  const sections = {
    introduction: `Solid NaCl was weighed on an analytical balance and dissolved in a 100.0 mL volumetric flask to prepare a solution of known molarity.`,
    methods: `Mass was read from the balance display; molar mass 58.44 g/mol was applied. Volume assumed 100.0 mL. Tools \`molarity\` and \`propagate_uncertainty\` produced reported values.`,
    data: `Mass NaCl = 2.847 g; V = 100.0 mL; MM = 58.44 g/mol.`,
    calculations: `n = m/MM; M = n/V.`,
    results: computedLines,
    errorAnalysis: `Balance readability ±0.0001 g; volumetric flask tolerance dominates volume uncertainty.`,
    conclusion: `[NaCl] = **${m?.value.toPrecision(4)} M**.`,
  };
  return {
    title: extraction.experimentTitle,
    markdown: formatMarkdown(extraction.experimentTitle, sections),
    sections,
    citations,
  };
}

function formatMarkdown(
  title: string,
  sections: LabReport["sections"],
): string {
  return `# ${title}

## Introduction
${sections.introduction}

## Methods
${sections.methods}

## Data
${sections.data}

## Calculations
${sections.calculations}

## Results
${sections.results}

## Error Analysis
${sections.errorAnalysis}

## Conclusion
${sections.conclusion}

---
*Generated by BenchMate · Meta Global AI Developer Hackathon*
`;
}

export function inferSampleIdFromName(name: string): LabSampleId {
  const n = name.toLowerCase();
  if (
    n.includes("colony") ||
    n.includes("petri") ||
    n.includes("cfu") ||
    n.includes("agar")
  ) {
    return "colony-plate";
  }
  if (n.includes("titrat") || n.includes("burette") || n.includes("acid")) {
    return "titration";
  }
  if (n.includes("balance") || n.includes("nacl") || n.includes("mass")) {
    return "balance";
  }
  return "beers-law";
}
