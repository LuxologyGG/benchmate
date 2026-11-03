import { NextResponse } from "next/server";
import { writeLabReport } from "@/lib/agent/report-writer";
import type {
  AgentResult,
  ExtractionResult,
  LabSampleId,
  VerificationResult,
} from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      extraction: ExtractionResult;
      agent: AgentResult;
      verification: VerificationResult;
      sampleId?: LabSampleId;
    };
    if (!body.extraction || !body.agent || !body.verification) {
      return NextResponse.json(
        { error: "extraction, agent, and verification required" },
        { status: 400 },
      );
    }
    const report = await writeLabReport(body);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("report error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report failed" },
      { status: 500 },
    );
  }
}
