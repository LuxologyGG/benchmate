# What existed vs what was built for the Global AI Builder's Challenge

Event window: **Nov 21–28, 2026**. All times America/Chicago (CT).

## Already existed (BenchMate, Meta Global AI Developer Hackathon, built Nov 3, 2026)

Last pre-event commit: `aa415f1`, Nov 3, 2026 8:52 PM CT.

* Next.js + TypeScript app (MIT), ASCII/terminal visual style.
* Deterministic TypeScript tools: unit conversion, molarity, `dilution` (M1·V1 = M2·V2), regression / Beer's law, percent error, uncertainty, `compute_cfu`.
* A single hard-coded 10× dilution demo (`dilution-error` fixture) with a Muse Wonder agent trace.
* Plate-CFU hero: 42 SAM-style colony masks → 4.2×10⁶ CFU/mL, gel-band quantifier, PDF/DOCX/MD export.
* Paid Meta stack (Muse Wonder, Muse Spark, SAM 3.1). The documented judge path was `DEMO_MODE` fixture replay, not a live run.

## Built during this event (Nov 25, 2026, branch `global-ai-builders`)

| Area | Change | Where |
| --- | --- | --- |
| New capability | **Teaching-lab mode**: paste any lab-manual excerpt + your notebook (typed or a photo), get a step-by-step deviation check. Works on protocols it has never seen, not just one fixture. | `src/lib/courselab/`, `src/components/courselab/` |
| AI integration | Free-tier models replace the paid stack: **Groq `openai/gpt-oss-20b`** for structured extraction (1 call per check), **Gemini `gemini-3.5-flash-lite`** for optional notebook-photo transcription. | `src/lib/courselab/llm.ts` |
| Reliability | **Provenance gate**: a model-proposed number is used only if it literally appears in the source text (and in the model's own quote when that quote is real). Rejected values are listed. | `pipeline.ts` `verifyProvenance` |
| Reliability | **Regex recall net**: deterministic parser adds numbers the model skipped (multiset merge, role-aware). | `pipeline.ts` `mergeDeterministic` |
| Reliability | General deviation engine: unit normalization, power-of-ten detection (10×, 100×), tolerance drift, missing values, temperature delta, dilution consequence with corrected volume, off-protocol notes, global step/role/name matching. | `checks.ts`, `units.ts`, `parse.ts` |
| Reliability | Fail-safe paths: model error/rate limit → deterministic parser with visible warning; photo failure → typed path; no key → **labeled** fixture replay of recorded live output. One retry on 429/5xx. | `pipeline.ts`, `llm.ts` |
| Live by default | Live path is the default whenever `GROQ_API_KEY` is set. On-screen model/tool trace and **spend ledger** (tokens, ms, $0 billed, list-price equivalent). | UI |
| UX / accessibility | New home page ordered as catch → record: deviation banner (`role="alert"`), comparison table, CFU panel with 30–300 countable-range check, export **locked until deviations are acknowledged**, keyboard-reachable controls, visible error + Retry, dismissible “what's new” banner. Classic app moved to `/classic`. | `course-lab.tsx`, `src/app/` |
| Hosting | Static GitHub Pages build (browser-side pipeline, bring-your-own free Groq key, no secrets shipped). | `scripts/build-static.mjs`, `scripts/deploy-pages.sh` |
| Evidence | 10 unit tests; Playwright eval pack (2 ordinary, 1 repeat, 2 harder, hero catch, bad-key failure, no-key replay, input error) with screenshots; chatbot baseline run. | `scripts/test-courselab.ts`, `scripts/eval-courselab.mjs`, `docs/eval/` |
| Docs | New README, Devpost draft, demo script, this changelog, `.env.example` with free-tier names only. | repo root |
| Housekeeping | Two `prefer-const` lint fixes in classic code. | `src/lib/quant/` |

Not changed: the classic plate-CFU / gel flows and their Meta-model code paths (still available at `/classic`).
