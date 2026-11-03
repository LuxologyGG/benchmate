import { NextResponse } from "next/server";
import { runCalculationAgent } from "@/lib/agent/agent-loop";
import type { ExtractionResult, LabSampleId } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      extraction: ExtractionResult;
      sampleId?: LabSampleId;
    };
    if (!body.extraction) {
      return NextResponse.json({ error: "extraction required" }, { status: 400 });
    }
    const agent = await runCalculationAgent({
      extraction: body.extraction,
      sampleId: body.sampleId,
    });
    return NextResponse.json({ agent });
  } catch (err) {
    console.error("agent error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent failed" },
      { status: 500 },
    );
  }
}
