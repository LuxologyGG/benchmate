import { NextResponse } from "next/server";
import { runSamQuantifier } from "@/lib/quant/sam-quantifier";
import type { SamQuantMode } from "@/lib/quant/sam-quantifier";
import type { CfuParams } from "@/lib/quant/colony-math";

export const maxDuration = 120;

/**
 * SAM Quantifier API — orchestrator hook for colony counting (+ gel/confluence fallback).
 * POST { dataUrl, mode?, cfu?, prompt? }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataUrl: string;
      mode?: SamQuantMode;
      cfu?: CfuParams;
      prompt?: string;
    };
    if (!body.dataUrl) {
      return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
    }
    const result = await runSamQuantifier({
      dataUrl: body.dataUrl,
      mode: body.mode,
      cfu: body.cfu,
      prompt: body.prompt,
    });
    return NextResponse.json({ quant: result });
  } catch (err) {
    console.error("quant error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quantification failed" },
      { status: 500 },
    );
  }
}
