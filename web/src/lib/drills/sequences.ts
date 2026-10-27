import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const SEQUENCES_LEVELS = [
  "Add the same each time",
  "The missing term",
  "Multiply each time",
  "The 10th term and beyond",
  "Adding 1 to n",
  "Sums of odd numbers",
  "Squares, cubes and growing steps",
  "Each term is the sum of the last two",
  "Two sequences woven together",
  "Sums of sequences",
] as const;

type Gen = (r: Rng) => Problem;

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const a = r.int(1, 30), d = r.int(2, 9);
    return { prompt: `${a}, ${a + d}, ${a + 2 * d}, ${a + 3 * d}, ?`, answer: a + 4 * d, hint: `It goes up by ${d} each time.` };
  },
  // 2
  (r) => {
    const a = r.int(1, 30), d = r.int(2, 9), hole = r.int(1, 3);
    const terms = [0, 1, 2, 3, 4].map((i) => (i === hole ? "?" : String(a + i * d)));
    return { prompt: terms.join(", "), answer: a + hole * d, hint: `The steps are ${d} each. Fill in the gap.` };
  },
  // 3
  (r) => {
    const a = r.int(1, 5), q = r.pick([2, 3, 4] as const);
    return { prompt: `${a}, ${a * q}, ${a * q ** 2}, ${a * q ** 3}, ?`, answer: a * q ** 4, hint: `Each term is ${q} times the one before.` };
  },
  // 4
  (r) => {
    const a = r.int(2, 12), d = r.int(2, 9), n = r.int(8, 20);
    return {
      prompt: `${a}, ${a + d}, ${a + 2 * d}, ${a + 3 * d}, ... What is term number ${n}?`,
      answer: a + (n - 1) * d,
      hint: `Start at ${a} and take ${n - 1} steps of ${d}.`,
    };
  },
  // 5
  (r) => {
    const n = r.int(6, 25);
    if (r.next() < 0.5) return { prompt: `1 + 2 + 3 + ... + ${n}`, answer: (n * (n + 1)) / 2, hint: `Pair them up: ${n} × ${n + 1} ÷ 2.` };
    return { prompt: `2 + 4 + 6 + ... + ${2 * n}`, answer: n * (n + 1), hint: `That is double 1 + 2 + ... + ${n}, which is ${n} × ${n + 1}.` };
  },
  // 6
  (r) => {
    const n = r.int(4, 15);
    return { prompt: `1 + 3 + 5 + ... (the first ${n} odd numbers)`, answer: n * n, hint: `The first ${n} odd numbers always add up to ${n} × ${n}.` };
  },
  // 7
  (r) => {
    const kind = r.int(0, 2), c = r.int(0, 9);
    if (kind === 0) return { prompt: `${1 + c}, ${4 + c}, ${9 + c}, ${16 + c}, ?`, answer: 25 + c, hint: `Squares (1, 4, 9, 16...) plus ${c}. The next square is 25.` };
    if (kind === 1) return { prompt: `2, 6, 12, 20, ?`, answer: 30, hint: `The steps grow: +4, +6, +8, so the next is +10.` };
    return { prompt: `1, 8, 27, 64, ?`, answer: 125, hint: `Cubes: 1³, 2³, 3³, 4³. The next is 5³.` };
  },
  // 8
  (r) => {
    const x1 = r.int(1, 6), x2 = r.int(1, 6);
    const terms = [x1, x2];
    for (let i = 2; i < 8; i++) terms.push(terms[i - 1]! + terms[i - 2]!);
    return {
      prompt: `Each term is the sum of the two before: ${terms[0]}, ${terms[1]}, ${terms[2]}, ${terms[3]}, ... What is the 8th term?`,
      answer: terms[7]!,
      hint: `Keep adding the last two: ${terms.join(", ")}.`,
    };
  },
  // 9
  (r) => {
    const a = r.int(1, 20), b = r.int(1, 20), d = r.int(2, 6), e = r.int(2, 6);
    return {
      prompt: `${a}, ${b}, ${a + d}, ${b + e}, ${a + 2 * d}, ${b + 2 * e}, ?`,
      answer: a + 3 * d,
      hint: `Two sequences take turns. The odd places go up by ${d}: ${a}, ${a + d}, ${a + 2 * d}, then ${a + 3 * d}.`,
    };
  },
  // 10
  (r) => {
    if (r.next() < 0.5) {
      const a = r.int(1, 10), d = r.int(2, 6), n = r.int(5, 12);
      return {
        prompt: `${a} + ${a + d} + ${a + 2 * d} + ... (${n} terms)`,
        answer: (n * (2 * a + (n - 1) * d)) / 2,
        hint: `Average of first and last, times the count: (${a} + ${a + (n - 1) * d}) ÷ 2 × ${n}.`,
      };
    }
    const q = r.pick([2, 3] as const), n = r.int(4, 7);
    let sum = 0, term = 1;
    for (let i = 0; i < n; i++) {
      sum += term;
      term *= q;
    }
    return { prompt: `1 + ${q} + ${q * q} + ${q ** 3} + ... (${n} terms)`, answer: sum, hint: `Each term is ${q} times the last. Add them: ${n} terms.` };
  },
];

export const SEQUENCES_MAX_LEVEL = GENERATORS.length;

export const generateSequences = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
