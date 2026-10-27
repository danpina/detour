import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const GEOMETRY_LEVELS = [
  "Perimeter of a rectangle",
  "Area of a rectangle",
  "Area of a triangle",
  "The third angle of a triangle",
  "Complementary and straight-line angles",
  "L-shaped areas",
  "Circles, with π ≈ 3",
  "Volume of a box",
  "Right triangles: Pythagoras",
  "Trapezoids and polygon angles",
] as const;

type Gen = (r: Rng) => Problem;

/** Whole-number right triangles: legs and hypotenuse. */
const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const w = r.int(3, 20), h = r.int(2, 15);
    return { prompt: `Perimeter of a ${w} × ${h} rectangle`, answer: 2 * (w + h), hint: `Two widths and two heights: 2 × (${w} + ${h}).` };
  },
  // 2
  (r) => {
    const w = r.int(3, 12), h = r.int(3, 12);
    return { prompt: `Area of a ${w} × ${h} rectangle`, answer: w * h, hint: `Width times height: ${w} × ${h}.` };
  },
  // 3
  (r) => {
    const b = 2 * r.int(2, 10), h = r.int(3, 12);
    return { prompt: `Area of a triangle, base ${b}, height ${h}`, answer: (b * h) / 2, hint: `Half of base times height: half of ${b} × ${h}.` };
  },
  // 4
  (r) => {
    const a = r.int(30, 80), b = r.int(30, 80);
    return { prompt: `Triangle with angles ${a}° and ${b}°. The third angle?`, answer: 180 - a - b, hint: `The three angles add up to 180°. 180 − ${a} − ${b}.` };
  },
  // 5
  (r) => {
    const a = r.int(10, 80);
    if (r.next() < 0.5) return { prompt: `Complement of ${a}° (adds up to 90°)`, answer: 90 - a, hint: `90 − ${a}.` };
    const b = r.int(20, 160);
    return { prompt: `An angle of ${b}° on a straight line. The angle beside it?`, answer: 180 - b, hint: `A straight line is 180°. 180 − ${b}.` };
  },
  // 6
  (r) => {
    const w = r.int(8, 14), h = r.int(7, 12), cw = r.int(2, 5), ch = r.int(2, 4);
    return {
      prompt: `${w} × ${h} rectangle with a ${cw} × ${ch} corner cut out. Area?`,
      answer: w * h - cw * ch,
      hint: `Whole rectangle ${w * h}, minus the corner ${cw * ch}.`,
    };
  },
  // 7
  (r) => {
    const rad = r.int(2, 10);
    if (r.next() < 0.5) return { prompt: `Area of a circle, radius ${rad} (π ≈ 3)`, answer: 3 * rad * rad, hint: `π × r²: 3 × ${rad} × ${rad}.` };
    return { prompt: `Circumference of a circle, radius ${rad} (π ≈ 3)`, answer: 6 * rad, hint: `2 × π × r: 2 × 3 × ${rad}.` };
  },
  // 8
  (r) => {
    const l = r.int(2, 9), w = r.int(2, 9), h = r.int(2, 9);
    return { prompt: `Volume of a ${l} × ${w} × ${h} box`, answer: l * w * h, hint: `Length × width × height. Do ${l} × ${w} = ${l * w} first.` };
  },
  // 9
  (r) => {
    const [a, b, c] = r.pick(TRIPLES);
    const k = r.int(1, 2);
    if (r.next() < 0.5) return { prompt: `Right triangle, legs ${a * k} and ${b * k}. The long side?`, answer: c * k, hint: `A ${a}-${b}-${c} triangle${k > 1 ? `, doubled` : ""}.` };
    return { prompt: `Right triangle, long side ${c * k}, one leg ${a * k}. The other leg?`, answer: b * k, hint: `A ${a}-${b}-${c} triangle${k > 1 ? `, doubled` : ""}.` };
  },
  // 10
  (r) => {
    if (r.next() < 0.5) {
      const a = r.int(2, 10), h = r.int(2, 10), step = r.int(1, 5), b = a + 2 * step;
      return { prompt: `Trapezoid with parallel sides ${a} and ${b}, height ${h}. Area?`, answer: ((a + b) / 2) * h, hint: `Average the parallel sides, ${(a + b) / 2}, then times ${h}.` };
    }
    const n = r.int(5, 10);
    return { prompt: `Angles inside a ${n}-sided polygon add up to?`, answer: (n - 2) * 180, hint: `(${n} − 2) × 180°.` };
  },
];

export const GEOMETRY_MAX_LEVEL = GENERATORS.length;

export const generateGeometry = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
