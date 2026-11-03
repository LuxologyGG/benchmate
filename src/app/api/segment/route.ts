import { NextResponse } from "next/server";
import { segmentReadouts } from "@/lib/agent/vision";
import type { LabSampleId } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataUrl: string;
      sampleId?: LabSampleId;
    };
    if (!body.dataUrl) {
      return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
    }
    const boundingBoxes = await segmentReadouts(body);
    return NextResponse.json({
      boundingBoxes,
      note: "Live path: Meta SAM 3.1 (sam-3.1) via Responses API; DEMO_MODE uses fixtures; Muse Spark vision is the fallback.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Segmentation failed" },
      { status: 500 },
    );
  }
}
