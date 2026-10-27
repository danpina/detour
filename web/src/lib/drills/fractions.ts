import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const FRACTIONS_LEVELS = [
  "Equivalent fractions",
  "Simplifying fractions",
  "Adding fractions",
  "Ratios: find the other part",
  "Sharing in a ratio",
  "Scaling a recipe",
  "Unit rates",
  "Map scales",
  "A fraction of a fraction",
  "Dividing by a fraction",
] as const;

type Gen = (r: Rng) => Problem;

/** Fractions already in lowest terms: numerator, denominator. */
const LOWEST: readonly (readonly [number, number])[] = [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [5, 8]];
/** Pairs of denominators and their lowest common multiple. */
const DENOMINATORS: readonly (readonly [number, number, number])[] = [
  [2, 3, 6], [3, 4, 12], [2, 5, 10], [3, 5, 15], [4, 6, 12], [2, 6, 6], [3, 6, 6], [4, 5, 20],
];
const FOODS = ["eggs", "cups of flour", "tomatoes", "spoons of sugar"] as const;
const SCALES = [2, 5, 10, 20, 25, 50] as const;
const SCOOPS: readonly (readonly [number, number])[] = [[1, 2], [1, 4], [3, 4], [2, 3], [1, 3], [2, 5]];

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const b = r.int(2, 9), a = r.int(1, b - 1), k = r.int(2, 6);
    return { prompt: `${a}/${b} = ?/${b * k}`, answer: a * k, hint: `${b} times ${k} is ${b * k}, so multiply the top by ${k} as well.` };
  },
  // 2
  (r) => {
    const [p, q] = r.pick(LOWEST), g = r.int(2, 9);
    return { prompt: `${p * g}/${q * g} in simplest form has what denominator?`, answer: q, hint: `Divide top and bottom by ${g}: ${p}/${q}.` };
  },
  // 3
  (r) => {
    const [d1, d2, lcm] = r.pick(DENOMINATORS);
    const n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1);
    return {
      prompt: `${n1}/${d1} + ${n2}/${d2} = ?/${lcm}`,
      answer: (n1 * lcm) / d1 + (n2 * lcm) / d2,
      hint: `Rewrite both over ${lcm}: ${(n1 * lcm) / d1}/${lcm} and ${(n2 * lcm) / d2}/${lcm}. Add the tops.`,
    };
  },
  // 4
  (r) => {
    const a = r.int(1, 5), b = r.int(1, 5), k = r.int(2, 9);
    return { prompt: `The ratio is ${a}:${b}. If the first part is ${a * k}, the second?`, answer: b * k, hint: `The first part is ${a} × ${k}, so the second is ${b} × ${k}.` };
  },
  // 5
  (r) => {
    const a = r.int(1, 5), b = r.int(1, 5), k = r.int(2, 12);
    return {
      prompt: `Share $${(a + b) * k} in the ratio ${a}:${b}. The larger share, in dollars?`,
      answer: Math.max(a, b) * k,
      hint: `${a} + ${b} = ${a + b} parts. One part is $${k}. The larger share is ${Math.max(a, b)} parts.`,
    };
  },
  // 6
  (r) => {
    const food = r.pick(FOODS), s = r.pick([2, 4, 6] as const), k = r.int(1, 5), t = r.int(3, 12);
    return {
      prompt: `A recipe for ${s} uses ${s * k} ${food}. How many ${food} for ${t} people?`,
      answer: t * k,
      hint: `That is ${k} per person. ${k} × ${t}.`,
    };
  },
  // 7
  (r) => {
    const n = r.int(2, 6), p = r.int(2, 9), m = r.int(n + 1, 12);
    return {
      prompt: `${n} notebooks cost $${n * p}. What do ${m} cost, in dollars?`,
      answer: m * p,
      hint: `One costs $${p}. Then ${m} × ${p}.`,
    };
  },
  // 8
  (r) => {
    const s = r.pick(SCALES), c = r.int(2, 12);
    if (r.next() < 0.5) return { prompt: `On a map, 1 cm is ${s} km. How far is ${c} cm, in km?`, answer: c * s, hint: `${c} × ${s}.` };
    return { prompt: `A trip of ${c * s} km. How many cm on a map where 1 cm is ${s} km?`, answer: c, hint: `${c * s} ÷ ${s}.` };
  },
  // 9
  (r) => {
    const b = r.pick([2, 3, 4] as const), d = r.pick([2, 3, 4] as const);
    const a = r.int(1, b - 1), c = r.int(1, d - 1), m = r.int(1, 6);
    return {
      prompt: `${a}/${b} of ${c}/${d} of ${b * d * m}`,
      answer: a * c * m,
      hint: `${c}/${d} of ${b * d * m} is ${c * b * m}. Then ${a}/${b} of that.`,
    };
  },
  // 10
  (r) => {
    const [n, d] = r.pick(SCOOPS), m = r.int(1, 5);
    return {
      prompt: `How many ${n}/${d}-cup scoops fit in ${n * m} cups?`,
      answer: d * m,
      hint: `Dividing by ${n}/${d} means multiplying by ${d}/${n}: ${n * m} × ${d} ÷ ${n}.`,
    };
  },
];

export const FRACTIONS_MAX_LEVEL = GENERATORS.length;

export const generateFractions = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
