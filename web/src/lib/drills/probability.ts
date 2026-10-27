import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const PROBABILITY_LEVELS = [
  "Coin flips: how many results?",
  "Outfits: multiplying choices",
  "Expected counts",
  "Chance as a percent",
  "Orders: arranging people",
  "Two dice: ways to make a total",
  "Handshakes: choosing pairs",
  "Codes and passwords",
  "Two chances in a row",
  "Choosing a few from many",
] as const;

type Gen = (r: Rng) => Problem;

const TOTALS = [4, 5, 10, 20, 25] as const;

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const n = r.int(2, 6);
    return { prompt: `A fair coin is flipped ${n} times. How many different results are there?`, answer: 2 ** n, hint: `Each flip doubles the options: 2 multiplied ${n} times.` };
  },
  // 2
  (r) => {
    const shirts = r.int(2, 9), trousers = r.int(2, 9);
    return { prompt: `${shirts} shirts and ${trousers} pairs of trousers. How many outfits?`, answer: shirts * trousers, hint: `Each shirt goes with each pair: ${shirts} × ${trousers}.` };
  },
  // 3
  (r) => {
    const k = r.int(2, 20);
    return { prompt: `Roll a fair die ${6 * k} times. About how many times do you expect one particular number?`, answer: k, hint: `Each number comes up about 1 time in 6: ${6 * k} ÷ 6.` };
  },
  // 4
  (r) => {
    const total = r.pick(TOTALS), red = r.int(1, total - 1);
    return {
      prompt: `A bag has ${red} red and ${total - red} blue marbles. Chance of drawing red, in percent?`,
      answer: (100 * red) / total,
      hint: `${red} out of ${total}: scale to 100 by multiplying by ${100 / total}.`,
    };
  },
  // 5
  (r) => {
    const n = r.int(3, 6);
    let answer = 1;
    for (let i = 2; i <= n; i++) answer *= i;
    return { prompt: `In how many different orders can ${n} people stand in a line?`, answer, hint: `${n} choices for first place, then ${n - 1}, and so on down to 1.` };
  },
  // 6
  (r) => {
    const s = r.int(2, 12);
    return { prompt: `Two fair dice. In how many ways can they total ${s}?`, answer: 6 - Math.abs(s - 7), hint: `Seven is the easiest total (6 ways). Each step away from 7 loses one way.` };
  },
  // 7
  (r) => {
    const n = r.int(4, 12);
    return { prompt: `${n} people shake hands once with each other. How many handshakes?`, answer: (n * (n - 1)) / 2, hint: `${n} × ${n - 1} counts each handshake twice, so halve it.` };
  },
  // 8
  (r) => {
    const base = r.pick([10, 26] as const);
    const n = base === 10 ? r.int(2, 4) : r.int(2, 3);
    const what = base === 10 ? `${n}-digit PIN (digits 0–9)` : `${n}-letter code (A–Z)`;
    return { prompt: `How many possible ${what}? Repeats are fine.`, answer: base ** n, hint: `${base} options for each spot, ${n} spots: ${base} multiplied ${n} times.` };
  },
  // 9
  (r) => {
    const a = r.int(1, 9), b = r.int(1, 9);
    return {
      prompt: `A ${10 * a}% chance, then another ${10 * b}% chance. Chance of both, in percent?`,
      answer: a * b,
      hint: `Multiply the chances: ${10 * a}% of ${10 * b}% is ${a} × ${b}.`,
    };
  },
  // 10
  (r) => {
    const n = r.int(5, 8), k = r.int(2, 3);
    let top = 1, bottom = 1;
    for (let i = 0; i < k; i++) {
      top *= n - i;
      bottom *= i + 1;
    }
    return {
      prompt: `Choose ${k} people from ${n} for a team. How many different teams?`,
      answer: top / bottom,
      hint: `${n}${k > 1 ? ` × ${n - 1}` : ""}${k > 2 ? ` × ${n - 2}` : ""} = ${top} ordered picks, divided by the ${bottom} orders of the same team.`,
    };
  },
];

export const PROBABILITY_MAX_LEVEL = GENERATORS.length;

export const generateProbability = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
