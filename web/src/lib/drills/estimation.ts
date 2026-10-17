import type { Rng } from "./rng";
import type { Problem } from "./mentalMath";

/**
 * Fermi-style estimation. Every question states its premises, so the exact answer is computed from them;
 * nothing relies on outside facts. The learner is scored by log distance (how many times too big or small).
 */
export const ESTIMATION_LEVELS = [
  "Time conversions",
  "Rates over time",
  "Volumes and fitting things in",
  "Fermi chains",
] as const;

const UNIT_SECONDS = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 } as const;

type Gen = (r: Rng) => Problem;

const GENERATORS: Gen[] = [
  // 1: time conversions
  (r) => {
    const pairs = [
      ["second", "hour", 2, 12],
      ["second", "day", 2, 9],
      ["minute", "day", 2, 9],
      ["minute", "week", 2, 6],
      ["hour", "week", 2, 9],
    ] as const;
    const [small, big, lo, hi] = r.pick(pairs);
    const n = r.int(lo, hi);
    const answer = (n * UNIT_SECONDS[big]) / UNIT_SECONDS[small];
    return { prompt: `How many ${small}s are in ${n} ${big}${n > 1 ? "s" : ""}?`, answer, hint: `${UNIT_SECONDS[big] / UNIT_SECONDS[small]} ${small}s in a ${big}, times ${n}.` };
  },
  // 2: rates over time
  (r) => {
    const t = r.int(0, 2);
    if (t === 0) {
      const bpm = r.pick([60, 70, 80] as const), days = r.int(2, 9);
      return { prompt: `A heart beats ${bpm} times a minute. How many beats in ${days} days?`, answer: bpm * 60 * 24 * days, hint: `${bpm} × 60 minutes × 24 hours × ${days}.` };
    }
    if (t === 1) {
      const per = r.pick([2, 3, 5] as const), weeks = r.int(2, 8);
      return { prompt: `A tap drips ${per} drops every second. How many drops in ${weeks} weeks?`, answer: per * 604800 * weeks, hint: `${per} × 604,800 seconds per week × ${weeks}.` };
    }
    const kmh = r.pick([4, 5, 6] as const), hours = r.int(5, 40);
    return { prompt: `Someone walks ${kmh} km every hour without stopping. How many metres in ${hours} hours?`, answer: kmh * 1000 * hours, hint: `${kmh} km = ${kmh * 1000} m, times ${hours}.` };
  },
  // 3: volumes
  (r) => {
    const t = r.int(0, 2);
    if (t === 0) {
      const s = r.int(2, 9);
      return { prompt: `A cube is ${s} m on each side. How many 1-litre bottles of water fit in it? (1 m³ = 1,000 litres)`, answer: s ** 3 * 1000, hint: `${s}³ = ${s ** 3} cubic metres, times 1,000.` };
    }
    if (t === 1) {
      const a = r.int(2, 6), b = r.int(2, 8), c = r.int(2, 5);
      return { prompt: `A room is ${a} m × ${b} m with a ${c} m ceiling. How many 1-litre bottles of air would fill it? (1 m³ = 1,000 litres)`, answer: a * b * c * 1000, hint: `${a} × ${b} × ${c} = ${a * b * c} cubic metres, times 1,000.` };
    }
    const s = r.int(2, 6);
    return { prompt: `How many 1 cm cubes fit inside a cube that is ${s} m on each side? (1 m = 100 cm)`, answer: (s * 100) ** 3, hint: `${s * 100} cm on each side, cubed.` };
  },
  // 4: Fermi chains
  (r) => {
    const t = r.int(0, 2);
    if (t === 0) {
      const millions = r.int(2, 9), litres = r.pick([2, 3] as const);
      return { prompt: `A city has ${millions} million people and each drinks ${litres} litres of water a day. How many litres does it drink in a year (365 days)?`, answer: millions * 1e6 * litres * 365, hint: `${millions}M × ${litres} × 365.` };
    }
    if (t === 1) {
      const students = r.pick([400, 800, 1200, 2000] as const), msgs = r.pick([20, 30, 50] as const);
      return { prompt: `A school has ${students} students. Each sends ${msgs} messages a day, and the school year has 180 days. How many messages in a school year?`, answer: students * msgs * 180, hint: `${students} × ${msgs} × 180.` };
    }
    const cars = r.int(2, 8), km = r.pick([30, 40, 50] as const);
    return { prompt: `A town has ${cars} thousand cars. Each drives ${km} km a day. How many km in a 30-day month?`, answer: cars * 1000 * km * 30, hint: `${cars},000 × ${km} × 30.` };
  },
];

export const generateEstimation = (level: number, r: Rng): Problem =>
  GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);

export const ESTIMATION_MAX_LEVEL = GENERATORS.length;

// ---------- scoring ----------

/** How many times too big or too small the guess is (always >= 1). */
export function timesOff(guess: number, answer: number): number {
  if (!(guess > 0) || !(answer > 0)) return Infinity;
  return Math.pow(10, Math.abs(Math.log10(guess / answer)));
}

/** A guess counts as right when it is within a factor of 2. */
export const ESTIMATION_TOLERANCE = 2;
export const isCloseEnough = (guess: number, answer: number) => timesOff(guess, answer) <= ESTIMATION_TOLERANCE;

export function estimationVerdict(guess: number, answer: number): string {
  const x = timesOff(guess, answer);
  if (x <= 1.1) return "Spot on";
  if (x <= ESTIMATION_TOLERANCE) return "Close enough";
  if (x <= 10) return "Right ballpark, but a bit off";
  return "Way off. Now you have a feel for it";
}
