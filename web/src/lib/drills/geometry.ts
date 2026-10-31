import type { Problem } from "./mentalMath";
import { trueFalse } from "./choice";
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
  "Square: area to perimeter",
  "Area of a rhombus",
  "Circumference from the diameter",
  "Volume of a cylinder",
  "The diagonal of a rectangle",
  "True or false: right triangles",
  "Angles of regular polygons",
  "Enlarging a triangle",
  "Surface area of a cube",
  "Distance between two points",
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

  // 11
  (r) => {
    const s = r.int(3, 12);
    return { prompt: `A square has area ${s * s}. Its perimeter?`, answer: 4 * s, hint: `The side is ${s}, so the perimeter is 4 × ${s}.` };
  },
  // 12
  (r) => {
    const d1 = 2 * r.int(2, 8), d2 = r.int(3, 10);
    return { prompt: `A rhombus with diagonals ${d1} and ${d2}. Its area?`, answer: (d1 * d2) / 2, hint: `Half of the diagonals multiplied: half of ${d1} × ${d2}.` };
  },
  // 13
  (r) => {
    const d = r.int(2, 14);
    return { prompt: `Circumference of a circle with diameter ${d} (π ≈ 3)`, answer: 3 * d, hint: `π × diameter: 3 × ${d}.` };
  },
  // 14
  (r) => {
    const rad = r.int(1, 5), h = r.int(2, 9);
    return { prompt: `Volume of a cylinder, radius ${rad}, height ${h} (π ≈ 3)`, answer: 3 * rad * rad * h, hint: `π × r² × h: 3 × ${rad * rad} × ${h}.` };
  },
  // 15
  (r) => {
    const [a, b, c] = r.pick(TRIPLES), k = r.int(1, 2);
    return { prompt: `A ${a * k} by ${b * k} rectangle. Its diagonal?`, answer: c * k, hint: `The diagonal is the long side of a right triangle: a ${a}-${b}-${c} triangle${k > 1 ? ", doubled" : ""}.` };
  },
  // 16
  (r) => {
    const [a, b, c] = r.pick(TRIPLES);
    const right = r.next() < 0.5;
    return {
      prompt: `True or false: a triangle with sides ${a}, ${b} and ${right ? c : c + 1} is a right triangle.`,
      ...trueFalse(right),
      hint: `Check ${a}² + ${b}² = ${a * a + b * b} against the long side squared: ${(right ? c : c + 1) ** 2}.`,
    };
  },
  // 17
  (r) => {
    const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12] as const);
    return { prompt: `Each angle of a regular ${n}-sided polygon?`, answer: ((n - 2) * 180) / n, hint: `All angles add up to (${n} − 2) × 180°. Share that between ${n} angles.` };
  },
  // 18
  (r) => {
    const [a, b, c] = r.pick(TRIPLES), k = r.int(2, 5);
    return { prompt: `A triangle with sides ${a}, ${b} and ${c} is enlarged ${k} times. The new perimeter?`, answer: (a + b + c) * k, hint: `Every side grows ${k} times, so the perimeter does too: ${a + b + c} × ${k}.` };
  },
  // 19
  (r) => {
    const s = r.int(2, 9);
    return { prompt: `Surface area of a cube with side ${s}`, answer: 6 * s * s, hint: `Six square faces of ${s} × ${s}.` };
  },
  // 20
  (r) => {
    const [a, b, c] = r.pick(TRIPLES), x = r.int(0, 5), y = r.int(0, 5);
    return { prompt: `Distance from (${x}, ${y}) to (${x + a}, ${y + b})`, answer: c, hint: `${a} across and ${b} up: a ${a}-${b}-${c} right triangle.` };
  },
];

export const GEOMETRY_MAX_LEVEL = GENERATORS.length;

export const generateGeometry = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
