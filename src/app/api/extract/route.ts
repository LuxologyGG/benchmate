import { NextResponse } from "next/server";
import { extractFromImages } from "@/lib/agent/vision";
import type { LabSampleId } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      images: Array<{ id: string; name: string; dataUrl: string }>;
      sampleId?: LabSampleId;
      enableSegmentation?: boolean;
    };

    if (!body.images?.length) {
      return NextResponse.json({ error: "images required" }, { status: 400 });
    }

    const extraction = await extractFromImages({
      images: body.images,
      sampleId: body.sampleId,
      enableSegmentation: body.enableSegmentation ?? true,
    });

    return NextResponse.json({ extraction });
  } catch (err) {
    console.error("extract error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 },
    );
  }
}
