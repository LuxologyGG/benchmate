import type { LedgerEntry } from "./types";

/**
 * Tiny isomorphic OpenAI-compatible chat client (fetch only) for free-tier providers.
 * Runs on the Next.js server route (keys from env) or in the browser (bring-your-own key, static build).
 */

export type Provider = "groq" | "gemini" | "mistral";

export const PROVIDERS: Record<Provider, { baseUrl: string; defaultModel: string; priceIn: number; priceOut: number }> = {
  // priceIn / priceOut: approximate public list price, USD per 1M tokens. Free tier bills $0.
  groq: { baseUrl: "https://api.groq.com/openai/v1", defaultModel: "openai/gpt-oss-20b", priceIn: 0.075, priceOut: 0.3 },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash-lite",
    priceIn: 0.1,
    priceOut: 0.4,
  },
  mistral: { baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", priceIn: 0.1, priceOut: 0.3 },
};

export interface ProviderKey {
  provider: Provider;
  apiKey: string;
  model?: string;
}

export interface LlmClients {
  text?: ProviderKey; // structured extraction (Groq by default)
  vision?: ProviderKey; // notebook photo transcription (Gemini by default)
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

export async function chat(
  key: ProviderKey,
  messages: { role: "system" | "user"; content: Content }[],
  opts: { json?: boolean; purpose: string; timeoutMs?: number; maxTokens?: number },
): Promise<{ text: string; ledger: LedgerEntry }> {
  const p = PROVIDERS[key.provider];
  const model = key.model || p.defaultModel;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  try {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          max_tokens: opts.maxTokens ?? 2048,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          // gpt-oss on Groq spends completion tokens on hidden reasoning; keep it short (cheaper, and JSON is not truncated).
          ...(key.provider === "groq" && model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;
        return {
          text,
          ledger: {
            provider: key.provider,
            model,
            purpose: opts.purpose,
            promptTokens,
            completionTokens,
            ms: Date.now() - started,
            listPriceUsd: (promptTokens * p.priceIn + completionTokens * p.priceOut) / 1e6,
          },
        };
      }
      // Retry once on rate limit / server errors; never echo the key.
      const body = (await res.text()).slice(0, 200).replace(/(sk|gsk|AIza)[A-Za-z0-9_\-]{8,}/g, "[redacted]");
      lastErr = new Error(`${key.provider} HTTP ${res.status}: ${body}`);
      if (res.status !== 429 && res.status < 500) break;
      const ra = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Math.min(8000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500)));
    }
    throw lastErr;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a JSON object from model output, tolerating ```json fences. */
export function parseJsonObject(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model returned no JSON object");
  return JSON.parse(t.slice(start, end + 1));
}
