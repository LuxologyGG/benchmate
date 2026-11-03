/**
 * Robust JSON extraction + repair for Meta Model API responses that are
 * truncated (max_tokens), fence-wrapped, or contain unterminated strings.
 */

export class JsonRepairError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "JsonRepairError";
  }
}

/** Strip markdown fences and locate the outermost JSON object/array. */
export function isolateJsonCandidate(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new JsonRepairError("Empty model response");
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const objStart = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start < 0) {
    throw new JsonRepairError("No JSON object/array in model response");
  }
  return candidate.slice(start);
}

function tryParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Close truncated JSON by balancing braces/brackets and strings. */
export function closeTruncatedJson(input: string): string {
  let s = input.trim();
  // Drop trailing incomplete key/value crumbs after last safe delimiter
  s = s.replace(/,\s*$/, "");

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }

  if (inString) {
    // Unterminated string — close it
    if (escape) s += "\\";
    s += '"';
  }

  // Remove dangling colon / comma before we close containers
  s = s.replace(/,\s*$/, "");
  s = s.replace(/:\s*$/, ": null");
  s = s.replace(/,\s*"[^"]*"\s*$/, "");
  s = s.replace(/,\s*$/, "");

  while (stack.length) {
    s += stack.pop();
  }
  return s;
}

/** Light syntactic cleanup that does not invent values. */
export function softCleanJson(input: string): string {
  let s = input.trim();
  // trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  // smart quotes
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  return s;
}

/**
 * Parse model JSON with progressive repair.
 * Order: raw → soft clean → close truncation → last complete object slice.
 */
export function parseJsonRobust<T = unknown>(text: string): T {
  const candidate = isolateJsonCandidate(text);

  const attempts = [
    candidate,
    softCleanJson(candidate),
    softCleanJson(closeTruncatedJson(candidate)),
  ];

  // Also try cutting back to the last complete top-level close
  const lastBrace = candidate.lastIndexOf("}");
  if (lastBrace > 0) {
    attempts.push(softCleanJson(closeTruncatedJson(candidate.slice(0, lastBrace + 1))));
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    const parsed = tryParse<T>(attempt);
    if (parsed !== null) return parsed;
    try {
      return JSON.parse(attempt) as T;
    } catch (err) {
      lastErr = err;
    }
  }

  throw new JsonRepairError(
    lastErr instanceof Error
      ? `JSON repair failed: ${lastErr.message}`
      : "JSON repair failed",
    lastErr,
  );
}

/** True when the error looks like truncated / unterminated JSON. */
export function isTruncatedJsonError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /Unterminated string|Unexpected end|Unexpected token|JSON repair failed|could not be parsed|did not contain a JSON/i.test(
    msg,
  );
}
