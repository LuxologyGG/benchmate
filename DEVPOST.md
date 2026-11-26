# Devpost draft: BenchMate Course Lab

> Draft for Camron to paste into the Devpost project page. Nothing has been submitted. Fill the `[TODO]` items.

**Project name:** BenchMate Course Lab
**Tagline:** A student lab partner that catches a 10× pipetting mistake before it ruins the run, and writes a record that cites every number's source.
**Try it:** https://luxologygg.github.io/benchmate/ (static; built-in examples replay recorded model output, or paste your own free Groq key to run live)
**Code:** https://github.com/LuxologyGG/benchmate (branch `global-ai-builders`, PR [TODO: link once merged or keep PR link])
**Video:** [TODO: YouTube/Vimeo URL, embedding on, playable signed out]
**Built with:** Next.js, TypeScript, React, Tailwind, Groq API (openai/gpt-oss-20b), Google Gemini API (gemini-3.5-flash-lite), Playwright, GitHub Pages
**Team:** Camron Farjami (solo), University of Michigan

---

## Inspiration

I have done wet-lab bench work at USC Norris Comprehensive Cancer Center and Loma Linda, and I am now in undergrad teaching labs. The most expensive mistakes I have seen are boring: the 1 mL pipette instead of the 10 mL one, a decimal in the wrong place, a step skipped because the line for the spectrophotometer was long. A TA cannot watch every bench, and the notebook that would reveal the mistake is read after the lab, if ever.

## What it does

1. Paste the lab-manual steps (any intro chem or bio protocol).
2. Type what you actually did, or upload a photo of your notebook page.
3. Click **Check my run**. In about a second you get:
   * a **Stop** banner when something is off by an exact power of ten (*“Step 2: 10× less transfer volume than the protocol. Working solution is 0.01 M, not 0.1 M. Fix: use 10 mL of 1 M stock in 100 mL.”*),
   * tolerance drift (e.g. equilibration 2 min vs 5 min, −60%), missing values, and notes where you said you skipped or changed a step,
   * a protocol-vs-notebook table, and a CFU/mL calculator with a 30–300 countable-range check for plate counts,
   * a Markdown record that cites the deterministic tool behind every number. Export stays locked until you tick that you have read the flagged deviations.

## V1: Who needs it, with a use example

Undergraduate and trainee wet-lab students, and the TAs who supervise 20+ benches. Example: CHEM 125 Lab 3 asks for 10.0 mL of 1.0 M NaCl in a 100.0 mL flask. A student writes `pipetted 1.0 mL of 1.0 M NaCl stock (grabbed the 1 mL pipette)`. Course Lab flags `TEN_X_ERROR` at step 2 and computes, with the `dilution` tool, that the working solution is 0.01 M, before the student makes a calibration curve from it.

## V2: Advantage over a real alternative (we ran it)

On Nov 25, 2026 we asked the same free model (gpt-oss-20b on Groq, temperature 0, no tools) to review the messy CuSO₄ notebook directly, like a student would with a chatbot. It listed real problems, then **invented numbers**: it turned “lost maybe 1–2 *drops*” into “≈1.5 *mL*”, assumed a “2% reduction” from a wet beaker, and reported a made-up final concentration of **0.046 M**. Course Lab, on the same input, flagged the −60% equilibration time, the unrecorded temperature and the missed stopper, and did not produce a concentration it could not compute. A paper worksheet catches none of this until results look wrong. On the easy 10× case both the chatbot and Course Lab catch it; the difference is that every Course Lab number names its tool and the result is repeatable. Raw baseline output is in `docs/eval/baseline-chatbot-2026-11-25.txt`.

## V3: Realistic for the user

It runs in a browser with no install. It needs only free-tier keys (or none, for the built-in examples). One model call per check, about 1.2–1.6k tokens, about one second.

## How we built it (A1–A3: AI in the product)

* **A1, what the AI does:** Groq `openai/gpt-oss-20b` reads the manual and notebook and returns JSON: steps, quantities, a role for each value (stock concentration, transfer volume, final volume, time, temperature…), and which manual step each notebook value belongs to, matched by meaning rather than position. With a photo, Gemini `gemini-3.5-flash-lite` transcribes the page first, transcription only.
* **A2, why it is trustworthy:** the model only *locates* numbers. Code then checks the model:
  * **Provenance gate:** a proposed value is used only if that number literally appears in the source text, and inside the model's quote when the quote is real. Anything else is dropped and shown as `UNVERIFIED_EXTRACTION`.
  * **Recall net:** a deterministic parser adds numbers the model skipped.
  * **Deterministic tools do all math:** `unit_normalize`, `ratio_check` (exact powers of ten → `TEN_X_ERROR`), `dilution` (M1·V1 = M2·V2 → concentration actually made and corrected volume), `compute_cfu`.
* **A3, fallbacks and cost:** no key → clearly labeled replay of recorded live output (checks still run live). Model error or rate limit → deterministic parser with a visible warning. The on-screen trace shows each model and tool step, and a ledger shows tokens, latency, $0 billed and the list-price equivalent (about $0.0002 per check).

## Functionality and reliability (R1–R5)

* **Setup / access:** static site (link above), or `npm install && cp .env.example .env.local && npm run dev`. Env vars: `GROQ_API_KEY` (free), optional `GEMINI_API_KEY` (free).
* **Evidence:** `npm run test:courselab` (10 unit tests). `npm run eval:courselab` drives the production build in Playwright against live free-tier models and saves screenshots plus a results table in `docs/eval/courselab/`. Latest run, Nov 25, 2026: **9/9 passed.**

| Case | Path | Result |
| --- | --- | --- |
| R2 ordinary #1: NaCl dilution done right | live | 0 errors |
| R2 ordinary #2: serial dilution + plating | live | 0 errors, CFU 4.20×10⁶/mL |
| R3 repeat of ordinary #1 | live | same findings, identical table |
| Hero: 1.0 mL instead of 10.0 mL | live | `TEN_X_ERROR` step 2, working solution 0.01 M |
| R4 harder: messy shorthand notebook | live | −60% equilibration, missing temperature, off-protocol notes (no stopper, short wait) |
| R4 harder: handwritten-style notebook photo | live (Gemini + Groq) | 10× caught from the transcript |
| R5 failure: invalid Groq key | fallback | warning shown, still catches 10× |
| No key | labeled fixture replay | catches 10× |
| Empty input | UI | visible error + Retry |

* **Honest limits:** teaching-lab aid, not a medical device, and no reagent sourcing. The model can still miss or mis-assign a value; the gate and net reduce this but do not remove it (e.g. whether `250 flask` without a unit is read as 250 mL varies between runs). Qualitative issues show up only if the student writes them down. The photo example is a handwriting-style font, not a real scan. Groq's free tier allows about 5 checks a minute.

## Design and UX

Calm dark UI with one accent color. The order is catch → evidence → record: banner first, then deviations with the tool named on each, then the table, trace and ledger. All primary actions are keyboard-reachable buttons, the deviation banner uses `role="alert"`, errors are visible with a Retry, and export is gated on acknowledgement rather than hidden.

## Challenges

* Free-tier reasoning models spend completion tokens on hidden reasoning, which truncated JSON until we set low reasoning effort.
* The first version let the model's “pipette size” steal the “transfer volume” match. We replaced per-item matching with a global step + role + name assignment.
* One Gemini model name was retired for new keys mid-build. The fallback path handled it, and we switched to `gemini-3.5-flash-lite`.

## What's next

A TA dashboard that aggregates flags across benches. A lab-manual library so students pick the protocol instead of pasting it. Testing on real scanned notebook pages.

---

## Development disclosure (existing project)

BenchMate existed before this event: it was built on Nov 3, 2026 for the Meta Global AI Developer Hackathon (last pre-event commit `aa415f1`). That build had the deterministic chemistry/CFU tools, one hard-coded 10× demo fixture, the plate-CFU and gel flows, and a paid Meta model stack whose documented judge path was fixture replay.

Built during Nov 21–28, 2026 (all on Nov 25, branch `global-ai-builders`): the teaching-lab mode that checks arbitrary protocols against a notebook; the free-tier Groq/Gemini integration; the provenance gate and regex recall net; the general deviation engine; the fail-safe paths and labeled replay; the new UI with trace, ledger, CFU range check and acknowledgement-gated export; the static GitHub Pages build; and the tests, eval pack, baseline comparison and docs. Full table: `CHANGELOG-HACKATHON.md`.

## AI disclosure

* **AI in the product:** Groq `openai/gpt-oss-20b` (structured extraction) and Google `gemini-3.5-flash-lite` (optional photo transcription), both on free tiers. No model computes any reported number.
* **AI in development:** most of the Nov 25 code, tests and documentation were written by an AI coding agent (Grok Bot, Camron's personal agent, running on Cursor) working from Camron's brief and the post-mortem of the Meta entry. Camron set the direction (teaching-lab focus, live path first, free tier only, no medical/vendor features). [TODO Camron: describe what you personally reviewed or changed, e.g. “I reviewed the diff, ran the app, and edited …”.] The work was checked by unit tests, a Playwright eval against live models, and the provenance gate. The chatbot baseline in V2 was run by that agent on the same free model.
* The original Nov 3 BenchMate was built with Muse Wonder/Spark (Meta) plus a Cursor agent; see `docs/BUILD_LOG.md`.
