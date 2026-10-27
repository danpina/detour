import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const RATES_LEVELS = [
  "Distance from speed and time",
  "Time from distance and speed",
  "Speed from distance and time",
  "Average speed there and back",
  "Meeting in the middle",
  "Working together",
  "Ages: sum and difference",
  "Mixing solutions",
  "Doubling",
  "Break-even",
] as const;

type Gen = (r: Rng) => Problem;

/** Out and back speeds with their whole-number average (2ab / (a + b)). */
const ROUND_TRIPS: readonly (readonly [number, number, number])[] = [[30, 60, 40], [40, 60, 48], [60, 90, 72], [20, 30, 24], [60, 120, 80], [30, 45, 36]];
/** Hours to do a job alone, for two workers, and the hours it takes together (ab / (a + b)). */
const TEAMS: readonly (readonly [number, number, number])[] = [[6, 3, 2], [12, 4, 3], [10, 15, 6], [6, 12, 4], [20, 30, 12], [8, 8, 4], [12, 12, 6]];
const GROUPS: readonly (readonly [number, number])[] = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1]];

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const v = 10 * r.int(3, 12), t = r.int(2, 5);
    return { prompt: `A train goes ${v} km/h for ${t} hours. How far?`, answer: v * t, hint: `Distance = speed × time: ${v} × ${t}.` };
  },
  // 2
  (r) => {
    const v = 10 * r.int(3, 12), t = r.int(2, 6);
    return { prompt: `${v * t} km at ${v} km/h. How many hours?`, answer: t, hint: `Time = distance ÷ speed: ${v * t} ÷ ${v}.` };
  },
  // 3
  (r) => {
    const v = 10 * r.int(3, 12), t = r.int(2, 6);
    return { prompt: `${v * t} km in ${t} hours. Speed in km/h?`, answer: v, hint: `Speed = distance ÷ time: ${v * t} ÷ ${t}.` };
  },
  // 4
  (r) => {
    const [v1, v2, avg] = r.pick(ROUND_TRIPS);
    return {
      prompt: `You drive out at ${v1} km/h and back at ${v2} km/h. Average speed for the round trip, in km/h?`,
      answer: avg,
      hint: `It is not the plain average: you spend longer at the slower speed. Use 2 × ${v1} × ${v2} ÷ (${v1} + ${v2}).`,
    };
  },
  // 5
  (r) => {
    const v1 = 10 * r.int(3, 9), v2 = 10 * r.int(3, 9), k = r.int(1, 5);
    return {
      prompt: `Two trains ${k * (v1 + v2)} km apart head toward each other at ${v1} and ${v2} km/h. Hours until they meet?`,
      answer: k,
      hint: `They close ${v1 + v2} km every hour. ${k * (v1 + v2)} ÷ ${v1 + v2}.`,
    };
  },
  // 6
  (r) => {
    const [a, b, together] = r.pick(TEAMS);
    return {
      prompt: `One pipe fills a tank in ${a} hours and another in ${b} hours. Both open: how many hours?`,
      answer: together,
      hint: `Add the speeds: 1/${a} + 1/${b} of the tank per hour. Or ${a} × ${b} ÷ (${a} + ${b}).`,
    };
  },
  // 7
  (r) => {
    const older = r.int(20, 45), younger = r.int(5, 15);
    return {
      prompt: `Two ages add up to ${older + younger} and differ by ${older - younger}. The older age?`,
      answer: older,
      hint: `Add the sum and the difference, then halve: (${older + younger} + ${older - younger}) ÷ 2.`,
    };
  },
  // 8
  (r) => {
    const [n1, n2] = r.pick(GROUPS);
    const mean = r.int(20, 40), e = r.int(1, 4);
    const c1 = mean + n2 * e, c2 = mean - n1 * e;
    return {
      prompt: `${100 * n1} ml of ${c1}% juice is mixed with ${100 * n2} ml of ${c2}% juice. Percent juice in the mix?`,
      answer: mean,
      hint: `Weight each by its volume: (${n1} × ${c1} + ${n2} × ${c2}) ÷ ${n1 + n2}.`,
    };
  },
  // 9
  (r) => {
    const start = r.int(2, 20), d = r.int(2, 6), k = r.int(2, 5);
    return {
      prompt: `A colony of ${start} doubles every ${d} years. How many after ${k * d} years?`,
      answer: start * 2 ** k,
      hint: `${k * d} years is ${k} doublings: ${start} × 2, ${k} times over.`,
    };
  },
  // 10
  (r) => {
    const fixed = r.int(10, 40), per = r.int(2, 9), gb = r.int(3, 12);
    return {
      prompt: `Plan A: $${fixed} plus $${per} per GB. Plan B: $${fixed + per * gb} flat. At how many GB do they cost the same?`,
      answer: gb,
      hint: `Plan A's per-GB charges must fill the gap: $${fixed + per * gb} − $${fixed} = $${per * gb}. Divide by $${per}.`,
    };
  },
];

export const RATES_MAX_LEVEL = GENERATORS.length;

export const generateRates = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
