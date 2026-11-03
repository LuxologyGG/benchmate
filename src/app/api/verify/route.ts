import { NextResponse } from "next/server";
import {
  applyFlagsToMeasurements,
  verifyExtraction,
} from "@/lib/agent/verifier";
import type { ExtractionResult, LabSampleId } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      extraction: ExtractionResult;
      images: Array<{ id: string; name: string; dataUrl: string }>;
      sampleId?: LabSampleId;
    };
    if (!body.extraction) {
      return NextResponse.json({ error: "extraction required" }, { status: 400 });
    }
    const verification = await verifyExtraction({
      extraction: body.extraction,
      images: body.images ?? [],
      sampleId: body.sampleId,
    });
    const extraction = applyFlagsToMeasurements(body.extraction, verification);
    return NextResponse.json({ verification, extraction });
  } catch (err) {
    console.error("verify error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 },
    );
  }
}
