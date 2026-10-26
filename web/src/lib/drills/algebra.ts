import { sup, type Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const ALGEBRA_LEVELS = [
  "Solve x + a = b",
  "Solve kx = b and x ÷ k = b",
  "Solve ax + b = c",
  "Solve ax − b = c",
  "Slope through two points",
  "Evaluate ax² + b",
  "Quadratics: the larger root",
  "Derivatives: ax^n at a point",
  "Derivatives: ax² + bx at a point",
  "Integrals: area under ax^n",
] as const;

type Gen = (r: Rng) => Problem;

/** The coefficient written in front of x: 1 is left out. */
const coef = (a: number) => (a === 1 ? "" : String(a));

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const x = r.int(2, 30), a = r.int(2, 30);
    return { prompt: `x + ${a} = ${x + a}`, answer: x, hint: `Take ${a} away from both sides.` };
  },
  // 2
  (r) => {
    const k = r.int(2, 9), x = r.int(2, 12);
    if (r.next() < 0.5) return { prompt: `${k}x = ${k * x}`, answer: x, hint: `Divide both sides by ${k}.` };
    return { prompt: `x ÷ ${k} = ${x}`, answer: k * x, hint: `Multiply both sides by ${k}.` };
  },
  // 3
  (r) => {
    const a = r.int(2, 9), x = r.int(2, 12), b = r.int(1, 20);
    return { prompt: `${a}x + ${b} = ${a * x + b}`, answer: x, hint: `Take ${b} away first, then divide by ${a}.` };
  },
  // 4
  (r) => {
    const a = r.int(2, 9), x = r.int(3, 12), b = r.int(1, a * 3 - 1);
    return { prompt: `${a}x − ${b} = ${a * x - b}`, answer: x, hint: `Add ${b} to both sides first, then divide by ${a}.` };
  },
  // 5
  (r) => {
    const x1 = r.int(0, 5), dx = r.int(1, 4), m = r.int(1, 6), y1 = r.int(0, 9);
    return { prompt: `Slope through (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx})`, answer: m, hint: `Slope is the rise over the run: ${m * dx} up for ${dx} across.` };
  },
  // 6
  (r) => {
    const a = r.int(1, 5), b = r.int(1, 9), x = r.int(2, 6);
    return { prompt: `${coef(a)}x² + ${b}, when x = ${x}`, answer: a * x * x + b, hint: `Square ${x} first (${x * x}), then multiply by ${a} and add ${b}.` };
  },
  // 7
  (r) => {
    const p = r.int(1, 9), q = r.int(1, 9);
    return { prompt: `Larger root of x² − ${p + q}x + ${p * q} = 0`, answer: Math.max(p, q), hint: `Find two numbers that add to ${p + q} and multiply to ${p * q}. Those are the roots.` };
  },
  // 8
  (r) => {
    const a = r.int(1, 4), n = r.int(2, 4), c = r.int(1, 3);
    let power = 1;
    for (let i = 0; i < n - 1; i++) power *= c;
    return { prompt: `d/dx of ${coef(a)}x${sup(n)} at x = ${c}`, answer: a * n * power, hint: `The derivative of ax${sup(n)} is ${a * n}x${sup(n - 1)}. Put ${c} in.` };
  },
  // 9
  (r) => {
    const a = r.int(1, 5), b = r.int(1, 9), c = r.int(1, 5);
    return { prompt: `d/dx of ${coef(a)}x² + ${b}x at x = ${c}`, answer: 2 * a * c + b, hint: `The derivative is ${2 * a}x + ${b}. Put ${c} in.` };
  },
  // 10
  (r) => {
    const a = r.int(1, 3), n = r.int(1, 3), c = r.int(1, 3);
    let power = 1;
    for (let i = 0; i < n + 1; i++) power *= c;
    return {
      prompt: `∫ from 0 to ${c} of ${a * (n + 1)}x${sup(n)} dx`,
      answer: a * power,
      hint: `The antiderivative of ${a * (n + 1)}x${sup(n)} is ${coef(a)}x${sup(n + 1)}. Put ${c} in.`,
    };
  },
];

export const ALGEBRA_MAX_LEVEL = GENERATORS.length;

export const generateAlgebra = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
