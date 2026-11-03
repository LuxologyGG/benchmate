# BenchMate Eval Report — Colony / CFU accuracy

**Meta Global AI Developer Hackathon** · 2026-11-03  
**Bases:** Core #1 · Orchestration #2 · Pitch #3 · Eval #4 · ASCII UI #5/#6 · Live API pass  
**Modes compared:** `DEMO_MODE` vs **LIVE** Meta Model API  
**Live API spend (this pass):** **~$0.25** (cap $35) · see [`live-accuracy.json`](./live-accuracy.json)

## Live vs DEMO — accuracy summary

| Case | GT | DEMO | LIVE | LIVE notes |
| --- | ---: | ---: | ---: | --- |
| **Hero colony count** | **42** | **42** (`usedSam=false`) | **42** (`usedSam=true`) | Exact match |
| **Hero CFU/mL** | **4.2×10⁶** | **4.2×10⁶** | **4.2×10⁶** | Exact match |
| **plate-001** | 5 | ≤10% (offline CV) | **5** | Exact · live SAM |
| **gel-001** (bands) | 15 | **15** (offline CV) | **7** | Live SAM under-segments synthetic bands |
| **dilution-error** | DILUTION_10X | **caught** | **caught** | Wonder live · 25 trace events |

Machine-readable live payload: [`live-accuracy.json`](./live-accuracy.json) · DEMO multi-image: [`accuracy.json`](./accuracy.json).

## What broke on first live contact (and fixes)

| Failure | Cause | Fix |
| --- | --- | --- |
| Spark `content: null` | Reasoning tokens exhaust low `max_completion_tokens` | Floor + auto-bump on `finish_reason=length` in `meta-client.ts` |
| SAM returned 0 colonies | Parser expected JSON; API returns special-token grammar | `parseSamSpecialTokenText` in `sam-client.ts` |
| SAM prompts empty | Long biology phrases (`bacterial colony…`) | Short nouns: `dot` / `spot` / `circle` |
| Live smoke assert | Smoke used `max_completion_tokens: 8` | Smoke now uses 512 + spend estimate |
| Dilution live OCR | Wrong sample images (balance + beers notebook) | Added `dilution-notebook.png` with explicit M1/V1/V2/target |

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
| Live subset | hero + plate-001 + gel-001 | — | hero+plate exact | Gel live weaker on synthetic bands |

## Spend

| Item | USD |
| --- | ---: |
| Prior SAM probes (~25 images @ $2.50/1k) | ~0.06 |
| Live hero + plate + gel SAM | ~0.01 |
| Wonder/Spark orchestration envelope (est.) | ~0.18 |
| **Total this pass** | **~$0.25** |
| Cap | $35 |

SAM bills **per image** ($2.50 / 1,000), not tokens. Spark/Wonder bill per token; Spark also burns `reasoning_tokens`.

## How to re-run LIVE (do not print the key)

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
npm run generate:samples     # ensures dilution-notebook.png
npm run test:tools
DEMO_MODE=false npm run test:live-smoke
DEMO_MODE=false npm run eval:live          # hero + plate/gel + Wonder orch
DEMO_MODE=false npm run demo:record:live   # ≤3 min MP4 (trims if needed)
```

Optional: `LIVE_EVAL_SKIP_ORCHESTRATE=1` for SAM-quant-only; `LIVE_EVAL_SPEND_CAP=35`.

## Verified this live pass

- `usedSam=true`, `demoMode=false` on hero / plate-001 / gel-001
- Wonder colony orch → colonyCount **42**, provider `meta`
- Dilution orch → **DILUTION_10X**
- Health: `provider=meta`, `model=muse-spark-1.3`
