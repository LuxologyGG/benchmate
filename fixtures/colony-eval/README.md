# Colony / gel eval fixtures

Labeled **public-domain (CC0)** synthetic petri-plate and gel images for BenchMate Eval/QA (Workstream C).

## Contents

| Path | Purpose |
| --- | --- |
| `images/*.png` | 12 petri plates + 6 gels (18 total) |
| `labels.json` | Ground-truth colony counts / band boxes + licenses |
| `SOURCES.md` | License & provenance ledger |

## Regenerate

```bash
npm run generate:colony-fixtures
```

Seeds are fixed so counts stay stable across regenerations.

## Ground truth

- **Petri plates:** `groundTruthCount` = number of drawn colony circles; per-colony normalized centers in `colonies[]`.
- **Gels:** `groundTruthCount` = number of drawn bands; boxes in `bands[]` with lane ids.

## License

All images and labels in this folder are **CC0-1.0** original BenchMate fixtures — no third-party photographs. Safe for hackathon redistribution under the repo MIT license.
