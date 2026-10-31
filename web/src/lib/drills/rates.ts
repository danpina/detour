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
  "Metres per second to km/h",
  "Fuel use",
  "More workers, less time",
  "Diluting a mixture",
  "Catching up",
  "Who is faster?",
  "Tripling",
  "Boats and currents",
  "Ages in the future",
  "A tank that empties",
] as const;

type Gen = (r: Rng) => Problem;

/** Out and back speeds with their whole-number average (2ab / (a + b)). */
const ROUND_TRIPS: readonly (readonly [number, number, number])[] = [[30, 60, 40], [40, 60, 48], [60, 90, 72], [20, 30, 24], [60, 120, 80], [30, 45, 36]];
/** Hours to do a job alone, for two workers, and the hours it takes together (ab / (a + b)). */
const TEAMS: readonly (readonly [number, number, number])[] = [[6, 3, 2], [12, 4, 3], [10, 15, 6], [6, 12, 4], [20, 30, 12], [8, 8, 4], [12, 12, 6]];
const GROUPS: readonly (readonly [number, number])[] = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1]];

/** Litres of juice mixture, its percent juice, litres of water added, and the new percent. */
const MIXES: readonly (readonly [number, number, number, number])[] = [
  [20, 50, 20, 25], [30, 40, 30, 20], [10, 60, 5, 40], [24, 50, 24, 25], [60, 30, 30, 20], [15, 40, 10, 24], [20, 30, 10, 20],
];

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

  // 11
  (r) => {
    const v = r.pick([5, 10, 15, 20, 25] as const);
    return { prompt: `${v} m/s is how many km/h? (multiply by 3.6)`, answer: (v * 18) / 5, hint: `${v} × 3.6.` };
  },
  // 12
  (r) => {
    const rate = 2 * r.int(3, 6), km = 50 * r.int(2, 10);
    return { prompt: `A car uses ${rate} litres per 100 km. How many litres for ${km} km?`, answer: (rate * km) / 100, hint: `${km} km is ${km / 100} lots of 100 km.` };
  },
  // 13
  (r) => {
    const w = r.int(2, 5), k = r.int(2, 3), d = k * r.int(2, 6);
    return { prompt: `${w} workers build a wall in ${d} days. How many days would ${w * k} workers take?`, answer: d / k, hint: `${k} times the workers, so ${k} times faster: ${d} ÷ ${k}.` };
  },
  // 14
  (r) => {
    const [y, c, w, result] = r.pick(MIXES);
    return { prompt: `${y} litres of ${c}% juice and ${w} litres of water are mixed. The percent juice in the mix?`, answer: result, hint: `There is ${(y * c) / 100} litres of juice in ${y + w} litres.` };
  },
  // 15
  (r) => {
    const vB = 10 * r.int(3, 8), diff = 10 * r.int(1, 3), gap = diff * r.int(1, 5);
    return { prompt: `A car at ${vB + diff} km/h chases one at ${vB} km/h that is ${gap} km ahead. Hours to catch up?`, answer: gap / diff, hint: `It gains ${diff} km every hour. ${gap} ÷ ${diff}.` };
  },
  // 16
  (r) => {
    const aFaster = r.next() < 0.5;
    const tA = r.pick([2, 3, 4] as const), tB = r.pick([2, 3, 5] as const);
    const base = 5 * r.int(6, 14), extra = 5 * r.int(1, 2);
    const sA = aFaster ? base + extra : base, sB = aFaster ? base : base + extra;
    return {
      prompt: `Cyclist A rode ${sA * tA} km in ${tA} hours. Cyclist B rode ${sB * tB} km in ${tB} hours. Who is faster?`,
      choices: ["Cyclist A", "Cyclist B"],
      answer: aFaster ? 0 : 1,
      hint: `A rode ${sA} km/h and B rode ${sB} km/h.`,
    };
  },
  // 17
  (r) => {
    const start = r.int(2, 10), d = r.int(2, 5), k = r.int(2, 4);
    return { prompt: `A culture of ${start} bacteria triples every ${d} hours. How many after ${k * d} hours?`, answer: start * 3 ** k, hint: `${k * d} hours is ${k} triplings: ${start} × 3, ${k} times over.` };
  },
  // 18
  (r) => {
    const x = r.int(8, 15), c = r.int(1, 4), k = r.int(2, 5);
    return { prompt: `A boat goes ${x} km/h in still water and the river flows at ${c} km/h. Hours to go ${k * (x + c)} km downstream?`, answer: k, hint: `Downstream the speeds add: ${x + c} km/h. ${k * (x + c)} ÷ ${x + c}.` };
  },
  // 19
  (r) => {
    const ben = r.int(5, 20), diff = r.int(2, 10), k = r.int(2, 8);
    return { prompt: `Anna is ${diff} years older than Ben. In ${k} years their ages add up to ${2 * ben + diff + 2 * k}. Ben's age now?`, answer: ben, hint: `Take off the ${2 * k} years that pass for both, then the ${diff}, and halve.` };
  },
  // 20
  (r) => {
    const out = r.int(5, 12), inn = r.int(1, out - 2), k = r.int(3, 10);
    return { prompt: `A tank holds ${k * (out - inn)} litres. It drains ${out} litres a minute while a pump adds ${inn} a minute. Minutes to empty?`, answer: k, hint: `It loses ${out - inn} litres a minute overall.` };
  },
];

export const RATES_MAX_LEVEL = GENERATORS.length;

export const generateRates = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
