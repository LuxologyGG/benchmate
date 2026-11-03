# Sources & licenses — colony-eval fixtures

| Asset ID | Type | Source | License | Notes |
| --- | --- | --- | --- | --- |
| plate-001 … plate-012 | petri_plate PNG | Synthetic generator `scripts/generate-colony-fixtures.mjs` | CC0-1.0 | Original pixels; no Wikimedia/stock photos |
| gel-001 … gel-006 | gel PNG | Same generator | CC0-1.0 | Synthetic UV-gel lookalikes |
| labels.json | annotations | Same generator | CC0-1.0 | Exact GT from draw parameters |

## Why synthetic?

Hackathon Eval/QA needs **reproducible** ground-truth counts and clear redistribution rights. Photographic plates from the web often have unclear licenses and ambiguous merges/splits. These fixtures encode exact colony/band geometry so DEMO_MODE + deterministic CV can be scored without live API spend.

## Reuse

CC0 — no attribution required (appreciated: “BenchMate colony-eval fixtures”). Compatible with the repository MIT license.
