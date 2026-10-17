import type { Rng } from "./rng";

export type Problem = {
  prompt: string;
  answer: number;
  /** A short trick shown after answering. */
  hint?: string;
};

export const MENTAL_MATH_LEVELS = [
  "Add two 2-digit numbers",
  "Subtract 2-digit numbers",
  "Add 3-digit and 2-digit numbers",
  "Multiply by a single digit",
  "Shortcut multipliers: 5, 9, 11, 25",
  "Easy percentages: 10%, 25%, 50%",
  "Percentages: 5%, 15%, 20%, 30%",
  "Squares ending in 5 and near-mirror products",
] as const;

type Gen = (r: Rng) => Problem;

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const a = r.int(11, 89), b = r.int(11, 99 - 1);
    return { prompt: `${a} + ${b}`, answer: a + b, hint: "Add the tens, then the ones." };
  },
  // 2
  (r) => {
    const a = r.int(32, 99), b = r.int(11, a - 5);
    return { prompt: `${a} − ${b}`, answer: a - b, hint: "Subtract the tens first, then the ones." };
  },
  // 3
  (r) => {
    const a = r.int(101, 989), b = r.int(12, 98);
    return { prompt: `${a} + ${b}`, answer: a + b, hint: "Round one number to the next ten, add, then fix the difference." };
  },
  // 4
  (r) => {
    const a = r.int(12, 99), b = r.int(3, 9);
    return { prompt: `${a} × ${b}`, answer: a * b, hint: `Split it: ${Math.floor(a / 10) * 10} × ${b} plus ${a % 10} × ${b}.` };
  },
  // 5
  (r) => {
    const m = r.pick([5, 9, 11, 25] as const);
    const a = m === 25 ? r.int(2, 24) * 4 : r.int(12, 99);
    const hint = {
      5: "× 5 is half of × 10.",
      9: "× 9 is × 10 minus the number itself.",
      11: "× 11 is × 10 plus the number itself.",
      25: "× 25 is a quarter of × 100.",
    }[m];
    return { prompt: `${a} × ${m}`, answer: a * m, hint };
  },
  // 6
  (r) => {
    const p = r.pick([10, 25, 50] as const);
    const base = p === 25 ? r.int(2, 40) * 4 * 10 : r.int(2, 40) * 10;
    const hint = { 10: "10% is one tenth: move the decimal point.", 25: "25% is a quarter: halve, then halve again.", 50: "50% is half." }[p];
    return { prompt: `${p}% of ${base}`, answer: (base * p) / 100, hint };
  },
  // 7
  (r) => {
    const p = r.pick([5, 15, 20, 30] as const);
    const base = r.int(1, 12) * 20;
    const hint = {
      5: "5% is half of 10%.",
      15: "15% is 10% plus half of 10%.",
      20: "20% is double 10%.",
      30: "30% is three times 10%.",
    }[p];
    return { prompt: `${p}% of ${base}`, answer: (base * p) / 100, hint };
  },
  // 8
  (r) => {
    if (r.next() < 0.5) {
      const t = r.int(1, 9);
      const a = t * 10 + 5;
      return { prompt: `${a}²`, answer: a * a, hint: `For a number ending in 5: tens × (tens + 1), then write 25. Here ${t} × ${t + 1} = ${t * (t + 1)}, so ${a * a}.` };
    }
    const mid = r.int(3, 9) * 10;
    const d = r.int(1, 4);
    return { prompt: `${mid - d} × ${mid + d}`, answer: mid * mid - d * d, hint: `It is ${mid}² − ${d}², because (m − d)(m + d) = m² − d².` };
  },
];

export const generateMentalMath = (level: number, r: Rng): Problem =>
  GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);

export const MENTAL_MATH_MAX_LEVEL = GENERATORS.length;
