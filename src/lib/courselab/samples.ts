/** Built-in teaching-lab cases. Used for the demo presets and the eval pack (docs/eval). */

export interface Sample {
  id: string;
  label: string;
  kind: "ordinary" | "catch" | "harder";
  course: string;
  manual: string;
  notebook: string;
  /** Optional plate count for the CFU panel (from the labeled classic fixture). */
  cfu?: { colonyCount: number; note: string };
}

const NACL_MANUAL = `CHEM 125 Lab 3: Preparing a 0.10 M NaCl working solution
1. Rinse a 100.0 mL volumetric flask three times with deionized water.
2. Using a 10 mL volumetric pipette, transfer 10.0 mL of the 1.0 M NaCl stock solution into the flask.
3. Dilute to the mark (100.0 mL total) with deionized water to make 0.10 M NaCl.
4. Stopper and invert the flask ten times to mix, then label it.`;

export const SAMPLES: Sample[] = [
  {
    id: "nacl-ok",
    label: "Ordinary #1: NaCl dilution, done right",
    kind: "ordinary",
    course: "General chemistry",
    manual: NACL_MANUAL,
    notebook: `11/24 Lab 3, bench 6
1. rinsed 100 mL vol. flask 3x w/ DI
2. pipetted 10.0 mL of 1.0 M NaCl stock (10 mL vol pipette) into flask
3. diluted to mark, 100.0 mL total
4. inverted 10x, labeled "0.10 M NaCl CF"`,
  },
  {
    id: "nacl-10x",
    label: "The catch: 1.0 mL instead of 10.0 mL",
    kind: "catch",
    course: "General chemistry",
    manual: NACL_MANUAL,
    notebook: `11/24 Lab 3, bench 6
1. rinsed 100 mL vol. flask 3x w/ DI
2. pipetted 1.0 mL of 1.0 M NaCl stock into flask (grabbed the 1 mL pipette)
3. diluted to mark, 100.0 mL total
4. inverted 10x, labeled "0.10 M NaCl CF"`,
  },
  {
    id: "ecoli-ok",
    label: "Ordinary #2: serial dilution + plating",
    kind: "ordinary",
    course: "Intro biology",
    manual: `BIO 173 Lab 6: Serial dilution and plate count of E. coli
1. Label four dilution tubes 10^-1 through 10^-4 and add 9.0 mL of sterile saline to each.
2. Transfer 1.0 mL of the overnight culture into the 10^-1 tube and vortex for 5 s.
3. Repeat the 1.0 mL transfer down the series to the 10^-4 tube, changing tips each time.
4. Spread 0.1 mL from the 10^-4 tube onto an LB agar plate.
5. Incubate the plate upside down at 37 °C for 24 h, then count colonies.`,
    notebook: `Lab 6 serial dil, 11/23
1. 4 tubes labeled, 9.0 mL saline each
2. 1.0 mL culture -> 10^-1, vortexed 5 s
3. 1.0 mL transfers down to 10^-4, new tip every time
4. spread 0.1 mL of 10^-4 on LB
5. incubator 37 °C, pulled at 24 h. 42 colonies`,
    cfu: { colonyCount: 42, note: "Count from the labeled BenchMate plate fixture (42 colonies, carried over from the Nov 4 build)." },
  },
  {
    id: "cuso4-messy",
    label: "Harder: messy notebook, missing values, off-protocol",
    kind: "harder",
    course: "General chemistry",
    manual: `CHEM 126 Lab 4: Copper(II) sulfate standard for absorbance
1. Obtain about 30 mL of 0.500 M CuSO4 stock in a clean, dry beaker.
2. Pipette 25.00 mL of the stock into a 250.0 mL volumetric flask.
3. Dilute to the mark with DI water to give 0.0500 M CuSO4. Stopper and invert 15 times.
4. Let the solution equilibrate for 5 min at 20 °C before measuring absorbance.`,
    notebook: `11/24 CuSO4 stds - me + Jordan
got ~30ml stock (0.5M) in beaker (was still wet from rinse)
pip. 25 mL stock -> 250 flask, DI to line
forgot to stopper before inverting, lost maybe 1-2 drops
waited 2 min bc line for the spec
abs read right after`,
  },
];

export function getSample(id: string) {
  return SAMPLES.find((s) => s.id === id);
}
