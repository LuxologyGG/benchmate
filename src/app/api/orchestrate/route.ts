import { runWonderOrchestration } from "@/lib/agent/orchestrator";
import type { LabSampleId, TraceEvent } from "@/lib/types";

export const maxDuration = 180;

/**
 * SSE stream of Muse Wonder orchestration.
 * Events: `trace` (live agent steps), `result` (final OrchestrationResult without duplicating full trace), `error`.
 */
export async function POST(req: Request) {
  let body: {
    images: Array<{ id: string; name: string; dataUrl: string }>;
    sampleId?: LabSampleId;
    writeReport?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.images?.length) {
    return new Response(JSON.stringify({ error: "images required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await runWonderOrchestration({
          images: body.images,
          sampleId: body.sampleId,
          writeReport: body.writeReport ?? true,
          onTrace: (ev: TraceEvent) => send("trace", ev),
        });
        // Omit full trace from final payload (already streamed); keep summary counts
        const { trace, ...rest } = result;
        send("result", {
          ...rest,
          traceCount: trace.length,
          deviations: result.deviations,
        });
        send("done", { ok: true });
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : "Orchestration failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
