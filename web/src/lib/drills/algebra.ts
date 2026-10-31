import { sup, type Problem } from "./mentalMath";
import { choose } from "./choice";
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
  "Solve x ÷ a + b = c",
  "Unknowns on both sides",
  "Brackets: a(x + b) = c",
  "Evaluate with two letters",
  "Two equations, two unknowns",
  "Which value solves it?",
  "Expanding (x + p)(x + q)",
  "Quadratics: the smaller root",
  "Derivatives of cubics",
  "Integrals of straight lines",
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

  // 11
  (r) => {
    const a = r.int(2, 9), q = r.int(2, 8), b = r.int(1, 12);
    return { prompt: `x ÷ ${a} + ${b} = ${q + b}`, answer: a * q, hint: `Take ${b} away first (${q}), then multiply by ${a}.` };
  },
  // 12
  (r) => {
    const x = r.int(2, 12), a = r.int(4, 9), c = r.int(1, a - 1), b = r.int(1, 15);
    return {
      prompt: `${a}x + ${b} = ${coef(c)}x + ${(a - c) * x + b}`,
      answer: x,
      hint: `Take ${coef(c) || "1"}x from both sides, then ${b} from both: ${a - c}x = ${(a - c) * x}.`,
    };
  },
  // 13
  (r) => {
    const a = r.int(2, 9), b = r.int(1, 9), x = r.int(1, 10);
    return { prompt: `${a}(x + ${b}) = ${a * (x + b)}`, answer: x, hint: `Divide both sides by ${a} first: x + ${b} = ${x + b}.` };
  },
  // 14
  (r) => {
    const x = r.int(5, 12), y = r.int(1, 4), a = r.int(3, 6), b = r.int(1, 2);
    return { prompt: `${a}x − ${b}y, when x = ${x} and y = ${y}`, answer: a * x - b * y, hint: `${a} × ${x} = ${a * x}, then take away ${b} × ${y} = ${b * y}.` };
  },
  // 15
  (r) => {
    const x = r.int(5, 20), y = r.int(1, x - 1);
    return { prompt: `x + y = ${x + y} and x − y = ${x - y}. Find x`, answer: x, hint: `Add the two equations: 2x = ${2 * x}.` };
  },
  // 16
  (r) => {
    const a = r.int(2, 9), b = r.int(1, 12), x = r.int(3, 12);
    const pick = choose(r, String(x), [String(x + 1), String(x - 1), String(x + 2)]);
    return { prompt: `Which value of x solves ${a}x + ${b} = ${a * x + b}?`, ...pick, hint: `Take ${b} away, then divide by ${a}: x = ${x}.` };
  },
  // 17
  (r) => {
    const p = r.int(1, 9), q = r.int(1, 9);
    if (r.next() < 0.5) return { prompt: `(x + ${p})(x + ${q}) = x² + ?x + ${p * q}. What is ?`, answer: p + q, hint: `The middle term is ${p} + ${q}.` };
    return { prompt: `(x + ${p})(x + ${q}) = x² + ${p + q}x + ?. What is ?`, answer: p * q, hint: `The last term is ${p} × ${q}.` };
  },
  // 18
  (r) => {
    const p = r.int(1, 9), q = r.int(1, 9);
    return { prompt: `Smaller root of x² − ${p + q}x + ${p * q} = 0`, answer: Math.min(p, q), hint: `Two numbers that add to ${p + q} and multiply to ${p * q}. Pick the smaller.` };
  },
  // 19
  (r) => {
    const a = r.int(1, 4), b = r.int(1, 5), c = r.int(1, 3);
    return {
      prompt: `d/dx of ${coef(a)}x${sup(3)} + ${coef(b)}x${sup(2)} at x = ${c}`,
      answer: 3 * a * c * c + 2 * b * c,
      hint: `The derivative is ${3 * a}x${sup(2)} + ${2 * b}x. Put ${c} in.`,
    };
  },
  // 20
  (r) => {
    const a = 2 * r.int(1, 4), b = r.int(1, 6), c = r.int(1, 4);
    return {
      prompt: `∫ from 0 to ${c} of (${a}x + ${b}) dx`,
      answer: (a * c * c) / 2 + b * c,
      hint: `The antiderivative is ${a / 2}x${sup(2)} + ${b}x. Put ${c} in.`,
    };
  },
];

export const ALGEBRA_MAX_LEVEL = GENERATORS.length;

export const generateAlgebra = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
