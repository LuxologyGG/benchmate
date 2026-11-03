import OpenAI from "openai";
import {
  getRequestTimeoutMs,
  resolveProvider,
  type ModelProvider,
} from "@/lib/config";
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
  raw: unknown;
}

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

  const maxAttempts = 3;
  let lastError: MetaClientError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: resolved.model,
        messages: options.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: options.tools,
        tool_choice: options.tool_choice,
        response_format: options.response_format,
        max_completion_tokens: options.max_completion_tokens ?? 4096,
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

      return {
        content: message.content ?? null,
        tool_calls: toolCalls,
        provider: resolved.provider,
        model: resolved.model,
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

export function extractJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new MetaClientError(
      "malformed_response",
      "Model response did not contain a JSON object",
      { retryable: false },
    );
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch (err) {
    throw new MetaClientError(
      "malformed_response",
      "Model response JSON could not be parsed",
      { retryable: false, cause: err },
    );
  }
}
