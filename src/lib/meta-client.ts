import OpenAI from "openai";
import {
  getRequestTimeoutMs,
  resolveProvider,
  type ModelProvider,
} from "@/lib/config";
import {
  isTruncatedJsonError,
  parseJsonRobust,
} from "@/lib/json-repair";
import type { ChatMessage } from "@/lib/types";

export type MetaClientErrorCode =
  | "demo_mode"
  | "missing_key"
  | "timeout"
  | "rate_limit"
  | "server_error"
  | "bad_request"
  | "network"
  | "malformed_response"
  | "unknown";

export class MetaClientError extends Error {
  code: MetaClientErrorCode;
  retryable: boolean;
  status?: number;

  constructor(
    code: MetaClientErrorCode,
    message: string,
    opts?: { retryable?: boolean; status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "MetaClientError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.status = opts?.status;
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
  response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
  prefer?: "meta" | "baseten" | "auto";
  /** Override resolved model (e.g. muse-wonder-1.0 vs muse-spark-1.3). */
  model?: string;
  max_completion_tokens?: number;
}

export interface ChatCompletionResult {
  content: string | null;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  provider: ModelProvider;
  model: string;
  finish_reason?: string | null;
  raw: unknown;
}

/**
 * Default completion budget — truncated JSON was the #1 live failure mode.
 * Muse Spark also burns many tokens as hidden `reasoning_tokens` before content;
 * keep this high enough that short answers are not swallowed by reasoning.
 */
export const DEFAULT_MAX_COMPLETION_TOKENS = 8192;

/** Floor for Spark/Wonder when callers pass a tight budget (reasoning headroom). */
export const MIN_COMPLETION_TOKENS_FOR_REASONING = 1024;

export function createOpenAIClient(prefer?: "meta" | "baseten" | "auto") {
  const resolved = resolveProvider(prefer);
  if (resolved.provider === "demo") {
    return { client: null as OpenAI | null, resolved };
  }
  if (!resolved.apiKey || resolved.apiKey === "demo") {
    throw new MetaClientError(
      "missing_key",
      "META_API_KEY (or BASETEN_API_KEY) is not set. Enable DEMO_MODE or provide a key.",
      { retryable: false },
    );
  }
  const client = new OpenAI({
    apiKey: resolved.apiKey,
    baseURL: resolved.baseUrl,
    timeout: getRequestTimeoutMs(),
    maxRetries: 0, // we handle retries ourselves
  });
  return { client, resolved };
}

function classifyError(err: unknown): MetaClientError {
  if (err instanceof MetaClientError) return err;
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
    name?: string;
  };
  const status = anyErr.status ?? anyErr.statusCode;
  const message = anyErr.message || "Meta Model API request failed";

  if (anyErr.code === "ETIMEDOUT" || /timeout/i.test(message) || anyErr.name === "APIConnectionTimeoutError") {
    return new MetaClientError("timeout", "Meta Model API request timed out", {
      retryable: true,
      cause: err,
    });
  }
  if (status === 429) {
    return new MetaClientError("rate_limit", "Meta Model API rate limited (429)", {
      retryable: true,
      status,
      cause: err,
    });
  }
  if (status && status >= 500) {
    return new MetaClientError("server_error", `Meta Model API server error (${status})`, {
      retryable: true,
      status,
      cause: err,
    });
  }
  if (status && status >= 400) {
    return new MetaClientError("bad_request", `Meta Model API client error (${status})`, {
      retryable: false,
      status,
      cause: err,
    });
  }
  if (/fetch|network|ECONNRESET|ENOTFOUND/i.test(message)) {
    return new MetaClientError("network", "Network error calling Meta Model API", {
      retryable: true,
      cause: err,
    });
  }
  return new MetaClientError("unknown", message, { retryable: false, cause: err });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const { client, resolved } = createOpenAIClient(options.prefer);
  if (!client || resolved.provider === "demo") {
    throw new MetaClientError(
      "demo_mode",
      "DEMO_MODE active — use fixture path instead of live chatCompletion",
      { retryable: false },
    );
  }

  const model = options.model || resolved.model;
  const maxAttempts = 3;
  let lastError: MetaClientError | null = null;
  let tokenBudget = Math.max(
    options.max_completion_tokens ?? DEFAULT_MAX_COMPLETION_TOKENS,
    MIN_COMPLETION_TOKENS_FOR_REASONING,
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: options.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: options.tools,
        tool_choice: options.tool_choice,
        response_format: options.response_format,
        max_completion_tokens: tokenBudget,
      });

      const choice = response.choices?.[0];
      if (!choice?.message) {
        throw new MetaClientError(
          "malformed_response",
          "Meta Model API returned no message choice",
          { retryable: true },
        );
      }

      const message = choice.message;
      const toolCalls = (message.tool_calls ?? [])
        .filter(
          (
            tc,
          ): tc is Extract<
            typeof tc,
            { type?: "function" } & { function: { name: string; arguments: string } }
          > => "function" in tc && !!(tc as { function?: unknown }).function,
        )
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));

      const content = message.content ?? null;
      // Spark often spends the whole budget on reasoning_tokens → empty content + finish=length
      if (
        (content == null || content.length === 0) &&
        toolCalls.length === 0 &&
        choice.finish_reason === "length" &&
        attempt < maxAttempts
      ) {
        tokenBudget = Math.min(tokenBudget * 2, 16384);
        continue;
      }

      return {
        content,
        tool_calls: toolCalls,
        provider: resolved.provider,
        model,
        finish_reason: choice.finish_reason,
        raw: response,
      };
    } catch (err) {
      lastError = classifyError(err);
      if (!lastError.retryable || attempt === maxAttempts) {
        throw lastError;
      }
      const backoff = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    }
  }

  throw lastError ?? new MetaClientError("unknown", "Meta Model API failed");
}

/**
 * Parse model content into JSON with repair for truncated / unterminated output.
 */
export function extractJsonObject<T>(text: string): T {
  try {
    return parseJsonRobust<T>(text);
  } catch (err) {
    throw new MetaClientError(
      "malformed_response",
      err instanceof Error
        ? `Model response JSON could not be parsed: ${err.message}`
        : "Model response JSON could not be parsed",
      { retryable: true, cause: err },
    );
  }
}

/**
 * Chat + JSON parse with automatic repair retry when the model truncates output.
 * Bumps max_completion_tokens on truncation retries.
 */
export async function chatCompletionJson<T>(
  options: ChatCompletionOptions & {
    repairHint?: string;
    maxParseAttempts?: number;
  },
): Promise<{ data: T; result: ChatCompletionResult }> {
  const maxParseAttempts = options.maxParseAttempts ?? 2;
  let tokens = options.max_completion_tokens ?? DEFAULT_MAX_COMPLETION_TOKENS;
  let messages = [...options.messages];
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxParseAttempts; attempt++) {
    const result = await chatCompletion({
      ...options,
      messages,
      max_completion_tokens: tokens,
      response_format: options.response_format ?? { type: "json_object" },
    });

    const truncated =
      result.finish_reason === "length" ||
      /Unterminated string/i.test(result.content ?? "");

    try {
      const data = extractJsonObject<T>(result.content ?? "{}");
      return { data, result };
    } catch (err) {
      lastErr = err;
      const shouldRetry =
        attempt < maxParseAttempts &&
        (truncated || isTruncatedJsonError(err) || (err instanceof MetaClientError && err.retryable));

      if (!shouldRetry) throw err;

      tokens = Math.min(tokens * 2, 16384);
      messages = [
        ...options.messages,
        {
          role: "assistant",
          content: result.content ?? "",
        },
        {
          role: "user",
          content:
            options.repairHint ??
            "Your previous reply was truncated or invalid JSON (unterminated string / unexpected end). Reply again with ONE compact valid JSON object only — no markdown fences, no commentary.",
        },
      ];
    }
  }

  throw (
    lastErr ??
    new MetaClientError("malformed_response", "Failed to obtain valid JSON from model", {
      retryable: false,
    })
  );
}
