import type { Problem } from "./mentalMath";
import type { Rng } from "./rng";

export const MONEY_LEVELS = [
  "Making change",
  "Totals: items at a price",
  "Unit prices",
  "Splitting the bill",
  "Discounts: 10%, 20%, 25%, 50% off",
  "Tips: 10%, 15%, 20%",
  "Saving up: how many weeks?",
  "Percent up and down",
  "Simple interest",
  "Compound interest, two years",
] as const;

type Gen = (r: Rng) => Problem;

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const paid = r.pick([20, 50, 100] as const), cost = r.int(3, paid - 1);
    return { prompt: `You pay $${paid} for something that costs $${cost}. Change?`, answer: paid - cost, hint: `Count up from ${cost} to ${paid}.` };
  },
  // 2
  (r) => {
    const n = r.int(2, 9), price = r.int(2, 25);
    return { prompt: `${n} items at $${price} each. Total?`, answer: n * price, hint: `Split ${price} into tens and ones, multiply each by ${n}, and add.` };
  },
  // 3
  (r) => {
    const n = r.pick([4, 6, 8, 10, 12] as const), each = r.int(1, 9);
    return { prompt: `A pack of ${n} costs $${n * each}. What does one cost, in dollars?`, answer: each, hint: `Divide the price by ${n}.` };
  },
  // 4
  (r) => {
    const n = r.int(2, 8), each = r.int(5, 30);
    return { prompt: `A $${n * each} bill split evenly between ${n} people. Each pays?`, answer: each, hint: `${n * each} ÷ ${n}.` };
  },
  // 5
  (r) => {
    const price = 40 * r.int(1, 10), off = r.pick([10, 20, 25, 50] as const);
    return { prompt: `$${price} with ${off}% off. New price?`, answer: price - (price * off) / 100, hint: `${off}% of ${price} is ${(price * off) / 100}. Take it away.` };
  },
  // 6
  (r) => {
    const bill = 20 * r.int(2, 12), pct = r.pick([10, 15, 20] as const);
    return { prompt: `${pct}% tip on a $${bill} bill. The tip, in dollars?`, answer: (bill * pct) / 100, hint: `10% of ${bill} is ${bill / 10}. ${pct === 15 ? "Add half of that for 15%." : pct === 20 ? "Double it for 20%." : "That is the answer."}` };
  },
  // 7
  (r) => {
    const weekly = r.int(5, 40), weeks = r.int(4, 20);
    return { prompt: `Save $${weekly} a week. How many weeks to reach $${weekly * weeks}?`, answer: weeks, hint: `${weekly * weeks} ÷ ${weekly}.` };
  },
  // 8
  (r) => {
    const from = 20 * r.int(1, 10), pct = r.pick([10, 20, 25, 50] as const), change = (from * pct) / 100;
    if (r.next() < 0.5) return { prompt: `A price rises from $${from} to $${from + change}. By what percent?`, answer: pct, hint: `It went up $${change}. That is ${change} out of ${from}.` };
    return { prompt: `A price drops from $${from} to $${from - change}. By what percent did it fall?`, answer: pct, hint: `It went down $${change}. That is ${change} out of ${from}.` };
  },
  // 9
  (r) => {
    const hundreds = r.int(1, 20), rate = r.int(2, 8), years = r.int(2, 5);
    return {
      prompt: `$${hundreds * 100} at ${rate}% simple interest a year, for ${years} years. Interest earned?`,
      answer: hundreds * rate * years,
      hint: `1% of $${hundreds * 100} is $${hundreds}. Times ${rate}%, times ${years} years.`,
    };
  },
  // 10
  (r) => {
    const hundreds = r.int(1, 10), rate = r.pick([10, 20, 50] as const);
    return {
      prompt: `$${hundreds * 100} grows ${rate}% a year, compounded. How much after 2 years?`,
      answer: (hundreds * (100 + rate) * (100 + rate)) / 100,
      hint: `Grow it twice: times ${(100 + rate) / 100} and times ${(100 + rate) / 100} again. The second year earns interest on the first.`,
    };
  },
];

export const MONEY_MAX_LEVEL = GENERATORS.length;

export const generateMoney = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
