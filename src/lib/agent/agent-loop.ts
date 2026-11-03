import { isDemoMode } from "@/lib/config";
import { getDemoAgent } from "@/lib/demo/fixtures";
import { chatCompletion } from "@/lib/meta-client";
import { executeTool, TOOL_DEFINITIONS } from "@/lib/tools";
import type {
  AgentResult,
  AgentStep,
  ChatMessage,
  ComputedValue,
  ExtractionResult,
  LabSampleId,
} from "@/lib/types";

const MAX_TOOL_ROUNDS = 8;

export async function runCalculationAgent(input: {
  extraction: ExtractionResult;
  sampleId?: LabSampleId;
}): Promise<AgentResult> {
  const sampleId =
    input.sampleId ?? input.extraction.sampleId ?? "beers-law";

  if (isDemoMode()) {
    await delay(700);
    return getDemoAgent(sampleId);
  }

  const steps: AgentStep[] = [];
  const computed: ComputedValue[] = [];
  const messages: ChatMessage[] = [
    {
      role: "developer",
      content: `You are BenchMate's calculation agent. Plan lab calculations, then call tools. NEVER invent numeric results — every reported number must come from a tool. After tools finish, respond with JSON:
{"plan":string,"computed":[{"id","label","value","unit","significantFigures","formula?","citation":{"toolName","input","output","usedFor"}}],"chartSeries":[{"id","label","points":[{"x","y","label?"}],"fit":{"slope","intercept","rSquared","equation"}}]?,"summary":string}`,
    },
    {
      role: "user",
      content: `Extracted lab data:\n${JSON.stringify(input.extraction, null, 2)}\n\nRun the appropriate calculations for a ${sampleId} lab report. Use linear_regression for calibration curves, molarity/dilution for titration/solution prep, percent_error and propagate_uncertainty for error analysis.`,
    },
  ];

  steps.push({
    id: "plan-0",
    type: "plan",
    content: "Agent starting tool loop with deterministic chemistry tools.",
    timestamp: new Date().toISOString(),
  });

  let provider: AgentResult["provider"] = "meta";
  let model = "";
  let finalContent: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatCompletion({
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: round === 0 ? "auto" : "auto",
      max_completion_tokens: 4096,
    });
    provider = response.provider === "demo" ? "demo" : response.provider;
    model = response.model;

    if (response.tool_calls.length === 0) {
      finalContent = response.content;
      steps.push({
        id: `final-${round}`,
        type: "final",
        content: response.content ?? "",
        timestamp: new Date().toISOString(),
      });
      break;
    }

    messages.push({
      role: "assistant",
      content: response.content ?? "",
      tool_calls: response.tool_calls,
    });

    for (const call of response.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      let output: Record<string, unknown>;
      try {
        output = executeTool(call.function.name, args);
      } catch (err) {
        output = { error: err instanceof Error ? err.message : String(err) };
      }

      steps.push({
        id: call.id,
        type: "tool_call",
        content: `Tool ${call.function.name}`,
        toolName: call.function.name,
        toolInput: args,
        toolOutput: output,
        timestamp: new Date().toISOString(),
      });

      if (!("error" in output)) {
        computed.push({
          id: `auto-${call.id}`,
          label: call.function.name,
          value: Number(
            (output as { result?: number; value?: number; concentration?: number; slope?: number; percentError?: number }).result ??
              (output as { value?: number }).value ??
              (output as { concentration?: number }).concentration ??
              (output as { slope?: number }).slope ??
              (output as { percentError?: number }).percentError ??
              0,
          ),
          unit: String((output as { unit?: string }).unit ?? ""),
          significantFigures: 4,
          formula: (output as { formula?: string }).formula,
          citation: {
            toolName: call.function.name,
            input: args,
            output,
            usedFor: call.function.name,
          },
        });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }
  }

  if (finalContent) {
    try {
      const parsed = JSON.parse(
        finalContent.replace(/^```json\s*|\s*```$/g, "").trim(),
      ) as Partial<AgentResult> & { summary?: string };
      return {
        plan: parsed.plan ?? "Tool-assisted calculation complete.",
        steps,
        computed: parsed.computed?.length ? parsed.computed : computed,
        chartSeries: parsed.chartSeries,
        provider,
        model,
      };
    } catch {
      // fall through
    }
  }

  return {
    plan: "Completed tool loop.",
    steps,
    computed,
    provider,
    model,
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
