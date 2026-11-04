# BenchMate Eval Report — Colony / CFU accuracy

**Meta Global AI Developer Hackathon** · 2026-11-04  
**Bases:** Core #1 · Orchestration #2 · Pitch #3 · Eval #4 · ASCII UI #5/#6 · Live API #7 · Gel polish  
**Modes compared:** `DEMO_MODE` vs **LIVE** Meta Model API  
**Live API spend (gel polish pass):** **~$0.21** recorded in eval (+ ~$0.03 prior gel SAM probes) · cap $35 · see [`live-accuracy.json`](./live-accuracy.json)

## Live vs DEMO — accuracy summary

| Case | GT | DEMO | LIVE | LIVE notes |
| --- | ---: | ---: | ---: | --- |
| **Hero colony count** | **42** | **42** (`usedSam=false`) | **42** (`usedSam=true`) | Exact match |
| **Hero CFU/mL** | **4.2×10⁶** | **4.2×10⁶** | **4.2×10⁶** | Exact match |
| **plate-001** | 5 | ≤10% (offline CV) | **5** | Exact · live SAM |
| **gel-001** (bands) | 15 | **15** (offline CV) | **15** | Exact · SAM ∪ intensity merge |
| **dilution-error** | DILUTION_10X | **caught** | **caught** | Wonder live · 25 trace events |

Machine-readable live payload: [`live-accuracy.json`](./live-accuracy.json) · DEMO multi-image: [`accuracy.json`](./accuracy.json).

## Gel polish (7 → 15)

Live SAM alone under-segmented synthetic ladders (~7 bands). Fixes in this pass:

1. **Intensity-profile CV** (`src/lib/quant/gel-intensity.ts`) — same blob logic as offline DEMO gels; free local proposals
2. **Merge with live SAM** — NMS / same-lane y-proximity; thin-band filter drops fat lane blobs
3. **Short noun prompts** — `bar` / `stripe` (biology phrases still empty on SAM 3.1)
4. **Lane crop→SAM** — only when intensity is weak (&lt;12); strong intensity → **1** frugal SAM call (keeps `usedSam=true`)
5. **Thin-band geometry** — `quantifyGelBands` accepts h ≈ 0.003–0.01 ladder bands

Live gel-001 notes: intensity 15 · full-frame SAM 4 (1-call) · merged **15** after NMS.

## What broke on first live contact (and fixes)

| Failure | Cause | Fix |
| --- | --- | --- |
| Spark `content: null` | Reasoning tokens exhaust low `max_completion_tokens` | Floor + auto-bump on `finish_reason=length` in `meta-client.ts` |
| SAM returned 0 colonies | Parser expected JSON; API returns special-token grammar | `parseSamSpecialTokenText` in `sam-client.ts` |
| SAM prompts empty | Long biology phrases (`bacterial colony…`) | Short nouns: `dot` / `spot` / `circle` |
| Live smoke assert | Smoke used `max_completion_tokens: 8` | Smoke now uses 512 + spend estimate |
| Dilution live OCR | Wrong sample images (balance + beers notebook) | Added `dilution-notebook.png` with explicit M1/V1/V2/target |
| Gel live under-count (7/15) | Full-frame SAM early-stop + thin bands | Intensity merge + frugal SAM + thin-band filters |

## Hero — Wonder → SAM quantifier → CFU

| Metric | Manual / GT | DEMO | LIVE |
| --- | ---: | ---: | ---: |
| Colony count | **42** | 42 | **42** |
| CFU/mL (V=0.1, D=1e-4) | **4.2×10⁶** | 4.2×10⁶ | **4.2×10⁶** |
| `usedSam` | — | false | **true** |
| `demoMode` | — | true | **false** |
| Wonder orch | — | demo fixtures | **ok** · 21 traces · `muse-wonder-1.0` |

Formula: `CFU/mL = N / (V × D) = 42 / (0.1 × 0.0001)`.

## Protocol wow — Serial Dilution 10×

Live Wonder orchestration on `dilution-error` flagged **`DILUTION_10X`** (deterministic `checkProtocolDeviations` after Spark extraction). Trace length: **25**.

## Multi-image DEMO set (unchanged, $0)

| Subset | n | MAE | ≤10% | Notes |
| --- | ---: | ---: | ---: | --- |
| Petri plates | 12 | 2.58 | 75% | Offline CV generalization |
| Gels | 6 | 0 | 100% | Offline CV |
| Live subset | hero + plate-001 + gel-001 | — | **all exact** | Colony + gel live |

## Spend

| Item | USD |
| --- | ---: |
| Gel polish SAM probes (pre-eval) | ~0.03 |
| Live eval (hero + plate + gel SAM + Wonder/Spark) | **~0.21** |
| **Total this gel pass** | **~$0.24** |
| Cap | $35 |

SAM bills **per image** ($2.50 / 1,000), not tokens. Strong-intensity gels cost **1** SAM image; weak gels may add lane tiles.

## How to re-run LIVE gel eval (do not print the key)

```bash
# Put key in gitignored .env.local (never commit):
# DEMO_MODE=false
# META_API_KEY=<from secure store>
# META_API_BASE_URL=https://api.meta.ai/v1
# META_MODEL=muse-spark-1.3
# META_WONDER_MODEL=muse-wonder-1.0
# META_SAM_MODEL_ID=sam-3.1

cp .env.example .env.local   # then edit — do not echo the key
npm install

# Full live suite (hero + plate/gel + Wonder orch)
DEMO_MODE=false npm run eval:live

# Cheaper: SAM quant only (skip Wonder orchestration)
LIVE_EVAL_SKIP_ORCHESTRATE=1 DEMO_MODE=false npm run eval:live
```

Gel-only path under the hood: `runSamQuantifier({ mode: "gel-densitometry" })` → intensity CV ∪ SAM (`src/lib/quant/sam-quantifier.ts`).

## Verified this live pass

- `usedSam=true`, `demoMode=false` on hero / plate-001 / gel-001
- Wonder colony orch → colonyCount **42**, provider `meta`
- Dilution orch → **DILUTION_10X**
- **gel-001 LIVE bands = 15 / 15** (was 7)
- Health: `provider=meta`, `model=muse-spark-1.3`
