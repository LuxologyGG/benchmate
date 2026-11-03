# BenchMate

**Photos of handwritten lab notebooks and instrument readouts → a verified, formatted lab report.**

Hackathon project for the **Meta Global AI Developer Hackathon** (deadline Nov 4, 2026).
Solo builder: **Camron Farjami**, University of Michigan (pre-med, biology).

BenchMate is **not a chatbot**. It is an agentic pipeline: vision extraction → tool-using calculation agent → verifier → report writer → PDF/DOCX export.

Full source lives in this repo (text tree pushed via API; clone also available from the Cursor agent remote). See `SUBMISSION.md` and `docs/BUILD_LOG.md`.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run generate:samples   # if sample PNGs missing
npm run dev -- -p 43123
```

DEMO_MODE works without keys. Live mode: set `META_API_KEY`, `META_API_BASE_URL=https://api.meta.ai/v1`, `META_MODEL=muse-spark-1.3`.

## Meta models

| Role | Model |
| --- | --- |
| Vision / agent / verifier / report | `muse-spark-1.3` |
| Segmentation | `sam-3.1` |
| Build orchestrator planner/reviewer | `muse-wonder-1.0` |
| Contributor in muse-build | `muse-spark-1.3` |

## Scripts

`npm run build` · `npm run demo:record` · `npm run muse:build` · `npm run test:tools`

MIT © 2026 Camron Farjami
