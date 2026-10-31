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
  "Mixed numbers to fractions",
  "Subtracting fractions",
  "Which fraction is larger?",
  "Fractions as percents",
  "Ratios with three parts",
  "Solving a proportion",
  "Rates as fractions",
  "How many fit in a fraction?",
  "A percent of a percent",
  "Working back from what is left",
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

/** a/b against c/d: pairs that are never equal. */
const COMPARE: readonly (readonly [number, number, number, number])[] = [
  [3, 4, 5, 7], [2, 3, 5, 8], [5, 6, 7, 9], [4, 5, 7, 9], [3, 5, 4, 7], [2, 5, 3, 8], [7, 8, 6, 7], [5, 8, 3, 5], [4, 7, 5, 9], [2, 7, 3, 10],
];

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

  // 11
  (r) => {
    const w = r.int(1, 5), d = r.int(2, 9), n = r.int(1, d - 1);
    return { prompt: `${w} ${n}/${d} = ?/${d}`, answer: w * d + n, hint: `${w} wholes is ${w * d}/${d}. Add ${n}/${d}.` };
  },
  // 12
  (r) => {
    const [d1, d2, lcm] = r.pick(DENOMINATORS);
    const n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1);
    const a = (n1 * lcm) / d1, b = (n2 * lcm) / d2;
    const first = a >= b ? `${n1}/${d1}` : `${n2}/${d2}`, second = a >= b ? `${n2}/${d2}` : `${n1}/${d1}`;
    return { prompt: `${first} − ${second} = ?/${lcm}`, answer: Math.abs(a - b), hint: `Rewrite both over ${lcm}: ${Math.max(a, b)}/${lcm} and ${Math.min(a, b)}/${lcm}. Subtract the tops.` };
  },
  // 13
  (r) => {
    const [a, b, c, d] = r.pick(COMPARE);
    const flip = r.next() < 0.5;
    const x = `${a}/${b}`, y = `${c}/${d}`;
    const firstLarger = a * d > c * b;
    return {
      prompt: `Which fraction is larger?`,
      choices: flip ? [y, x] : [x, y],
      answer: (flip ? !firstLarger : firstLarger) ? 0 : 1,
      hint: `Cross-multiply: ${a} × ${d} = ${a * d} and ${c} × ${b} = ${c * b}.`,
    };
  },
  // 14
  (r) => {
    const d = r.pick([2, 4, 5, 10, 20, 25] as const), n = r.int(1, d - 1);
    return { prompt: `${n}/${d} as a percent?`, answer: (100 * n) / d, hint: `Make the bottom 100: multiply top and bottom by ${100 / d}.` };
  },
  // 15
  (r) => {
    const a = r.int(1, 5), b = r.int(1, 5), c = r.int(1, 5), k = r.int(2, 12);
    return { prompt: `Share $${(a + b + c) * k} in the ratio ${a}:${b}:${c}. The smallest share, in dollars?`, answer: Math.min(a, b, c) * k, hint: `${a + b + c} parts in all, so one part is $${k}.` };
  },
  // 16
  (r) => {
    const b = r.int(2, 9), a = r.int(1, b - 1), k = r.int(2, 6);
    return { prompt: `${a}/${b} = ${a * k}/?`, answer: b * k, hint: `The top was multiplied by ${k}, so multiply the bottom by ${k} too.` };
  },
  // 17
  (r) => {
    const d = r.int(2, 6), n = r.int(1, d - 1), m = r.int(2, 5);
    return { prompt: `A tap fills ${n}/${d} of a tank in ${n * m} minutes. How long for a full tank?`, answer: d * m, hint: `That is ${m} minutes for each ${1}/${d}, and a full tank is ${d} of those.` };
  },
  // 18
  (r) => {
    const b = r.pick([2, 3, 4] as const), a = r.int(1, 5), c = b * r.int(1, 3);
    return { prompt: `How many 1/${c}s fit in ${a}/${b}?`, answer: (a * c) / b, hint: `Dividing by 1/${c} means multiplying by ${c}: ${a}/${b} × ${c}.` };
  },
  // 19
  (r) => {
    const a = 10 * r.int(2, 9), b = 10 * r.int(2, 9), k = r.int(1, 10);
    return { prompt: `${a}% of ${b}% of ${100 * k}`, answer: (k * a * b) / 100, hint: `${b}% of ${100 * k} is ${b * k}. Then ${a}% of that.` };
  },
  // 20
  (r) => {
    const left = r.int(5, 40);
    return { prompt: `You spend 1/3 of your money, then half of what is left. You have $${left} remaining. How much did you start with?`, answer: 3 * left, hint: `After the first spend 2/3 is left; half of that is 1/3 of the start. So the start is 3 × ${left}.` };
  },
];

export const FRACTIONS_MAX_LEVEL = GENERATORS.length;

export const generateFractions = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
