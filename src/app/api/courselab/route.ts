import { NextResponse } from "next/server";
import { getFixture } from "@/lib/courselab/fixtures";
import { PROVIDERS, type LlmClients } from "@/lib/courselab/llm";
import { runCourseLab } from "@/lib/courselab/pipeline";


function env(name: string) {
  return (process.env[name] ?? "").trim();
}

/** Course Lab is live whenever a free-tier Groq key is present, unless COURSELAB_DEMO_MODE=true. */
function serverClients(): LlmClients | null {
  if (["1", "true", "yes"].includes(env("COURSELAB_DEMO_MODE").toLowerCase())) return null;
  const clients: LlmClients = {};
  if (env("GROQ_API_KEY")) clients.text = { provider: "groq", apiKey: env("GROQ_API_KEY"), model: env("GROQ_MODEL") || undefined };
  if (env("GEMINI_API_KEY")) clients.vision = { provider: "gemini", apiKey: env("GEMINI_API_KEY"), model: env("GEMINI_VISION_MODEL") || undefined };
  return clients.text || clients.vision ? clients : null;
}

export async function GET() {
  const c = serverClients();
  return NextResponse.json({
    live: Boolean(c?.text),
    vision: Boolean(c?.vision),
    textModel: c?.text ? c.text.model || PROVIDERS.groq.defaultModel : null,
    visionModel: c?.vision ? c.vision.model || PROVIDERS.gemini.defaultModel : null,
  });
}

export async function POST(req: Request) {
  let body: { manual?: string; notebook?: string; notebookImage?: string; sampleId?: string; tolerancePct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const manual = String(body.manual ?? "").slice(0, 12000);
  const notebook = String(body.notebook ?? "").slice(0, 8000);
  const notebookImage = typeof body.notebookImage === "string" && body.notebookImage.startsWith("data:image/") && body.notebookImage.length < 6_000_000 ? body.notebookImage : undefined;
  if (!manual.trim()) return NextResponse.json({ error: "Paste a lab-manual excerpt first." }, { status: 400 });
  if (!notebook.trim() && !notebookImage) return NextResponse.json({ error: "Add what you actually did (typed notes or a notebook photo)." }, { status: 400 });
  const tol = Number(body.tolerancePct);
  const tolerancePct = Number.isFinite(tol) && tol > 0 && tol <= 100 ? tol : 10;

  const clients = serverClients();
  try {
    const result = await runCourseLab(
      { manual, notebook, notebookImage, tolerancePct },
      clients ? { llm: clients } : { fixture: getFixture(body.sampleId) },
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
