# Meta Global AI Developer Hackathon — Submission Draft

**Project:** BenchMate  
**Builder:** Camron Farjami · University of Michigan · Pre-med / Biology  
**Deadline:** Nov 4, 2026 9:00 PM ET  

---

## Project Description

BenchMate turns photos of handwritten lab notebooks and instrument readouts (analytical balances, burettes, spectrophotometer screens, data tables) into a **verified, formatted lab report**.

It is an **agentic pipeline**, not a chatbot:

1. **Vision extraction** — Muse Spark multimodal reads the images into structured JSON with units and significant figures; optional SAM-style region boxes highlight readouts in the UI.
2. **Tool-using agent** — Muse plans calculations and calls deterministic tools (unit conversion, stoichiometry/molarity, linear regression for Beer's law, percent error, uncertainty propagation). **Every reported number is computed in code and cited to a tool.**
3. **Verifier** — A second model pass compares extraction to the image, flags inconsistencies, and asks the user to confirm flagged cells.
4. **Report writer** — Generates Introduction / Methods / Data / Calculations / Results / Error Analysis / Conclusion in Markdown, with calibration charts, then exports PDF and DOCX.

Built as a Next.js (TypeScript) web app with DEMO_MODE fixtures so judges can run the full flow without API keys, plus live Meta Model API and Baseten Muse Spark Open providers.

---

## Describe your use of Meta products

- **Meta Model API** ([dev.meta.ai/docs/overview](https://dev.meta.ai/docs/overview)) — OpenAI-compatible Chat Completions + Responses at `https://api.meta.ai/v1` with **Muse Spark 1.3** (`muse-spark-1.3`, vision-capable, 1M context) for:
  - Multimodal vision extraction (base64 `image_url` parts)
  - Function-calling agent loop over chemistry tools
  - Verifier pass (image + JSON consistency)
  - Lab report drafting
- **SAM 3.1 Segment** (`sam-3.1` via Responses API) — text-prompted boxes/masks for readout regions; DEMO_MODE fixtures; Muse fallback.
- **Muse Wonder 1.0** (`muse-wonder-1.0`) + **Muse Spark 1.3** in `scripts/muse-build/` — Wonder plans/reviews; Spark implements file patches; spend-capped orchestration logged in `docs/BUILD_LOG.md` (Meta AI tooling narrative for judges).
- **Muse Spark Open via Baseten** (`meta-models/muse-spark-open-1026`) — open-weight bonus path.

Environment (names only): `META_API_KEY`, `META_API_BASE_URL`, `META_MODEL`, `META_SAM_MODEL_ID`, `BASETEN_API_KEY`, `DEMO_MODE`.

---

## Why are Meta's models important?

Lab work is inherently **multimodal and tool-heavy**. A text-only model cannot reliably read a scribbled burette volume or a glowing Abs=0.412 panel. Muse Spark's native image understanding lets BenchMate start from the same pixels a student sees at the bench.

Just as important: Muse's **reliable function calling** lets the model plan *which* calculation to run while **never inventing the arithmetic**. Chemistry grades punish invented sig figs; Meta models + deterministic tools keep the agent honest.

For education and open science, **Muse Spark Open** means the same pipeline can run on open weights (Baseten / self-host) — critical for labs that cannot send notebook photos to a closed endpoint long-term.

---

## 3-minute demo video script + shot list

**Target length:** ~2:45–3:00  
**Recording:** `npm run demo:record` → `artifacts/benchmate-demo.webm` (+ mp4 if ffmpeg available)  
**Mode:** DEMO_MODE (Beer's law sample)

| Time | Shot | On-screen / VO |
| --- | --- | --- |
| 0:00–0:12 | Title card + hero | “BenchMate — lab photos to verified reports. Camron Farjami, U-M. Meta Global AI Hackathon.” |
| 0:12–0:28 | Meta tooling beat | Flash `docs/BUILD_LOG.md` / muse-build roles. VO: “Built with Muse Wonder as planner and Muse Spark as contributor — then Cursor quality pass.” |
| 0:28–0:45 | Problem beat | Notebook + spectrophotometer. VO: “Students retype this by hand. Chatbots invent numbers.” |
| 0:45–1:05 | Select Beer's law sample | Sample card + previews. Overlay: “Live Muse / DEMO_MODE fixtures” |
| 1:05–1:30 | Vision + SAM boxes | Bounding boxes. Overlay: “muse-spark-1.3 vision · sam-3.1 regions” |
| 1:30–1:55 | Tool agent | Tool calls + chart. Overlay: “Deterministic chemistry tools — no LLM math” |
| 1:55–2:20 | Verifier | Flagged rows; confirm. Overlay: “Second Muse pass vs image” |
| 2:20–2:45 | Report + export | PDF/DOCX. Overlay: “Tool-cited Results” |
| 2:45–3:00 | Close | “BenchMate · MIT · Muse Wonder + Spark + SAM 3.1” |

### Captions / overlays (burned by demo script)

1. `BenchMate · Meta Global AI Developer Hackathon`  
2. `Vision: Muse Spark extracts units + sig figs`  
3. `Tools: deterministic chemistry (no LLM math)`  
4. `Verifier: confirm flagged cells`  
5. `Report: Intro → Conclusion · PDF/DOCX`  

---

## Links for judges

- App (local): `npm run dev -- -p 43123` → http://127.0.0.1:43123  
- Demo recording: `artifacts/benchmate-demo.webm`  
- Screenshots: `artifacts/screenshots/`  
- Architecture: see README mermaid diagram  
