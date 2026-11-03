import { isDemoMode } from "@/lib/config";
import { getDemoVerification } from "@/lib/demo/fixtures";
import { chatCompletionJson } from "@/lib/meta-client";
import { getSparkModelId } from "@/lib/config";
import type {
  ExtractionResult,
  LabSampleId,
  VerificationResult,
} from "@/lib/types";

export async function verifyExtraction(input: {
  extraction: ExtractionResult;
  images: Array<{ id: string; name: string; dataUrl: string }>;
  sampleId?: LabSampleId;
}): Promise<VerificationResult> {
  const sampleId =
    input.sampleId ?? input.extraction.sampleId ?? "beers-law";

  if (isDemoMode()) {
    await delay(500);
    const demo = getDemoVerification(sampleId);
    // Mark flagged measurements on a copy-friendly basis (caller merges)
    return demo;
  }

  const imageParts = input.images.slice(0, 4).map((img) => ({
    type: "image_url" as const,
    image_url: { url: img.dataUrl, detail: "high" as const },
  }));

  const { data: parsed, result } = await chatCompletionJson<
    Omit<VerificationResult, "provider" | "model">
  >({
    model: getSparkModelId(),
    max_completion_tokens: 4096,
    maxParseAttempts: 2,
    messages: [
      {
        role: "developer",
        content: `You are BenchMate's verifier. Compare extracted JSON to the lab images. Flag unit mismatches, impossible values (negative volumes, absorbance >> 2 without note, molarity > 20 M, etc.), significant-figure errors, and protocol dilution mistakes. Return ONLY JSON:
{"overallConfidence": number, "summary": string, "flags":[{"id","measurementId","severity":"error"|"warning"|"info","code","message","suggestion?"}]}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Verify this extraction against the images:\n${JSON.stringify(input.extraction, null, 2)}`,
          },
          ...imageParts,
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  return {
    ...parsed,
    flags: parsed.flags ?? [],
    provider: result.provider === "demo" ? "demo" : result.provider,
    model: result.model,
  };
}

export function applyFlagsToMeasurements(
  extraction: ExtractionResult,
  verification: VerificationResult,
): ExtractionResult {
  const byId = new Map(verification.flags.map((f) => [f.measurementId, f]));
  return {
    ...extraction,
    measurements: extraction.measurements.map((m) => {
      const flag = byId.get(m.id);
      if (!flag) return m;
      return {
        ...m,
        flagged: true,
        flagReason: flag.message,
      };
    }),
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
