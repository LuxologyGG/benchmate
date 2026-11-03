# Colony plate fixture (hero)

Sample images:
- `/public/samples/colony-plate.png` — 42 colonies on LB agar
- `/public/samples/colony-plate-label.png` — dilution / volume metadata

Ground truth: N=42, V=0.1 mL, D=1e-4 → **CFU/mL = 4.2×10⁶**

DEMO_MODE uses fixture SAM segmentations in `src/lib/demo/colony-fixtures.ts` and deterministic `compute_cfu`.
