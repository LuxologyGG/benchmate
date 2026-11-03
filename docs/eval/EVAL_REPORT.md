# BenchMate Eval Report — Colony / CFU accuracy

**Workstream C (Eval/QA)** · Meta Global AI Developer Hackathon · 2026-11-03  
**Bases:** Core PR #1 (SAM quantifier) + Orchestration PR #2 (Wonder + 10× dilution)  
**Mode:** `DEMO_MODE`  
**API spend:** **$0.00**

## Hero — Wonder → SAM quantifier → CFU

Fixture: `fixtures/colony-plate/` + `public/samples/colony-plate.png`  
Path: Muse Wonder orchestrator (`POST /api/orchestrate`) → Core `runSamQuantifier` → deterministic CFU

| Metric | Manual / GT | BenchMate | Error |
| --- | ---: | ---: | ---: |
| Colony count | **42** | **42** | **0** |
| CFU/mL (= N/(V×D), V=0.1 mL, D=1e-4) | **4.2×10⁶** | **4.2×10⁶** | **0** |
| Exact match | — | **yes** | — |
| Manual count time (est.) | 67 s | — | — |
| BenchMate time | — | ~0.4 s (quant) / ~few s (full Wonder trace) | — |
| **Time saved (count alone)** | — | — | **~66.6 s (≈99%)** |

Formula: `CFU/mL = N / (V × D) = 42 / (0.1 mL × 0.0001)`.

## Protocol wow — Serial Dilution 10× catch

Sample: `dilution-error` (DEMO_MODE). Deterministic `checkProtocolDeviations` (M₁V₁=M₂V₂) flags **`DILUTION_10X`** when notebook volumes imply a 10× pipetting error. Covered by `npm run test:e2e` + `npm run test:orchestration`.

## Multi-image labeled set (18 CC0 fixtures)

Path: `fixtures/colony-eval/` (12 petri + 6 gels). Licenses: `SOURCES.md` (**CC0-1.0**).

Method: offline deterministic blob/band CV (extra generalization set; hero uses Core SAM fixtures).

| Subset | n | MAE | MAPE | Exact | ≤10% err | Time saved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Petri plates | 12 | 2.58 | 5.7% | 50% | **75%** | 519 s |
| Gels (bands) | 6 | **0** | **0%** | **100%** | **100%** | 163 s |
| All multi-image | 18 | 1.72 | 3.8% | 67% | **83%** | **682 s (~99%)** |

Dense plates (n≥42) drive residual plate error (touching colonies). Sparse/medium + all gels exact or ≤10%.

Machine-readable: [`accuracy.json`](./accuracy.json).

## BenchMate vs manual (summary)

| Case | GT | BenchMate | ≤10% | Manual s | BM s | Saved s |
| --- | ---: | ---: | :---: | ---: | ---: | ---: |
| **colony-plate hero (Wonder→SAM+CFU)** | **42 / 4.2e6** | **42 / 4.2e6** | yes | 67 | 0.4 | 66.6 |
| plate-001…008,011 | 5–36 | 5–34 | yes | 15–58 | 0.4 | ~15–58 |
| plate-009,010,012 (dense) | 42–55 | 36–41 | no | 67–85 | 0.4 | ~67–85 |
| gel-001…006 | 14–21 | 14–21 | yes | 25–33 | 0.4 | ~25–33 |
| dilution-error (protocol) | 10× error | **DILUTION_10X** flag | — | — | — | catches before write-up |

## Test commands (fresh clone)

```bash
npm install
cp .env.example .env.local
npm run generate:colony-fixtures    # if fixtures/colony-eval missing
npm run test:tools
npm run test:orchestration
DEMO_MODE=1 npm run eval:colony
DEMO_MODE=1 npm run test:e2e        # Wonder→CFU + 10× dilution + classic pipeline
npm run test:live-smoke             # skips without META_API_KEY
DEMO_MODE=1 npm run verify:fresh-clone
DEMO_MODE=1 npm run dev -- -p 43123
```

## Verified this run

- `npm run test:tools` — CFU + 42 fixture segs
- `npm run test:orchestration` — JSON repair + DILUTION_10X + Wonder DEMO
- `DEMO_MODE=1 npm run eval:colony` — hero exact 42 → 4.2e6
- `DEMO_MODE=1 npm run test:e2e` — `/api/quant`, Wonder colony, Wonder dilution, beers-law pipeline

## Spend

Eval/QA API spend: **$0** (DEMO_MODE only; live smoke optional and skipped without key).
