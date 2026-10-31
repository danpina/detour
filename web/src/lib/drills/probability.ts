import type { Problem } from "./mentalMath";
import { choose, trueFalse } from "./choice";
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
  "The chance of not",
  "Either one or the other",
  "Drawing without putting back",
  "Expected total of dice",
  "Arranging letters with repeats",
  "Which is most likely?",
  "Choosing exactly k heads",
  "Odds to percent",
  "True or false: chance myths",
  "Expected profit",
] as const;

type Gen = (r: Rng) => Problem;

const TOTALS = [4, 5, 10, 20, 25] as const;

/** [red marbles, all marbles, chance both of two draws are red, in percent]. */
const BAGS: readonly (readonly [number, number, number])[] = [[3, 5, 30], [4, 5, 60], [2, 5, 10], [3, 4, 50], [4, 6, 40], [3, 6, 20]];
/** Words with repeated letters, and how many ways their letters can be arranged. */
const WORDS: readonly (readonly [string, number])[] = [["LEVEL", 30], ["NOON", 6], ["TOOTH", 30], ["BANANA", 60], ["MOON", 12], ["APPLE", 60]];
/** Three chances, the most likely first. */
const CHANCES: readonly (readonly string[])[] = [
  ["1 in 2", "1 in 3", "1 in 5"],
  ["3 in 4", "2 in 3", "3 in 5"],
  ["2 in 5", "3 in 10", "1 in 4"],
  ["7 in 10", "3 in 5", "1 in 2"],
  ["4 in 5", "3 in 4", "2 in 3"],
];
/** Odds in favour (for : against) whose chance is a whole percent. */
const ODDS: readonly (readonly [number, number])[] = [[1, 1], [3, 1], [1, 3], [1, 4], [4, 1], [2, 3], [3, 2], [1, 9], [9, 1], [3, 7], [7, 3]];
const MYTHS: readonly (readonly [string, boolean])[] = [
  ["after five heads in a row, tails is now more likely", false],
  ["two fair dice are more likely to total 7 than 12", true],
  ["rolling a 6 twice in a row is less likely than a 6 and then a 1", false],
  ["a fair coin flipped 100 times will always give exactly 50 heads", false],
  ["an event with a 10% chance can still happen twice in a row", true],
  ["a card drawn at random is as likely to be red as black", true],
];

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

  // 11
  (r) => {
    const p = r.int(1, 19) * 5;
    return { prompt: `A ${p}% chance of rain. The chance it stays dry, in percent?`, answer: 100 - p, hint: `The two chances add up to 100%: 100 − ${p}.` };
  },
  // 12
  (r) => {
    const a = r.int(1, 5) * 10, b = r.int(1, 5) * 10;
    return { prompt: `Two events that cannot both happen: ${a}% and ${b}%. The chance of one or the other?`, answer: a + b, hint: `They cannot overlap, so add them: ${a} + ${b}.` };
  },
  // 13
  (r) => {
    const [red, total, pct] = r.pick(BAGS);
    return {
      prompt: `A bag has ${red} red and ${total - red} blue marbles. You draw two without putting any back. The chance both are red, in percent?`,
      answer: pct,
      hint: `${red}/${total} for the first, then ${red - 1}/${total - 1} for the second. Multiply them.`,
    };
  },
  // 14
  (r) => {
    const n = r.pick([2, 4, 6, 8, 10] as const);
    return { prompt: `Roll ${n} fair dice. The expected total?`, answer: (7 * n) / 2, hint: `Each die averages 3.5, so ${n} dice average ${n} × 3.5.` };
  },
  // 15
  (r) => {
    const [word, count] = r.pick(WORDS);
    return { prompt: `How many different ways can the letters of ${word} be arranged?`, answer: count, hint: `Count all orders, then divide by the orders of the repeated letters.` };
  },
  // 16
  (r) => {
    const [top, ...rest] = r.pick(CHANCES);
    return { prompt: `Which is the most likely?`, ...choose(r, top!, rest), hint: `Turn each into a percent to compare them.` };
  },
  // 17
  (r) => {
    const n = r.int(4, 7), k = r.int(2, 3);
    let top = 1, bottom = 1;
    for (let i = 0; i < k; i++) {
      top *= n - i;
      bottom *= i + 1;
    }
    return { prompt: `You flip a coin ${n} times. In how many different orders can exactly ${k} of them be heads?`, answer: top / bottom, hint: `Choose which ${k} of the ${n} flips are heads.` };
  },
  // 18
  (r) => {
    const [a, b] = r.pick(ODDS);
    return { prompt: `The odds in favour of an event are ${a} to ${b}. Its chance, in percent?`, answer: (100 * a) / (a + b), hint: `${a} chances for, ${b} against: ${a} out of ${a + b}.` };
  },
  // 19
  (r) => {
    const [text, truth] = r.pick(MYTHS);
    return { prompt: `True or false: ${text}.`, ...trueFalse(truth), hint: truth ? "That one holds." : "That is a common mix-up: chance has no memory." };
  },
  // 20
  (r) => {
    const w = 10 * r.int(2, 10), pp = 10 * r.int(2, 8);
    const expected = (w / 10) * (pp / 10);
    const cost = r.int(1, expected - 1);
    return {
      prompt: `Pay $${cost} to play: win $${w} with a ${pp}% chance. The expected profit, in dollars?`,
      answer: expected - cost,
      hint: `The expected win is ${pp}% of ${w} = ${expected}. Take away the $${cost} it costs.`,
    };
  },
];

export const PROBABILITY_MAX_LEVEL = GENERATORS.length;

export const generateProbability = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
