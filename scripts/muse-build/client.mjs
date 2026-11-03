import { SpendTracker } from "./pricing.mjs";

const BASE = (process.env.META_API_BASE_URL || "https://api.meta.ai/v1").replace(
  /\/$/,
  "",
);

function getKey() {
  const key = (process.env.META_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "META_API_KEY missing. Run: source scripts/load-meta-key.sh",
    );
  }
  return key;
}

export const spend = new SpendTracker(
  Number(process.env.MUSE_BUILD_SPEND_CAP || 40),
);

export async function listModels() {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${getKey()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`models list failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.data || []).map((m) => m.id);
}

/**
 * Chat Completions — used for Wonder planning/review and Spark implementation.
 */
export async function chat({
  model,
  messages,
  role,
  taskId,
  response_format,
  max_completion_tokens = 8192,
  tools,
}) {
  if (!spend.canAfford(0.15)) {
    throw new Error(
      spend.haltedReason ||
        `Spend cap would be exceeded ($${spend.cap}, used $${spend.total.toFixed(2)})`,
    );
  }

  const body = {
    model,
    messages,
    max_completion_tokens,
  };
  if (response_format) body.response_format = response_format;
  if (tools) body.tools = tools;

  let res;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/credit|billing|payment|quota|insufficient/i.test(msg)) {
      spend.halt(`Billing/network error: ${msg}`);
    }
    throw err;
  }

  const text = await res.text();
  if (!res.ok) {
    if (
      res.status === 402 ||
      res.status === 429 ||
      /credit|billing|payment|quota|insufficient/i.test(text)
    ) {
      spend.halt(`API HTTP ${res.status}: billing/credit/rate limit`);
    }
    throw new Error(`chat ${model} HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = JSON.parse(text);
  const usage = data.usage || {};
  spend.record({ model, usage, role, taskId });

  const message = data.choices?.[0]?.message || {};
  return {
    content: message.content || "",
    tool_calls: message.tool_calls || [],
    usage,
    raw: data,
    model,
  };
}

export function extractJson(text) {
  const trimmed = (text || "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const objStart = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  let start = -1;
  let end = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
    start = objStart;
    end = candidate.lastIndexOf("}");
  } else if (arrStart >= 0) {
    start = arrStart;
    end = candidate.lastIndexOf("]");
  }
  if (start < 0 || end <= start) {
    throw new Error("No JSON object/array in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
