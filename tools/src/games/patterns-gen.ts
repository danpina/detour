// `pnpm --filter tools exec tsx src/games/patterns-gen.ts`
// Generates the "What comes next?" puzzles into content/games/patterns.json with a seeded RNG (same output every run).
// Each puzzle stores a machine-readable `family` + `params`; web/src/games/patterns/patterns.test.ts re-derives every
// answer from those two fields, so a wrong answer cannot ship.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "content/games/patterns.json");

type Params = Record<string, number>;
type Family =
  | "arith" | "geom" | "squares" | "cubes" | "triangular" | "fibonacci" | "altAddSub"
  | "growingDiff" | "powers" | "primes" | "mulAdd" | "interleaved";

type Puzzle = {
  id: string;
  level: 1 | 2 | 3;
  family: Family;
  params: Params;
  shown: number[];
  answer: number;
  options: number[];
  rule: string;
};

// ---------- seeded RNG (mulberry32) ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261021);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ---------- term generation: the first `n` terms of a family ----------
const PRIMES: number[] = [];
for (let x = 2; PRIMES.length < 40; x++) if (PRIMES.every((p) => x % p !== 0)) PRIMES.push(x);

function terms(f: Family, p: Params, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    switch (f) {
      case "arith": out.push(p.start! + p.d! * i); break;
      case "geom": out.push(p.start! * p.r! ** i); break;
      case "squares": out.push((p.k! + i) ** 2); break;
      case "cubes": out.push((p.k! + i) ** 3); break;
      case "triangular": { const m = p.k! + i; out.push((m * (m + 1)) / 2); break; }
      case "fibonacci": out.push(i === 0 ? p.a! : i === 1 ? p.b! : out[i - 1]! + out[i - 2]!); break;
      case "altAddSub": {
        // +a, -b, +a, -b ...
        if (i === 0) out.push(p.start!);
        else out.push(out[i - 1]! + (i % 2 === 1 ? p.a! : -p.b!));
        break;
      }
      case "growingDiff": out.push(i === 0 ? p.start! : out[i - 1]! + p.d0! + p.step! * (i - 1)); break;
      case "powers": out.push(p.base! ** (p.k! + i)); break;
      case "primes": out.push(PRIMES[p.k! + i]!); break;
      case "mulAdd": out.push(i === 0 ? p.start! : out[i - 1]! * p.m! + p.c!); break;
      case "interleaved": out.push(i % 2 === 0 ? p.a0! + p.da! * (i / 2) : p.b0! + p.db! * ((i - 1) / 2)); break;
    }
  }
  return out;
}

function ruleText(f: Family, p: Params): string {
  switch (f) {
    case "arith": return p.d! > 0 ? `Add ${p.d} each time` : `Subtract ${-p.d!} each time`;
    case "geom": return `Multiply by ${p.r} each time`;
    case "squares": return "Square numbers: each term is a whole number times itself";
    case "cubes": return "Cube numbers: each term is a whole number times itself twice";
    case "triangular": return "Triangular numbers: the jump grows by 1 each time";
    case "fibonacci": return "Each number is the sum of the two before it";
    case "altAddSub": return `Add ${p.a}, then subtract ${p.b}, and repeat`;
    case "growingDiff": {
      const j = [0, 1, 2, 3].map((i) => `+${p.d0! + p.step! * i}`).join(", ");
      return `The jump grows by ${p.step} each time (${j}, ...)`;
    }
    case "powers": return p.base === 2 ? "Powers of 2: double each time" : `Powers of ${p.base}: multiply by ${p.base} each time`;
    case "primes": return "Prime numbers, in order";
    case "mulAdd": return p.c! > 0 ? `Multiply by ${p.m}, then add ${p.c}` : `Multiply by ${p.m}, then subtract ${-p.c!}`;
    case "interleaved": return `Two patterns take turns: one goes ${step(p.da!)}, the other ${step(p.db!)}`;
  }
}
const step = (d: number) => (d >= 0 ? `up by ${d}` : `down by ${-d}`);

// ---------- distractors: plausible near-misses ----------
function distractors(f: Family, p: Params, seq: number[]): number[] {
  const answer = seq[seq.length - 1]!;
  const shown = seq.slice(0, -1);
  const last = shown[shown.length - 1]!;
  const prev = shown[shown.length - 2]!;
  const d1 = last - prev;
  const d0 = prev - shown[shown.length - 3]!;
  const wrong: number[] = [last + d1, last + d0, last * 2, last + prev];
  if (f === "growingDiff") wrong.push(last + d1 + 2 * p.step!, last + d1 - p.step!);
  if (f === "fibonacci") wrong.push(last * 2, last + d1);
  if (f === "squares" || f === "cubes") wrong.push(last + 2 * (shown.length));
  if (f === "primes") wrong.push(last + 2, last + 4, last + 1);
  if (f === "altAddSub") wrong.push(last + p.a!, last - p.b!, last + p.a! + p.b!);
  if (f === "interleaved") wrong.push(prev + d0, last + p.da!, last + p.db!);
  if (f === "mulAdd") wrong.push(last * p.m!, last + p.c!);
  const near = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10, answer + 5, answer - 5];
  const ok = (x: number) => Number.isInteger(x) && x !== answer && x >= 0 && !shown.includes(x);
  const pool: number[] = [];
  for (const x of [...shuffle(wrong), ...shuffle(near)]) if (ok(x) && !pool.includes(x)) pool.push(x);
  // Keep at least one wrong-rule answer and fill the rest with a mix, so options are not all within +-2.
  return pool.slice(0, 3);
}

// ---------- puzzle makers per level ----------
type Maker = () => { family: Family; params: Params; count: number };
const shownCount = () => int(5, 7);

const level1: Maker[] = [
  () => ({ family: "arith", params: { start: int(1, 20), d: int(2, 9) }, count: shownCount() + 1 }),
  () => { const d = int(2, 8); const n = shownCount(); return { family: "arith", params: { start: d * (n + 1) + int(0, 9), d: -d }, count: n + 1 }; },
  () => ({ family: "geom", params: { start: int(1, 5), r: 2 }, count: int(5, 6) + 1 }),
  () => ({ family: "squares", params: { k: int(1, 4) }, count: int(5, 6) + 1 }),
  () => ({ family: "arith", params: { start: int(0, 10) * 5, d: pick([5, 10, 25]) }, count: shownCount() + 1 }),
];
const level2: Maker[] = [
  () => ({ family: "geom", params: { start: int(1, 4), r: 3 }, count: int(5, 6) + 1 }),
  () => ({ family: "geom", params: { start: int(3, 7), r: 2 }, count: int(5, 6) + 1 }),
  () => ({ family: "cubes", params: { k: int(1, 3) }, count: 6 }),
  () => ({ family: "triangular", params: { k: int(1, 4) }, count: int(5, 7) + 1 }),
  () => ({ family: "fibonacci", params: { a: int(1, 4), b: int(1, 5) }, count: int(6, 7) + 1 }),
  () => ({ family: "altAddSub", params: { start: int(5, 20), a: int(4, 9), b: int(1, 3) }, count: int(6, 7) + 1 }),
  () => ({ family: "growingDiff", params: { start: int(1, 10), d0: int(1, 3), step: 1 }, count: int(5, 6) + 1 }),
  () => ({ family: "powers", params: { base: pick([2, 3]), k: int(0, 2) }, count: int(5, 6) + 1 }),
  () => ({ family: "squares", params: { k: int(3, 9) }, count: 6 }),
];
const level3: Maker[] = [
  () => ({ family: "primes", params: { k: int(0, 12) }, count: int(6, 7) + 1 }),
  () => ({ family: "mulAdd", params: { start: int(1, 4), m: 2, c: pick([1, -1, 2, 3]) }, count: int(5, 6) + 1 }),
  () => ({ family: "mulAdd", params: { start: int(1, 3), m: 3, c: pick([1, -1, 2]) }, count: 5 + 1 }),
  () => ({ family: "interleaved", params: { a0: int(1, 10), da: int(1, 4), b0: int(20, 50), db: -int(1, 5) }, count: int(6, 7) + 1 }),
  () => ({ family: "interleaved", params: { a0: int(1, 5), da: int(2, 5), b0: int(1, 5), db: int(6, 10) }, count: int(6, 7) + 1 }),
  () => ({ family: "growingDiff", params: { start: int(1, 10), d0: int(1, 4), step: int(2, 4) }, count: int(5, 6) + 1 }),
  () => ({ family: "fibonacci", params: { a: int(2, 9), b: int(3, 12) }, count: 7 + 1 }),
  () => ({ family: "altAddSub", params: { start: int(10, 30), a: int(8, 15), b: int(2, 6) }, count: int(6, 7) + 1 }),
  () => ({ family: "powers", params: { base: 3, k: int(1, 2) }, count: 6 + 1 }),
  () => ({ family: "triangular", params: { k: int(5, 10) }, count: 7 + 1 }),
  () => ({ family: "cubes", params: { k: int(3, 6) }, count: 6 }),
];

const MAX_TERM = 5000;
const PER_LEVEL = 100;
const makers: Record<1 | 2 | 3, Maker[]> = { 1: level1, 2: level2, 3: level3 };

const puzzles: Puzzle[] = [];
const seen = new Set<string>();
for (const level of [1, 2, 3] as const) {
  let made = 0;
  let guard = 0;
  while (made < PER_LEVEL && guard++ < 20000) {
    const spec = pick(makers[level])();
    const seq = terms(spec.family, spec.params, spec.count);
    if (seq.some((x) => !Number.isInteger(x) || x < 0 || x > MAX_TERM)) continue;
    const key = seq.slice(0, -1).join(",");
    if (seen.has(key)) continue;
    // Skip degenerate shows where a consecutive repeat would make the rule ambiguous.
    if (new Set(seq).size < seq.length - 1) continue;
    const d = distractors(spec.family, spec.params, seq);
    if (d.length < 3) continue;
    seen.add(key);
    const answer = seq[seq.length - 1]!;
    made++;
    puzzles.push({
      id: `p${level}-${String(made).padStart(3, "0")}`,
      level,
      family: spec.family,
      params: spec.params,
      shown: seq.slice(0, -1),
      answer,
      options: shuffle([answer, ...d]),
      rule: ruleText(spec.family, spec.params),
    });
  }
  if (made < PER_LEVEL) console.warn(`level ${level}: only ${made} unique puzzles`);
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `{"puzzles":[\n${puzzles.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`);
const counts = [1, 2, 3].map((l) => `L${l}=${puzzles.filter((p) => p.level === l).length}`).join(" ");
console.log(`wrote ${puzzles.length} puzzles (${counts}) to ${OUT}`);
