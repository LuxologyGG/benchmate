# BenchMate Course Lab: evaluation and evidence

All runs on Nov 25, 2026 (America/Chicago) on the `global-ai-builders` branch, production build, free-tier keys.

## How to reproduce

```bash
npm run test:courselab                 # 10 deterministic unit tests, no network
npm run build && npm run eval:courselab  # Playwright vs live models → docs/eval/courselab/
```

`eval:courselab` starts three servers from the same build: **live** (keys from `.env.local`), **badkey** (Groq key deliberately invalid) and **fixture** (`COURSELAB_DEMO_MODE=true`). For each case it clicks through the real UI, captures the API response, saves a full-page screenshot, and writes [`courselab/results.md`](courselab/results.md) and `results.json`.

## Results

See [`courselab/results.md`](courselab/results.md) for the latest generated table (pass/fail, mode, findings, tokens, model latency, screenshot per case).

| Rubric item | Case | Screenshot |
| --- | --- | --- |
| R2 ordinary example | NaCl dilution done right → 0 errors | `01-ordinary-nacl.png` |
| R2 ordinary example | Serial dilution + plating → 0 errors, CFU 4.20×10⁶/mL (`compute_cfu`) | `02-ordinary-serial-dilution.png` |
| R3 repeat check | NaCl run again → same error/warning set as run 01 | `03-repeat-nacl.png` |
| Hero | 1.0 mL instead of 10.0 mL → `TEN_X_ERROR` step 2, `DILUTION_TARGET_MISSED` (0.01 M) | `04-catch-10x.png` |
| R4 demanding | Messy shorthand CuSO₄ notebook → −60% equilibration, missing temperature, off-protocol notes | `05-harder-messy-notebook.png` |
| R4 demanding | Handwritten-style notebook photo → Gemini transcript → 10× caught | `06-harder-handwritten-photo.png` |
| R5 failure handling | Invalid Groq key → warning + deterministic parser still catches 10× | `07-failure-bad-key-fallback.png` |
| No-key path | Labeled fixture replay of recorded live output; checks run live | `08-no-key-fixture-replay.png` |
| R5 failure handling | Empty manual → visible error + Retry | `09-input-error-retry.png` |
| Static hosting | GitHub Pages build, no key → labeled replay | `10-static-fixture-replay.png` |

**Repeat check definition.** Same set of error/warning findings (code + step) on a second live run of the same input. Info-level rows (e.g. a rejected model value) may differ between runs; the generated table says whether the comparison table was identical too.

## Unit tests (`scripts/test-courselab.ts`)

Unit normalization (µL/mL/L, mM/M, h/min) · provenance (number must appear in source) · ordinary NaCl → no errors · 10× catch flagged at step 2 with factor 10 · dilution tool reports 0.01 M and the 10 mL fix · serial dilution → no errors · CFU 42 / (0.1 mL × 10⁻⁴) = 4.2×10⁶ and countable-range logic · harder case flags step 4 + off-protocol note · provenance gate rejects a hallucinated value · fixture replay still runs the real checks. The pre-existing suites (`test:tools`, `test:orchestration`, `test:e2e`) still pass.

## Generic-chatbot baseline (V2)

Raw output: [`baseline-chatbot-2026-11-25.txt`](baseline-chatbot-2026-11-25.txt). Same model (`openai/gpt-oss-20b`, Groq, temperature 0), asked directly with no tools.

* **Easy 10× case:** the chatbot also catches it and computes 0.01 M. No advantage claimed here beyond tool citations and repeatability.
* **CFU question:** the chatbot answered 4.2×10⁶ CFU/mL correctly, 3 of 3 times. No advantage claimed on simple arithmetic.
* **Messy CuSO₄ notebook:** the chatbot found real issues (including the wet beaker, which Course Lab only shows if the model flags it as a note), then fabricated a quantitative answer. It converted “1–2 drops” into “≈1.5 mL”, assumed a “2% reduction”, and reported **≈0.046 M**. Course Lab reports only what its tools can compute.

## Model usage and cost

| Step | Model | Calls per check | Typical tokens | Typical latency |
| --- | --- | --- | --- | --- |
| Extraction | Groq `openai/gpt-oss-20b` (reasoning effort low) | 1 | 1.2–1.6k | 0.7–1.4 s |
| Photo transcription (optional) | Gemini `gemini-3.5-flash-lite` | 1 | ~1.2k | ~4–5 s |

Free tier billed $0. List-price equivalent shown in the UI is about $0.0002 per check. Mistral was evaluated as an optional second-opinion verifier, but the available key returned HTTP 402 (no free API budget), so it is not used.

## Known limits observed

* Model recall varies: in some runs the model skips a value (e.g. the notebook's “10x” inversions). The regex recall net fills most gaps; remaining gaps show as info-level “no recorded …” rows.
* `250 flask` with no unit is read as 250 mL in some runs and missing in others.
* Groq free tier: about 8k tokens/minute for this model, so about 5 checks per minute. One automatic retry on 429.
* The handwritten-page sample is rendered with a handwriting font (Kalam) on lined paper, not a scan.
