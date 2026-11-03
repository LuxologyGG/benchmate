/**
 * Official Meta Model API rates (USD / 1M tokens) from
 * https://dev.meta.ai/docs/pricing-rate-limits — used as spend governor.
 */
export const RATES = {
  "muse-wonder-1.0": { input: 4.0, cachedInput: 0.2, output: 20.0 },
  "muse-spark-1.3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.3-contributor": { input: 0.1, cachedInput: 0.002, output: 0.2 },
  "muse-spark-1.2": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  // SAM is billed per image / frame, not tokens — see estimateSamCost
  "sam-3.1": { input: 0, cachedInput: 0, output: 0 },
  default: { input: 2.0, cachedInput: 0.2, output: 8.0 },
};

/** SAM 3.1: $2.50 / 1,000 images (Meta Model API pricing). */
export const SAM_USD_PER_IMAGE = 2.5 / 1000;
/** SAM 3.1 video: $0.20 / 1,000 frames (min 50 frames billed). */
export const SAM_USD_PER_FRAME = 0.2 / 1000;

export const SPEND_CAP_USD = Number(process.env.MUSE_BUILD_SPEND_CAP || 40);

export function estimateSamCost(usage = {}) {
  const images = usage.images_processed ?? usage.imagesProcessed ?? 0;
  const frames = usage.video_frames_processed ?? usage.videoFramesProcessed ?? 0;
  return images * SAM_USD_PER_IMAGE + frames * SAM_USD_PER_FRAME;
}

export function estimateCost(model, usage = {}) {
  if (model === "sam-3.1" || usage.images_processed || usage.video_frames_processed) {
    const sam = estimateSamCost(usage);
    if (sam > 0 || model === "sam-3.1") return sam;
  }
  const rate = RATES[model] || RATES.default;
  const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const cached =
    usage.prompt_tokens_details?.cached_tokens ??
    usage.input_tokens_details?.cached_tokens ??
    usage.cached_tokens ??
    0;
  const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const uncached = Math.max(0, prompt - cached);
  return (
    (uncached / 1e6) * rate.input +
    (cached / 1e6) * (rate.cachedInput ?? rate.input) +
    (completion / 1e6) * rate.output
  );
}

export class SpendTracker {
  constructor(cap = SPEND_CAP_USD) {
    this.cap = cap;
    this.total = 0;
    this.calls = [];
    this.haltedReason = null;
  }

  record({ model, usage, role, taskId, note }) {
    const cost = estimateCost(model, usage || {});
    this.total += cost;
    const entry = {
      at: new Date().toISOString(),
      model,
      role,
      taskId: taskId || null,
      note: note || null,
      promptTokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
      cachedTokens:
        usage?.prompt_tokens_details?.cached_tokens ??
        usage?.cached_tokens ??
        0,
      costUsd: Number(cost.toFixed(6)),
      totalUsd: Number(this.total.toFixed(6)),
    };
    this.calls.push(entry);
    if (this.total >= this.cap) {
      this.haltedReason = `Spend cap reached ($${this.cap})`;
    }
    return entry;
  }

  halt(reason) {
    this.haltedReason = reason;
  }

  remaining() {
    return this.cap - this.total;
  }

  canAfford(estimate = 0.25) {
    return !this.haltedReason && this.total + estimate < this.cap;
  }

  summary() {
    return {
      capUsd: this.cap,
      totalUsd: Number(this.total.toFixed(4)),
      remainingUsd: Number(this.remaining().toFixed(4)),
      calls: this.calls.length,
      haltedReason: this.haltedReason,
    };
  }
}
