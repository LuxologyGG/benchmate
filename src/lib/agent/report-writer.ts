import { isDemoMode } from "@/lib/config";
import { buildDemoReport } from "@/lib/demo/fixtures";
import { chatCompletion, extractJsonObject } from "@/lib/meta-client";
import type {
  AgentResult,
  ExtractionResult,
  LabReport,
  LabSampleId,
  VerificationResult,
} from "@/lib/types";

export async function writeLabReport(input: {
  extraction: ExtractionResult;
  agent: AgentResult;
  verification: VerificationResult;
  sampleId?: LabSampleId;
}): Promise<LabReport> {
  const sampleId =
    input.sampleId ?? input.extraction.sampleId ?? "beers-law";

  if (isDemoMode()) {
    await delay(500);
    return buildDemoReport(sampleId, input.extraction, input.agent);
  }

  const result = await chatCompletion({
    messages: [
      {
        role: "developer",
        content: `You write formal undergraduate lab reports in Markdown. Use ONLY numbers from the provided computed[] array and cite tool names inline like (tool: linear_regression). Do not invent data. Return JSON:
{"title":string,"sections":{"introduction","methods","data","calculations","results","errorAnalysis","conclusion"},"markdown":string}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          extraction: input.extraction,
          computed: input.agent.computed,
          chartSeries: input.agent.chartSeries,
          verification: input.verification,
          agentPlan: input.agent.plan,
          steps: input.agent.steps.filter((s) => s.type === "tool_call"),
        }),
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const parsed = extractJsonObject<{
    title: string;
    sections: LabReport["sections"];
    markdown: string;
  }>(result.content ?? "{}");

  return {
    title: parsed.title ?? input.extraction.experimentTitle,
    sections: parsed.sections,
    markdown:
      parsed.markdown ??
      buildMarkdown(parsed.title, parsed.sections),
    citations: input.agent.computed.map((c) => c.citation),
  };
}

function buildMarkdown(title: string, sections: LabReport["sections"]): string {
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
`;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
