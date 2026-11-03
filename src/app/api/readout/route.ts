import { NextResponse } from "next/server";
import { readSparkReadout } from "@/lib/agent/spark-readout";
import type { BoundingBox, LabSampleId } from "@/lib/types";

export const maxDuration = 120;

/**
 * Spark readout reader API — SAM-crop regions, then Muse Spark OCR/interpret.
 * POST { dataUrl, sampleId?, prompt?, boxes? }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataUrl: string;
      sampleId?: LabSampleId;
      prompt?: string;
      boxes?: BoundingBox[];
    };
    if (!body.dataUrl) {
      return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
    }
    const result = await readSparkReadout({
      dataUrl: body.dataUrl,
      sampleId: body.sampleId,
      prompt: body.prompt,
      boxes: body.boxes,
    });
    return NextResponse.json({ readout: result });
  } catch (err) {
    console.error("readout error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Readout failed" },
      { status: 500 },
    );
  }
}
