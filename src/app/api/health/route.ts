import { NextResponse } from "next/server";
import { isDemoMode, resolveProvider } from "@/lib/config";

export async function GET() {
  const resolved = resolveProvider();
  return NextResponse.json({
    ok: true,
    demoMode: isDemoMode(),
    provider: resolved.provider,
    model: resolved.model,
  });
}
