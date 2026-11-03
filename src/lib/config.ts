export type ModelProvider = "meta" | "baseten" | "demo";

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function isDemoMode(): boolean {
  const flag = env("DEMO_MODE").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  // Auto-demo when no provider keys are present
  return !env("META_API_KEY") && !env("MODEL_API_KEY") && !env("BASETEN_API_KEY");
}

export function getMetaApiKey(): string | undefined {
  return env("META_API_KEY") || env("MODEL_API_KEY") || undefined;
}

export function getMetaBaseUrl(): string {
  return env("META_API_BASE_URL", "https://api.meta.ai/v1").replace(/\/$/, "");
}

export function getMetaModelId(): string {
  // Prefer META_MODEL (hackathon / docs convention), then META_MODEL_ID
  return env("META_MODEL") || env("META_MODEL_ID") || "muse-spark-1.3";
}

/** Muse Spark 1.3 — specialist vision / calc / report work. */
export function getSparkModelId(): string {
  return env("META_SPARK_MODEL") || getMetaModelId() || META_DEFAULTS.museSpark;
}

/** Muse Wonder 1.0 — in-product orchestrator (plan, dispatch, resolve, report). */
export function getWonderModelId(): string {
  return env("META_WONDER_MODEL") || META_DEFAULTS.museWonder;
}

/** Meta SAM 3.1 Segment endpoint helpers (OpenAI-compatible Model API surface). */
export function getSamModelId(): string {
  return env("META_SAM_MODEL_ID", "sam-3.1");
}

/** Request timeout for Meta/Baseten OpenAI clients (ms). */
export function getRequestTimeoutMs(): number {
  const n = Number(env("META_REQUEST_TIMEOUT_MS", "45000"));
  return Number.isFinite(n) && n >= 5000 ? n : 45000;
}

export const META_DEFAULTS = {
  baseUrl: "https://api.meta.ai/v1",
  museSpark: "muse-spark-1.3",
  museWonder: "muse-wonder-1.0",
  sam: "sam-3.1",
} as const;

export function getBasetenApiKey(): string | undefined {
  return env("BASETEN_API_KEY") || undefined;
}

export function getBasetenBaseUrl(): string {
  return env(
    "BASETEN_API_BASE_URL",
    "https://inference.baseten.co/v1",
  ).replace(/\/$/, "");
}

export function getBasetenModelId(): string {
  return env("BASETEN_MODEL_ID", "meta-models/muse-spark-open-1026");
}

/** Prefer Meta Model API; fall back to Baseten open-weight; else demo. */
export function resolveProvider(prefer?: "meta" | "baseten" | "auto"): {
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  if (isDemoMode()) {
    return {
      provider: "demo",
      baseUrl: "demo://local",
      apiKey: "demo",
      model: "demo-fixture",
    };
  }

  const preferMode = prefer ?? (env("MODEL_PROVIDER", "auto") as "meta" | "baseten" | "auto");
  const metaKey = getMetaApiKey();
  const basetenKey = getBasetenApiKey();

  if (preferMode === "baseten" && basetenKey) {
    return {
      provider: "baseten",
      baseUrl: getBasetenBaseUrl(),
      apiKey: basetenKey,
      model: getBasetenModelId(),
    };
  }

  if ((preferMode === "meta" || preferMode === "auto") && metaKey) {
    return {
      provider: "meta",
      baseUrl: getMetaBaseUrl(),
      apiKey: metaKey,
      model: getMetaModelId(),
    };
  }

  if (basetenKey) {
    return {
      provider: "baseten",
      baseUrl: getBasetenBaseUrl(),
      apiKey: basetenKey,
      model: getBasetenModelId(),
    };
  }

  return {
    provider: "demo",
    baseUrl: "demo://local",
    apiKey: "demo",
    model: "demo-fixture",
  };
}

export const APP = {
  name: "BenchMate",
  tagline: "From lab notebook photos to verified reports",
  author: "Camron Farjami",
  affiliation: "University of Michigan",
  hackathon: "Meta Global AI Developer Hackathon",
} as const;
