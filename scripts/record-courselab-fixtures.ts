/**
 * Records real Groq extraction output for each built-in sample into src/lib/courselab/fixtures.json.
 * The no-key "fixture replay" path replays these; deterministic checks still run live on top.
 * Run: GROQ_API_KEY=... npm run courselab:record
 */
import { writeFileSync } from "node:fs";
import { chat, parseJsonObject } from "../src/lib/courselab/llm";
import { EXTRACTION_SYSTEM } from "../src/lib/courselab/pipeline";
import { SAMPLES } from "../src/lib/courselab/samples";

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const out: Record<string, unknown> = { recordedAt: new Date().toISOString(), note: "Raw model output recorded from a live free-tier Groq run. Replayed only when no key is configured." };
  for (const s of SAMPLES) {
    const r = await chat(
      { provider: "groq", apiKey: key },
      [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: `MANUAL:\n"""\n${s.manual}\n"""\n\nNOTEBOOK:\n"""\n${s.notebook}\n"""` },
      ],
      { json: true, purpose: "extract steps + notebook values", maxTokens: 3000 },
    );
    out[s.id] = { raw: parseJsonObject(r.text), ledger: [r.ledger] };
    console.log(s.id, r.ledger.promptTokens, r.ledger.completionTokens, r.ledger.ms + "ms");
    await new Promise((res) => setTimeout(res, 4000));
  }
  writeFileSync("src/lib/courselab/fixtures.json", JSON.stringify(out, null, 2) + "\n");
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
