# Demo video script: BenchMate Course Lab (target 3:00, hard limit 2–4 min)

Plain screen recording, no editing needed. Record at 1280×800 or larger with browser zoom at 110% so text is readable. If you speed anything up, put “sped up 2×” on screen. Do not cut the live model call: judges want to see it actually run.

**Setup (before recording, off camera)**

* Option A, easiest: open https://luxologygg.github.io/benchmate/ and paste your free Groq key and Gemini key into the two key fields. The badge should read `LIVE · groq openai/gpt-oss-20b + gemini …`.
* Option B, full server: `npm install && cp .env.example .env.local` (add keys), then `npm run dev -- -p 43123` and open http://127.0.0.1:43123.
* Dismiss nothing yet; the green “New for the Global AI Builder's Challenge” banner should be visible in the first shot.

| Time | On screen | Say (roughly) |
| --- | --- | --- |
| 0:00–0:20 | Home page, banner visible | “I'm Camron, a Michigan undergrad who has worked wet-lab benches at USC Norris and Loma Linda. The costliest lab mistakes are boring: the 1 mL pipette instead of the 10 mL one. Nobody notices until the data looks wrong. BenchMate Course Lab catches that at the bench.” |
| 0:20–0:35 | Point at the LIVE badge and the “what's new” banner | “This is an upgrade of my earlier BenchMate. New this week: it checks any lab-manual protocol against your notebook, it runs live on free-tier models, and code checks every number the model gives.” |
| 0:35–1:20 | Click **The catch: 1.0 mL instead of 10.0 mL**. Show the manual (10.0 mL) and the notebook (1.0 mL). Click **Check my run**. Red **Stop** banner appears. | “Here's CHEM Lab 3: 10 mL of 1 M stock into 100 mL. My notebook says 1.0 mL. One click… about a second. Stop: step 2 is ten times too little, and the dilution tool says my working solution is 0.01 molar, not 0.1. It even gives the fix.” |
| 1:20–1:45 | Scroll the deviations list (tool names), then the Trace + Spend ledger | “Every number names the deterministic tool that made it. The model only finds numbers; here's the trace: one Groq call, then a provenance check that throws away any number that isn't literally in my text, then the math tools. About fifteen hundred tokens, zero dollars on the free tier.” |
| 1:45–2:15 | Click **Harder: messy notebook…**, run. Show −60% equilibration, missing temperature, the off-protocol notes. | “Real notebooks are messy. Shorthand, missing units, ‘forgot to stopper’. It flags the 2-minute wait against the 5 minutes the manual asks for, the temperature I never wrote down, and the steps I changed. When I asked a plain chatbot about this same page, it invented a concentration from ‘1–2 drops’. BenchMate won't make up a number it can't compute.” |
| 2:15–2:40 | Click **Try a handwritten page**, run. Show the transcript box and the 10× banner. | “Or snap the page. Gemini transcribes it, transcription only, and the same checks catch the 10× error from my handwriting.” (Note on screen: “sample page uses a handwriting font”.) |
| 2:40–2:55 | Back to the catch result: tick the acknowledgement box, click **Download Markdown**, open the file briefly. | “Export is locked until I acknowledge the deviations, and the record cites the tool behind every value.” |
| 2:55–3:10 | Footer limits | “Limits: it's a teaching-lab aid, not a medical device. The model can still miss a value, and photos of real handwriting are harder. The code, tests and eval screenshots are on GitHub.” |

**Optional 10-second failure beat (if under 3:30):** with Option B, stop the server's network or use a wrong key and show the amber “Model extraction failed… used the deterministic parser” warning while the 10× catch still appears. Or just show `docs/eval/courselab/07-failure-bad-key-fallback.png`.

**Upload:** YouTube (Unlisted or Public) or Vimeo. Embedding allowed, playable signed out. Paste the URL into DEVPOST.md and the Devpost form.
