import type { ActualEntry, ProtocolStep, Quantity, QuantityRole } from "./types";
import { dimensionOf } from "./units";

/**
 * Deterministic (no-model) parsers. Used for:
 *  - the no-key fallback path,
 *  - the provenance check that every model-extracted number really appears in the source text.
 */

const QTY_RE =
  /(\d+(?:[.,]\d+)?)\s*(mL|ml|µL|μL|uL|ul|L|kg|mg|µg|μg|ug|g|mM|µM|μM|uM|M|minutes?|mins?|seconds?|secs?|hours?|hrs?|h|s|°C|ºC)(?![A-Za-z])/g;

const STEP_RE = /^\s*(?:step\s*)?(\d{1,2})\s*[.):\-]\s+(.*)$/i;

export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** True when `value` literally appears as a number in `source`. */
export function valueAppearsIn(value: number, source: string): boolean {
  return numbersIn(source).some((n) => Math.abs(n - value) <= Math.max(1e-9, Math.abs(value) * 1e-9));
}

export function inferRole(before: string, after: string, unit: string): QuantityRole {
  const b = before.toLowerCase().slice(-40);
  const a = after.toLowerCase().slice(0, 40);
  const c = `${b} ${a}`;
  const dim = dimensionOf(unit);
  if (dim === "concentration") {
    if (/stock/.test(c)) return "stock_concentration";
    if (/target|final|working|desired|make|prepare|yield|give|produce/.test(b)) return "target_concentration";
    return "other";
  }
  if (dim === "volume") {
    if (/plate|spread/.test(c)) return "plated_volume";
    if (/(pipet|pip\.|transfer|aliquot|add|withdraw|draw)\w*\s*$/.test(b.trim()) || /(pipet|pip\.|transfer|aliquot)\w*/.test(b.split(/[,;(]/).pop() ?? "")) return "transfer_volume";
    if (/(dilute|bring|fill|make up|top up|to the mark|final volume|to mark)/.test(b) || /^\S+\s*(total|final)/.test(a)) return "final_volume";
    if (/pipet|pip\\.|transfer|aliquot|add/.test(b)) return "transfer_volume";
    return "volume";
  }
  if (dim === "mass") return "mass";
  if (dim === "time") return "time";
  if (dim === "temperature") return "temperature";
  return "other";
}

function nameFrom(context: string, role: QuantityRole): string {
  const roleNames: Partial<Record<QuantityRole, string>> = {
    stock_concentration: "stock concentration",
    transfer_volume: "volume transferred",
    final_volume: "final volume",
    target_concentration: "target concentration",
    plated_volume: "volume plated",
    time: "time",
    temperature: "temperature",
    mass: "mass",
  };
  if (roleNames[role]) return roleNames[role]!;
  const words = context.replace(/[^A-Za-z\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.slice(-3).join(" ").toLowerCase() || role;
}

function quantitiesInLine(line: string): Quantity[] {
  const out: Quantity[] = [];
  let m: RegExpExecArray | null;
  QTY_RE.lastIndex = 0;
  while ((m = QTY_RE.exec(line))) {
    const value = Number(m[1].replace(",", "."));
    const unit = m[2];
    // Context = clause containing the number (split on ; and ,) plus a little lookbehind.
    const before = line.slice(0, m.index);
    const clauseStart = Math.max(before.lastIndexOf(";"), before.lastIndexOf(","), before.lastIndexOf(". "));
    const after = line.slice(m.index, m.index + 60);
    const equip = line.slice(m.index + m[0].length).match(/^\s*(?:vol(?:\.|umetric)?\s*)?(pipett?e|flask|cylinder|beaker|tube|burette|buret)/i);
    if (equip) {
      out.push({ name: `${equip[1].toLowerCase().replace(/^pipet$/, "pipette")} size`, value, unit, role: "volume", quote: m[0] });
      continue;
    }
    const role = inferRole(line.slice(0, m.index), after, unit);
    out.push({ name: nameFrom(line.slice(clauseStart + 1, m.index), role), value, unit, role, quote: m[0] });
  }
  return out;
}

/** Split a lab-manual excerpt into numbered steps. */
export function parseStepsDeterministic(manual: string): ProtocolStep[] {
  const lines = manual.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const steps: ProtocolStep[] = [];
  let current: ProtocolStep | null = null;
  for (const line of lines) {
    const sm = line.match(STEP_RE);
    if (sm) {
      current = { n: Number(sm[1]), text: sm[2], quantities: [] };
      steps.push(current);
    } else if (current) {
      current.text += " " + line;
    }
  }
  if (steps.length === 0) {
    // Unnumbered prose: one step per sentence that contains a quantity.
    const hasQty = (t: string) => new RegExp(QTY_RE.source).test(t);
    const sentences = manual.split(/(?<=[.!?])\s+/).filter(hasQty);
    sentences.forEach((s, i) => steps.push({ n: i + 1, text: s.trim(), quantities: [] }));
  }
  for (const s of steps) s.quantities = quantitiesInLine(s.text);
  return steps;
}

/** Pull recorded values out of a student's notebook text. */
export function parseActualsDeterministic(notebook: string): ActualEntry[] {
  const out: ActualEntry[] = [];
  for (const raw of notebook.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sm = line.match(STEP_RE);
    const stepN = sm ? Number(sm[1]) : undefined;
    for (const q of quantitiesInLine(sm ? sm[2] : line)) out.push({ ...q, stepN });
  }
  return out;
}

const OFF_RE = /\b(skip(ped)?|forgot|didn'?t|did not|instead|ran out|substitut\w*|extra|also added|no time)\b/i;

export function offProtocolNotesDeterministic(notebook: string): { stepN?: number; text: string }[] {
  return notebook
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => OFF_RE.test(l))
    .map((l) => {
      const sm = l.match(STEP_RE);
      return { stepN: sm ? Number(sm[1]) : undefined, text: l };
    });
}
