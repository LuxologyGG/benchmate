import type OpenAI from "openai";
import { convertUnit } from "@/lib/tools/units";
import { dilution, molarity } from "@/lib/tools/stoichiometry";
import { beersLawConcentration, linearRegression } from "@/lib/tools/regression";
import { percentError, percentYield } from "@/lib/tools/percent-error";
import { propagateUncertainty, roundWithUncertainty } from "@/lib/tools/uncertainty";

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "convert_unit",
      description: "Convert a numeric measurement between compatible units (mass, volume, concentration).",
      parameters: {
        type: "object",
        properties: {
          value: { type: "number" },
          fromUnit: { type: "string" },
          toUnit: { type: "string" },
        },
        required: ["value", "fromUnit", "toUnit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "molarity",
      description: "Compute molarity, moles, volume, or mass from stoichiometry relations.",
      parameters: {
        type: "object",
        properties: {
          compute: { type: "string", enum: ["molarity", "moles", "liters", "grams"] },
          moles: { type: "number" },
          liters: { type: "number" },
          grams: { type: "number" },
          molarMass: { type: "number" },
          molarity: { type: "number" },
        },
        required: ["compute"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dilution",
      description: "Solve M1V1 = M2V2 dilution problems.",
      parameters: {
        type: "object",
        properties: {
          m1: { type: "number" },
          v1: { type: "number" },
          m2: { type: "number" },
          v2: { type: "number" },
          solveFor: { type: "string", enum: ["m1", "v1", "m2", "v2"] },
        },
        required: ["m1", "v1", "solveFor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "linear_regression",
      description: "Ordinary least-squares linear fit (e.g. Beer's law calibration). Returns slope, intercept, R².",
      parameters: {
        type: "object",
        properties: {
          x: { type: "array", items: { type: "number" } },
          y: { type: "array", items: { type: "number" } },
          xLabel: { type: "string" },
          yLabel: { type: "string" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "beers_law_concentration",
      description: "Compute unknown concentration from absorbance using calibration slope/intercept.",
      parameters: {
        type: "object",
        properties: {
          absorbance: { type: "number" },
          slope: { type: "number" },
          intercept: { type: "number" },
        },
        required: ["absorbance", "slope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "percent_error",
      description: "Compute percent error vs a theoretical/accepted value.",
      parameters: {
        type: "object",
        properties: {
          experimental: { type: "number" },
          theoretical: { type: "number" },
        },
        required: ["experimental", "theoretical"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "percent_yield",
      description: "Compute percent yield from actual and theoretical amounts.",
      parameters: {
        type: "object",
        properties: {
          actual: { type: "number" },
          theoretical: { type: "number" },
        },
        required: ["actual", "theoretical"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propagate_uncertainty",
      description: "Propagate measurement uncertainty through add/subtract/multiply/divide/scale.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide", "scale"],
          },
          a: {
            type: "object",
            properties: {
              value: { type: "number" },
              uncertainty: { type: "number" },
            },
            required: ["value", "uncertainty"],
          },
          b: {
            type: "object",
            properties: {
              value: { type: "number" },
              uncertainty: { type: "number" },
            },
          },
          k: { type: "number" },
        },
        required: ["operation", "a"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "round_with_uncertainty",
      description: "Round a value consistently with its uncertainty for reporting.",
      parameters: {
        type: "object",
        properties: {
          value: { type: "number" },
          uncertainty: { type: "number" },
        },
        required: ["value", "uncertainty"],
      },
    },
  },
];

export function executeTool(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  switch (name) {
    case "convert_unit":
      return convertUnit(args as { value: number; fromUnit: string; toUnit: string });
    case "molarity":
      return molarity(args as Parameters<typeof molarity>[0]);
    case "dilution":
      return dilution(args as Parameters<typeof dilution>[0]);
    case "linear_regression":
      return linearRegression(args as Parameters<typeof linearRegression>[0]);
    case "beers_law_concentration":
      return beersLawConcentration(args as Parameters<typeof beersLawConcentration>[0]);
    case "percent_error":
      return percentError(args as Parameters<typeof percentError>[0]);
    case "percent_yield":
      return percentYield(args as Parameters<typeof percentYield>[0]);
    case "propagate_uncertainty":
      return propagateUncertainty(args as Parameters<typeof propagateUncertainty>[0]);
    case "round_with_uncertainty":
      return roundWithUncertainty(args as Parameters<typeof roundWithUncertainty>[0]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export {
  convertUnit,
  molarity,
  dilution,
  linearRegression,
  beersLawConcentration,
  percentError,
  percentYield,
  propagateUncertainty,
  roundWithUncertainty,
};
