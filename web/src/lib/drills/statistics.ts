import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const STATISTICS_LEVELS = [
  "Mean of three numbers",
  "Median of five",
  "Mode",
  "Range",
  "Mean of five",
  "Median of an even list",
  "Find the missing value for a mean",
  "Totals and means",
  "Weighted means: two groups",
  "How a new value moves the mean",
  "Quartiles and the interquartile range",
  "Rank and percentile",
  "Expected winnings",
  "Standard deviation: the easy sets",
  "Variance",
  "Standard deviation from a data set",
  "z-scores: how many SDs from the mean",
  "From a z-score back to a score",
  "The 68–95 rule for bell curves",
  "Correlation: r² as a percent",
  "Predicting with a fitted line",
  "Test results: how many are flagged?",
  "Test results: a positive, but is it real?",
  "Standard error and poll margins",
] as const;

type Gen = (r: Rng) => Problem;

function shuffled<T>(items: readonly T[], r: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** `n` different whole numbers between lo and hi. */
function distinct(r: Rng, n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = r.int(lo, hi);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const list = (values: readonly number[]) => values.join(", ");

/** Spreads around a mean with whole-number variances: the numbers are mean + each deviation. */
const SPREADS: readonly (readonly number[])[] = [
  [-1, 1],
  [-3, 3],
  [-2, -2, 2, 2],
  [-3, -1, 1, 3],
  [-5, -1, 1, 5],
  [-4, -2, 2, 4],
  [-6, -2, 2, 6],
  [-7, -1, 1, 7],
];

/** Test scenarios on 1,000 people: [people with it, % of them caught, % of the others wrongly flagged]. The share of positives that are real is whole. */
const SCREENING: readonly (readonly [number, number, number])[] = [
  [40, 60, 10], [40, 80, 5], [40, 80, 10], [50, 60, 10], [100, 60, 10], [100, 60, 20], [100, 70, 20],
  [100, 80, 5], [100, 90, 10], [125, 60, 20], [200, 60, 5], [200, 60, 10], [200, 80, 5], [200, 80, 20],
];

const SQUARES: readonly (readonly [number, number])[] = [[4, 2], [9, 3], [16, 4], [25, 5], [36, 6], [49, 7], [64, 8], [100, 10]];
const POLLS: readonly (readonly [number, number])[] = [[100, 10], [400, 20], [625, 25], [2500, 50]];

const LINES: readonly (readonly [string, string])[] = [
  ["sales", "temperature"],
  ["test score", "hours studied"],
  ["energy use", "people in the house"],
  ["weight", "height"],
];

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const m = r.int(8, 40), d1 = r.int(1, 6), d2 = r.int(1, 6);
    const values = shuffled([m - d1, m + d2, m + d1 - d2], r);
    return { prompt: `Mean of ${list(values)}`, answer: m, hint: `Add them up (${3 * m}) and divide by 3.` };
  },
  // 2
  (r) => {
    const values = distinct(r, 5, 1, 40);
    const sorted = [...values].sort((a, b) => a - b);
    return { prompt: `Median of ${list(shuffled(values, r))}`, answer: sorted[2]!, hint: `Put them in order: ${list(sorted)}. The median is the middle one.` };
  },
  // 3
  (r) => {
    const [v, u1, u2, u3] = distinct(r, 4, 1, 30) as [number, number, number, number];
    const values = shuffled([v, v, v, u1, u1, u2, u2, u3], r);
    return { prompt: `Mode of ${list(values)}`, answer: v, hint: `The mode is the value that appears most often. ${v} shows up 3 times.` };
  },
  // 4
  (r) => {
    const values = distinct(r, 6, 1, 60);
    return { prompt: `Range of ${list(values)}`, answer: Math.max(...values) - Math.min(...values), hint: `Biggest minus smallest: ${Math.max(...values)} − ${Math.min(...values)}.` };
  },
  // 5
  (r) => {
    const m = r.int(40, 80);
    const dev = [r.int(-8, 8), r.int(-8, 8), r.int(-8, 8), r.int(-8, 8)];
    const last = -(dev[0]! + dev[1]! + dev[2]! + dev[3]!);
    const values = shuffled([...dev, last].map((d) => m + d), r);
    return { prompt: `Mean of ${list(values)}`, answer: m, hint: `Guess ${m}, then see how far each number is above or below it. The gaps cancel out.` };
  },
  // 6
  (r) => {
    const v0 = r.int(1, 10), v1 = v0 + r.int(1, 5), v2 = v1 + r.int(1, 5), v3 = v2 + 2 * r.int(0, 3), v4 = v3 + r.int(1, 5), v5 = v4 + r.int(1, 5);
    const sorted = [v0, v1, v2, v3, v4, v5];
    return {
      prompt: `Median of ${list(shuffled(sorted, r))}`,
      answer: (v2 + v3) / 2,
      hint: `In order: ${list(sorted)}. With an even count, the median is halfway between the middle two: ${v2} and ${v3}.`,
    };
  },
  // 7
  (r) => {
    const n = r.int(4, 6), m = r.int(35, 70);
    const known: number[] = [];
    for (let i = 0; i < n - 1; i++) known.push(m + r.int(-6, 6));
    const last = n * m - known.reduce((a, b) => a + b, 0);
    return {
      prompt: `The mean of ${n} numbers is ${m}. ${n - 1} of them are ${list(known)}. The last one?`,
      answer: last,
      hint: `All ${n} must add up to ${n} × ${m} = ${n * m}. Take away the ones you know.`,
    };
  },
  // 8
  (r) => {
    const n = r.int(3, 12), m = r.int(5, 30);
    if (r.next() < 0.5) return { prompt: `The mean of ${n} test scores is ${m}. What do they add up to?`, answer: n * m, hint: `Mean times count: ${m} × ${n}.` };
    return { prompt: `${n} numbers add up to ${n * m}. Their mean?`, answer: m, hint: `Total divided by count: ${n * m} ÷ ${n}.` };
  },
  // 9
  (r) => {
    const [n1, n2] = r.pick([[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1], [1, 4], [4, 1]] as const);
    const mean = r.int(60, 90), e = r.int(1, 4);
    const g1 = mean + n2 * e, g2 = mean - n1 * e;
    return {
      prompt: `${n1} student${n1 > 1 ? "s" : ""} averaged ${g1} and ${n2} student${n2 > 1 ? "s" : ""} averaged ${g2}. The average of all of them?`,
      answer: mean,
      hint: `Weight each average by its group: (${n1} × ${g1} + ${n2} × ${g2}) ÷ ${n1 + n2}. Bigger groups pull harder.`,
    };
  },
  // 10
  (r) => {
    const n = r.int(3, 9), m = r.int(10, 40), d = r.int(1, 6);
    const x = m + (n + 1) * d;
    return {
      prompt: `The mean of ${n} numbers is ${m}. You add a ${x}. New mean?`,
      answer: m + d,
      hint: `${x} is ${(n + 1) * d} above ${m}. Shared among ${n + 1} numbers, the mean rises by ${d}.`,
    };
  },
  // 11
  (r) => {
    const sorted = [r.int(1, 10)];
    for (let i = 1; i < 7; i++) sorted.push(sorted[i - 1]! + r.int(1, 6));
    return {
      prompt: `Interquartile range (Q3 − Q1) of ${list(shuffled(sorted, r))}`,
      answer: sorted[5]! - sorted[1]!,
      hint: `In order: ${list(sorted)}. Q1 is the middle of the lower three (${sorted[1]}), Q3 the middle of the upper three (${sorted[5]}).`,
    };
  },
  // 12
  (r) => {
    const n = r.pick([20, 25, 50, 100] as const), rank = r.int(1, n - 1);
    return {
      prompt: `In a group of ${n}, you rank #${rank} from the top. What percent scored below you?`,
      answer: ((n - rank) * 100) / n,
      hint: `${n - rank} of ${n} are below you. Each person is worth ${100 / n}%.`,
    };
  },
  // 13
  (r) => {
    const x = r.int(1, 20), y = r.int(1, 9);
    return {
      prompt: `A $${10 * x} prize with a ${10 * y}% chance. What is the expected win, in dollars?`,
      answer: x * y,
      hint: `Prize times chance: ${10 * x} × ${10 * y}% = ${x} × ${y}.`,
    };
  },
  // 14
  (r) => {
    const n = r.pick([4, 6] as const), m = r.int(20, 60), d = r.int(1, 12);
    const values: number[] = [];
    for (let i = 0; i < n / 2; i++) values.push(m - d, m + d);
    return {
      prompt: `Standard deviation of ${list(shuffled(values, r))}`,
      answer: d,
      hint: `Every number is exactly ${d} from the mean, ${m}. So the typical distance, the SD, is ${d}.`,
    };
  },
  // 15
  (r) => {
    const dev = r.pick(SPREADS), m = r.int(20, 60);
    const variance = dev.reduce((a, d) => a + d * d, 0) / dev.length;
    return {
      prompt: `Variance of ${list(shuffled(dev.map((d) => m + d), r))}`,
      answer: variance,
      hint: `The mean is ${m}. Square each distance from it (${list(dev.map((d) => d * d))}) and average those.`,
    };
  },
  // 16
  (r) => {
    if (r.next() < 0.5) {
      const m = r.int(20, 60);
      return {
        prompt: `Standard deviation of ${list(shuffled([-7, -1, 1, 7].map((d) => m + d), r))}`,
        answer: 5,
        hint: `The mean is ${m}. Squared distances: 49, 1, 1, 49. Their average is 25, and the square root of 25 is 5.`,
      };
    }
    const s = r.int(2, 12);
    return { prompt: `A data set has a variance of ${s * s}. Its standard deviation?`, answer: s, hint: `The SD is the square root of the variance.` };
  },
  // 17
  (r) => {
    const m = r.int(50, 100), s = r.int(2, 15), k = r.int(1, 4);
    return {
      prompt: `Mean ${m}, SD ${s}. A score of ${m + k * s} is how many SDs above the mean?`,
      answer: k,
      hint: `The gap is ${k * s}. Divide by the SD: ${k * s} ÷ ${s}.`,
    };
  },
  // 18
  (r) => {
    const m = r.int(80, 120), s = r.int(2, 15), k = r.int(1, 4);
    if (r.next() < 0.5) return { prompt: `Mean ${m}, SD ${s}. What score is ${k} SD${k > 1 ? "s" : ""} above the mean?`, answer: m + k * s, hint: `${k} × ${s} = ${k * s}. Add it to ${m}.` };
    return { prompt: `Mean ${m}, SD ${s}. What score is ${k} SD${k > 1 ? "s" : ""} below the mean?`, answer: m - k * s, hint: `${k} × ${s} = ${k * s}. Take it from ${m}.` };
  },
  // 19
  (r) => {
    const m = r.int(100, 170), s = r.int(5, 15), kind = r.int(0, 3);
    const where = [`between ${m - s} and ${m + s}`, `between ${m - 2 * s} and ${m + 2 * s}`, `between ${m} and ${m + s}`, `above ${m + s}`][kind]!;
    const answer = [68, 95, 34, 16][kind]!;
    const hint = [
      `Within 1 SD of the mean is about 68%.`,
      `Within 2 SDs of the mean is about 95%.`,
      `Half of 68% is on each side of the mean: 34%.`,
      `Half the data is above the mean. Take away 34% for the part up to 1 SD above: 50 − 34.`,
    ][kind]!;
    return { prompt: `A bell-shaped set has mean ${m} and SD ${s}. Roughly what percent lie ${where}?`, answer, hint };
  },
  // 20
  (r) => {
    const t = r.int(2, 9);
    return {
      prompt: `A correlation of r = 0.${t}. What percent of the variation does it explain (r² × 100)?`,
      answer: t * t,
      hint: `Square 0.${t} to get ${(t * t) / 100}. As a percent, that is ${t * t}.`,
    };
  },
  // 21
  (r) => {
    const [yName, xName] = r.pick(LINES);
    const a = r.int(5, 40), b = r.int(2, 9), x = r.int(5, 30);
    return {
      prompt: `A fitted line: ${yName} = ${a} + ${b} × ${xName}. Predict the ${yName} when ${xName} is ${x}.`,
      answer: a + b * x,
      hint: `Put ${x} in: ${a} + ${b} × ${x}.`,
    };
  },
  // 22
  (r) => {
    const [sick, sens, fp] = r.pick(SCREENING);
    const caught = (sick * sens) / 100, wrong = ((1000 - sick) * fp) / 100;
    return {
      prompt: `Of 1000 people, ${sick} have a condition. The test catches ${sens}% of them and wrongly flags ${fp}% of the rest. How many test positive?`,
      answer: caught + wrong,
      hint: `Caught: ${sens}% of ${sick} = ${caught}. False alarms: ${fp}% of ${1000 - sick} = ${wrong}. Add them.`,
    };
  },
  // 23
  (r) => {
    const [sick, sens, fp] = r.pick(SCREENING);
    const caught = (sick * sens) / 100, wrong = ((1000 - sick) * fp) / 100;
    return {
      prompt: `Of 1000 people, ${sick} have a condition. The test catches ${sens}% of them and wrongly flags ${fp}% of the rest. If you test positive, what percent chance is it real?`,
      answer: (100 * caught) / (caught + wrong),
      hint: `${caught} real positives and ${wrong} false alarms. Real share: ${caught} out of ${caught + wrong}.`,
    };
  },
  // 24
  (r) => {
    if (r.next() < 0.5) {
      const [n, root] = r.pick(SQUARES);
      const k = r.int(2, 12);
      return {
        prompt: `A sample of ${n} has an SD of ${k * root}. The standard error of its mean (SD ÷ √n)?`,
        answer: k,
        hint: `√${n} = ${root}. ${k * root} ÷ ${root}.`,
      };
    }
    const [n, root] = r.pick(POLLS);
    return {
      prompt: `A poll of ${n} people. Roughly what is the margin of error in percent (100 ÷ √n)?`,
      answer: 100 / root,
      hint: `√${n} = ${root}. Then 100 ÷ ${root}.`,
    };
  },
];

export const STATISTICS_MAX_LEVEL = GENERATORS.length;

export const generateStatistics = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
