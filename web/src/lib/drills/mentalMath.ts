import type { Rng } from "./rng";

export type Problem = {
  prompt: string;
  answer: number;
  /** A short trick shown after answering. */
  hint?: string;
  /** For multiple-choice and true-or-false problems: the options to tap. `answer` is then the index of the right one. */
  choices?: string[];
};

export const MENTAL_MATH_LEVELS = [
  "Add two 2-digit numbers",
  "Subtract 2-digit numbers",
  "Adding and subtracting, mixed",
  "Times tables up to 9 × 9",
  "Division: times tables backwards",
  "Add 3-digit and 2-digit numbers",
  "Multiply by a single digit",
  "Divide by a single digit",
  "Shortcut multipliers: 5, 9, 11, 25",
  "Easy percentages: 10%, 25%, 50%",
  "Percentages: 5%, 15%, 20%, 30%",
  "Squares ending in 5 and near-mirror products",
  "Squares up to 20 × 20",
  "Powers: cubes and powers of 2",
  "Square roots",
  "Multiply by 12, 15, 20, 30, 40, 50",
  "Multiply a 3-digit number by a single digit",
  "Fractions of numbers: ¾ of 80",
  "Percentage up and down: 20% more, 25% less",
  "What percent is it? 45 of 180",
  "Order of operations",
  "Averages",
  "Adding and subtracting in any order",
  "Remainders",
  "Decimals: 0.6 × 0.7",
  "Multiplying numbers near 100",
] as const;

const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/** A small whole number as superscript digits: 3 becomes ³. 1 gives nothing, so "x¹" reads as "x". */
export function sup(n: number): string {
  if (n === 1) return "";
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)]!)
    .join("");
}

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
  // 3: adding and subtracting, mixed
  (r) => {
    if (r.next() < 0.5) {
      const a = r.int(11, 89), b = r.int(11, 98);
      return { prompt: `${a} + ${b}`, answer: a + b, hint: "Add the tens, then the ones." };
    }
    const a = r.int(32, 99), b = r.int(11, a - 5);
    return { prompt: `${a} − ${b}`, answer: a - b, hint: "Subtract the tens first, then the ones." };
  },
  // 4: times tables
  (r) => {
    const a = r.int(3, 9), b = r.int(3, 9);
    return { prompt: `${a} × ${b}`, answer: a * b, hint: `Think ${a} × ${b - 1} = ${a * (b - 1)}, then add one more ${a}.` };
  },
  // 5: division, times tables backwards
  (r) => {
    const b = r.int(2, 9), q = r.int(2, 9);
    return { prompt: `${b * q} ÷ ${b}`, answer: q, hint: `Ask: ${b} times what makes ${b * q}?` };
  },
  // 6
  (r) => {
    const a = r.int(101, 989), b = r.int(12, 98);
    return { prompt: `${a} + ${b}`, answer: a + b, hint: "Round one number to the next ten, add, then fix the difference." };
  },
  // 7
  (r) => {
    const a = r.int(12, 99), b = r.int(3, 9);
    return { prompt: `${a} × ${b}`, answer: a * b, hint: `Split it: ${Math.floor(a / 10) * 10} × ${b} plus ${a % 10} × ${b}.` };
  },
  // 8: divide by a single digit
  (r) => {
    const b = r.int(3, 9), q = r.int(11, 19);
    return { prompt: `${b * q} ÷ ${b}`, answer: q, hint: `Split it: ${b} × 10 = ${b * 10}, and what is left is ${b * q - b * 10}, which is ${b} × ${q - 10}.` };
  },
  // 9
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
  // 10
  (r) => {
    const p = r.pick([10, 25, 50] as const);
    const base = p === 25 ? r.int(2, 40) * 4 * 10 : r.int(2, 40) * 10;
    const hint = { 10: "10% is one tenth: move the decimal point.", 25: "25% is a quarter: halve, then halve again.", 50: "50% is half." }[p];
    return { prompt: `${p}% of ${base}`, answer: (base * p) / 100, hint };
  },
  // 11
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
  // 12
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
  // 13: squares up to 20 × 20
  (r) => {
    const a = r.int(11, 20);
    return { prompt: `${a}²`, answer: a * a, hint: `${a}² = ${a - 10} × ${a + 10} + 100 = ${(a - 10) * (a + 10)} + 100.` };
  },
  // 14: cubes and powers of 2
  (r) => {
    const [b, e] = r.pick(POWERS);
    let value = 1;
    for (let i = 0; i < e; i++) value *= b;
    return { prompt: `${b}${sup(e)}`, answer: value, hint: `Build it up: ${b} multiplied by itself ${e} times. Keep the running total in your head.` };
  },
  // 15: square roots
  (r) => {
    const n = r.int(4, 20);
    return { prompt: `√${n * n}`, answer: n, hint: `Which number times itself makes ${n * n}? It is between ${Math.floor(n / 10) * 10} and ${Math.floor(n / 10) * 10 + 10}.` };
  },
  // 16: multiply by 12, 15, 20, 30, 40, 50
  (r) => {
    const a = r.int(13, 49);
    const m = r.pick([12, 15, 20, 30, 40, 50] as const);
    const hint = {
      12: "× 12 is × 10 plus × 2.",
      15: "× 15 is × 10 plus half of that again.",
      20: "× 20 is double it, then × 10.",
      30: "× 30 is × 3, then × 10.",
      40: "× 40 is × 4, then × 10.",
      50: "× 50 is half of × 100.",
    }[m];
    return { prompt: `${a} × ${m}`, answer: a * m, hint };
  },
  // 17: 3-digit number times a single digit
  (r) => {
    const a = r.int(112, 498);
    const b = r.int(2, 9);
    return { prompt: `${a} × ${b}`, answer: a * b, hint: `Split it: ${Math.floor(a / 100) * 100} × ${b}, ${Math.floor((a % 100) / 10) * 10} × ${b} and ${a % 10} × ${b}, then add.` };
  },
  // 18: fractions of numbers
  (r) => {
    const den = r.pick([3, 4, 5, 8] as const);
    const num = r.int(1, den - 1);
    const base = den * r.int(2, 12);
    return { prompt: `${num}/${den} of ${base}`, answer: (base / den) * num, hint: `Find 1/${den} first: ${base / den}. Then times ${num}.` };
  },
  // 19: percentage up and down
  (r) => {
    const p = r.pick([10, 20, 25, 50] as const);
    const base = r.int(2, 20) * 20;
    const up = r.next() < 0.5;
    const change = (base * p) / 100;
    return {
      prompt: `${base} ${up ? "increased" : "decreased"} by ${p}%`,
      answer: up ? base + change : base - change,
      hint: `Find ${p}% of ${base}, which is ${change}, then ${up ? "add" : "take away"} it.`,
    };
  },
  // 20: what percent is it
  (r) => {
    const p = r.pick([10, 20, 25, 40, 50, 60, 75] as const);
    const whole = r.int(2, 12) * 20;
    const part = (whole * p) / 100;
    return { prompt: `${part} is what % of ${whole}?`, answer: p, hint: `Divide the part by the whole: ${part} ÷ ${whole}. Then turn it into a percent.` };
  },
  // 21: order of operations
  (r) => {
    if (r.next() < 0.5) {
      const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9);
      return { prompt: `${a} + ${b} × ${c}`, answer: a + b * c, hint: "Multiply first, then add." };
    }
    const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(1, 8);
    return { prompt: `(${a} + ${b}) × ${c} − ${d}`, answer: (a + b) * c - d, hint: "Brackets first, then multiply, then subtract." };
  },
  // 22: averages
  (r) => {
    const m = r.int(10, 60), x = r.int(1, 9), y = r.int(1, 9);
    return { prompt: `Average of ${m - x}, ${m + y} and ${m + x - y}`, answer: m, hint: "Guess a middle value, then see how far each number is above or below it." };
  },
  // 23: adding and subtracting in any order
  (r) => {
    const b = r.int(5, 30), c = r.int(5, 30);
    const a = r.int(b + c + 1, b + c + 40);
    return { prompt: `−${b} + ${a} − ${c}`, answer: a - b - c, hint: `Start from ${a}, then take away ${b} and ${c}.` };
  },
  // 24: remainders
  (r) => {
    const d = r.int(3, 9), q = r.int(3, 12), rem = r.int(1, d - 1);
    const n = d * q + rem;
    return { prompt: `Remainder of ${n} ÷ ${d}`, answer: rem, hint: `${d} × ${q} = ${d * q}, so ${n} is ${rem} more than a multiple of ${d}.` };
  },
  // 25: decimals
  (r) => {
    const a = r.int(2, 9), b = r.int(2, 9);
    return { prompt: `0.${a} × 0.${b}`, answer: (a * b) / 100, hint: `Multiply the digits: ${a} × ${b} = ${a * b}. Then count two decimal places.` };
  },
  // 26: multiplying numbers near 100
  (r) => {
    const a = r.int(1, 9), b = r.int(1, 9);
    return { prompt: `${100 - a} × ${100 - b}`, answer: (100 - a) * (100 - b), hint: `(100 − ${a})(100 − ${b}) = 10000 − 100 × ${a + b} + ${a} × ${b}.` };
  },
];

const POWERS: readonly (readonly [number, number])[] = [
  [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [3, 3], [3, 4], [3, 5], [4, 3], [4, 4], [5, 3], [5, 4], [6, 3], [7, 3],
];

export const MENTAL_MATH_MAX_LEVEL = GENERATORS.length;

export const generateMentalMath = (level: number, r: Rng): Problem =>
  GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);

/**
 * The level of the problem at `position` in a round. The first problem is at the player's level; the others are
 * drawn from that level and the three below it, so a round mixes sums, differences, times and division instead of
 * repeating one kind.
 */
export function mentalMathLevelFor(level: number, position: number, r: Rng, maxLevel = GENERATORS.length): number {
  const top = Math.min(Math.max(level, 1), maxLevel);
  if (position === 0) return top;
  return r.int(Math.max(1, top - 3), top);
}
