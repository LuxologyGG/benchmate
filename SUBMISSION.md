# Meta Global AI Developer Hackathon - Submission Draft

**Project:** BenchMate
**Builder:** Camron Farjami · USC Norris (oncology) / Loma Linda wet-lab research · [Homa](https://homa.bio)
**Track:** Indie · *Build for Your World* / accelerating scientific experiments
**Deadline:** Nov 4, 2026 9:00 PM ET

---

## One-line pitch

**AI lab partner that watches your bench, catches errors before they ruin an experiment, and writes the record**, for wet-lab research trainees.

---

## Project Description

BenchMate is an **agentic lab partner**, not a homework chatbot. Two working wow paths in DEMO_MODE:

1. **Petri dish CFU** - photo → **SAM 3.1 colony masks** → deterministic `compute_cfu` → **4.2×10⁶ CFU/mL** (N=42, V=0.1 mL, D=10⁻⁴).
2. **Serial Dilution 10× catch** - Muse Wonder streams a **live agent trace**; protocol check fires a **deviation banner** when the notebook shows **1.0 mL** stock into 100 mL but the protocol needs **10.0 mL** (10× low → 0.01 M vs 0.10 M).

Also: spectrophotometer / balance / titration notebook → verified experimental record (vision → tool-cited math → verifier → PDF/DOCX).

**Why this world:** Camron's wet-lab work at USC Norris and Loma Linda, and related work at Homa (homa.bio), makes clear that trainee time and reagents are expensive. Catching a wrong dilution or miscount *before* it propagates is the difference between a usable run and a ruined experiment.

---

## Describe your use of Meta products

- **Muse Wonder 1.0** - runtime orchestrator with streamed agent-trace events; also muse-build planner/reviewer. Live when `DEMO_MODE=false` and keys are set; DEMO_MODE replays a faithful fixture trace.
- **SAM 3.1** - colony segmentation (hero) + readout crops; DEMO fixtures for offline judging. Live SAM is wired and exercised in eval; DEMO_MODE is the stable path without spend.
- **Muse Spark 1.3** - vision/OCR, function-calling calc agent, verifier, report writer. Live when keys are present; DEMO fixtures otherwise.
- **Muse Spark Open (Baseten)** - open-weight bonus path.
- Deterministic TypeScript tools (`compute_cfu`, `dilution`, …) - **all reported math**.

Env (names only): `META_API_KEY`, `META_API_BASE_URL`, `META_MODEL`, `META_WONDER_MODEL`, `META_SAM_MODEL_ID`, `BASETEN_API_KEY`, `DEMO_MODE`.

---

## Why are Meta's models important?

Wet-lab work is multimodal and tool-heavy. SAM 3.1 shows *which* colonies were counted. Wonder coordinates specialists so trainees see the agent think. Spark reads labels and plans tool calls while **TypeScript owns CFU and dilution arithmetic**. The 10× protocol catch is the product of that stack (multimodal OCR + deterministic check + streamed UI), not a chatbot guess.

---

## 3-minute demo video script + shot list

| Time | Shot | On-screen / VO |
| --- | --- | --- |
| 0:00-0:20 | Pain | "Wrong dilution. Miscounted plate. A day's culture, gone." |
| 0:20-0:40 | Frame | BenchMate · USC Norris / Loma Linda · Homa · Build for Your World |
| 0:40-1:05 | Colony CFU | Petri Dish sample → SAM masks → `compute_cfu` 4.2×10⁶ |
| 1:05-1:30 | **Wow** | Serial Dilution → **live agent trace** → **10× protocol deviation banner** |
| 1:30-2:15 | Report + accuracy | Verified report · accuracy table (CFU + 10× catch) · PDF |
| 2:15-2:45 | Model roles | Wonder · Spark · SAM 3.1 · deterministic tools |
| 2:45-3:00 | Close | Build for Your World: accelerate scientific experiments |

---

## Links for judges

```bash
DEMO_MODE=true npm run generate:samples
DEMO_MODE=true npm run dev -- -p 43123
```

- Select **Petri Dish - Colony CFU Count**, then **Serial Dilution - 10× Protocol Catch**
- Demo MP4: project store `media/benchmate-demo.mp4`
- Storyboard: project store `docs/demo-script.md`
