import type { Problem } from "./mentalMath";
import { choose, trueFalse } from "./choice";
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
  "Triangular numbers",
  "Terms of a doubling or tripling sequence",
  "What comes next? (pick one)",
  "Growing steps: quadratic patterns",
  "Sums of squares",
  "Two rules in turn",
  "Working backwards in a chain",
  "Which term is it?",
  "Adding powers of 2",
  "True or false: sequences",
] as const;

type Gen = (r: Rng) => Problem;

const STATEMENTS: readonly (readonly [string, boolean])[] = [
  ["2, 4, 8, 16 adds the same amount each time", false],
  ["5, 8, 11, 14 adds the same amount each time", true],
  ["3, 6, 12, 24 multiplies by the same number each time", true],
  ["1, 4, 9, 16 goes up by the same amount each time", false],
  ["10, 7, 4, 1 is an arithmetic sequence", true],
  ["1, 1, 2, 3, 5 adds 1 each time", false],
];

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

  // 11
  (r) => {
    const n = r.int(5, 20);
    return { prompt: `Triangular numbers go 1, 3, 6, 10, ... What is number ${n}?`, answer: (n * (n + 1)) / 2, hint: `It is 1 + 2 + ... + ${n}: ${n} × ${n + 1} ÷ 2.` };
  },
  // 12
  (r) => {
    const a = r.int(1, 4), q = r.pick([2, 3] as const), n = r.int(5, 8);
    return { prompt: `${a}, ${a * q}, ${a * q * q}, ... What is term number ${n}?`, answer: a * q ** (n - 1), hint: `Start with ${a} and multiply by ${q}, ${n - 1} times.` };
  },
  // 13
  (r) => {
    const a = r.int(2, 20), d = r.int(2, 9);
    return {
      prompt: `${a}, ${a + d}, ${a + 2 * d}, ${a + 3 * d}, ... What comes next?`,
      ...choose(r, String(a + 4 * d), [String(a + 4 * d + 1), String(a + 4 * d - 1), String(a + 5 * d)]),
      hint: `It goes up by ${d} each time.`,
    };
  },
  // 14
  (r) => {
    const a = r.int(1, 3), b = r.int(0, 4), c = r.int(0, 5);
    const t = (n: number) => a * n * n + b * n + c;
    return { prompt: `${t(1)}, ${t(2)}, ${t(3)}, ${t(4)}, ?`, answer: t(5), hint: `The steps are ${t(2) - t(1)}, ${t(3) - t(2)}, ${t(4) - t(3)}: they grow by ${2 * a} each time.` };
  },
  // 15
  (r) => {
    const n = r.int(3, 10);
    return { prompt: `1² + 2² + 3² + ... + ${n}²`, answer: (n * (n + 1) * (2 * n + 1)) / 6, hint: `The formula is n(n + 1)(2n + 1) ÷ 6 with n = ${n}.` };
  },
  // 16
  (r) => {
    const s = r.int(1, 5);
    return { prompt: `${s}, ${2 * s}, ${2 * s + 1}, ${4 * s + 2}, ${4 * s + 3}, ${8 * s + 6}, ?`, answer: 8 * s + 7, hint: `Two rules take turns: double, then add 1.` };
  },
  // 17
  (r) => {
    const x1 = r.int(1, 6), x2 = r.int(1, 6);
    const t3 = x1 + x2, t4 = x2 + t3;
    return { prompt: `?, ${x2}, ${t3}, ${t4}: each term is the sum of the two before. The first term?`, answer: x1, hint: `${t3} is the first plus ${x2}, so the first is ${t3} − ${x2}.` };
  },
  // 18
  (r) => {
    const a = r.int(2, 12), d = r.int(2, 9), n = r.int(10, 30);
    return { prompt: `${a}, ${a + d}, ${a + 2 * d}, ... Which term is ${a + (n - 1) * d}?`, answer: n, hint: `Take away the start, divide by ${d}, then add 1.` };
  },
  // 19
  (r) => {
    const n = r.int(3, 9);
    return { prompt: `1 + 2 + 4 + ... + ${2 ** n}`, answer: 2 ** (n + 1) - 1, hint: `Adding powers of 2 up to ${2 ** n} always gives one less than the next power of 2.` };
  },
  // 20
  (r) => {
    const [text, truth] = r.pick(STATEMENTS);
    return { prompt: `True or false: ${text}.`, ...trueFalse(truth), hint: truth ? "That one holds." : "Check the steps between the terms." };
  },
];

export const SEQUENCES_MAX_LEVEL = GENERATORS.length;

export const generateSequences = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
