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
  "Sales tax",
  "The better deal",
  "Profit as a percent",
  "Break-even",
  "Monthly payments",
  "Exchanging currency",
  "The rule of 72",
  "Inflation",
  "Overtime pay",
  "Which loan costs less?",
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

  // 11
  (r) => {
    const price = 20 * r.int(2, 15), tax = r.pick([10, 20, 25] as const);
    return { prompt: `$${price} plus ${tax}% tax. The total?`, answer: price + (price * tax) / 100, hint: `${tax}% of ${price} is ${(price * tax) / 100}. Add it on.` };
  },
  // 12
  (r) => {
    const aCheaper = r.next() < 0.5;
    const nA = r.pick([4, 6, 8, 10] as const), nB = r.pick([3, 5, 6, 12] as const);
    const base = r.int(2, 8), diff = r.int(1, 2);
    const uA = aCheaper ? base : base + diff, uB = aCheaper ? base + diff : base;
    return {
      prompt: `Pack A: ${nA} for $${nA * uA}. Pack B: ${nB} for $${nB * uB}. Which is cheaper per item?`,
      choices: ["Pack A", "Pack B"],
      answer: aCheaper ? 0 : 1,
      hint: `A costs $${uA} each and B costs $${uB} each.`,
    };
  },
  // 13
  (r) => {
    const cost = 20 * r.int(2, 10), pct = r.pick([10, 20, 25, 50] as const);
    return { prompt: `Bought for $${cost}, sold for $${cost + (cost * pct) / 100}. The profit as a percent of the cost?`, answer: pct, hint: `The profit is $${(cost * pct) / 100}. That is ${(cost * pct) / 100} out of ${cost}.` };
  },
  // 14
  (r) => {
    const price = r.int(8, 20), unitCost = r.int(2, price - 3), units = r.int(5, 40);
    return {
      prompt: `A stall costs $${(price - unitCost) * units} to set up. Each item sells for $${price} and costs $${unitCost} to make. How many must it sell to break even?`,
      answer: units,
      hint: `Each sale earns $${price - unitCost}. Divide the set-up cost by that.`,
    };
  },
  // 15
  (r) => {
    const months = r.pick([6, 12, 18, 24] as const), pay = r.int(15, 90);
    return { prompt: `A $${months * pay} purchase is paid in ${months} equal monthly payments. Each payment, in dollars?`, answer: pay, hint: `${months * pay} ÷ ${months}.` };
  },
  // 16
  (r) => {
    const rate = r.pick([2, 3, 4, 5, 8, 10] as const), amount = r.int(5, 40);
    return { prompt: `$1 buys ${rate} kroner. How many kroner for $${amount}?`, answer: rate * amount, hint: `${amount} × ${rate}.` };
  },
  // 17
  (r) => {
    const rate = r.pick([2, 3, 4, 6, 8, 9, 12] as const);
    return { prompt: `Money grows ${rate}% a year. By the rule of 72, about how many years to double?`, answer: 72 / rate, hint: `Divide 72 by the rate: 72 ÷ ${rate}.` };
  },
  // 18
  (r) => {
    const price = 20 * r.int(2, 20), pct = r.pick([5, 10, 15, 20] as const);
    return { prompt: `Prices rise ${pct}% in a year. Something that costs $${price} now costs how much next year?`, answer: price + (price * pct) / 100, hint: `${pct}% of ${price} is ${(price * pct) / 100}. Add it on.` };
  },
  // 19
  (r) => {
    const wage = 2 * r.int(5, 15), extra = 2 * r.int(1, 5);
    return {
      prompt: `You earn $${wage} an hour for 40 hours, then 1.5 times that for ${extra} more hours. The week's pay, in dollars?`,
      answer: 40 * wage + (extra * wage * 3) / 2,
      hint: `The 40 hours pay ${40 * wage}. Overtime is $${(wage * 3) / 2} an hour for ${extra} hours.`,
    };
  },
  // 20
  (r) => {
    const h = r.int(2, 10), rA = r.int(2, 8), tA = r.int(2, 5), rB = r.int(2, 8), tB = r.int(2, 5);
    const tBx = rA * tA === rB * tB ? tB + 1 : tB;
    const iA = rA * tA, iB = rB * tBx;
    return {
      prompt: `$${h * 100} borrowed. Loan A: ${rA}% simple interest for ${tA} years. Loan B: ${rB}% for ${tBx} years. Which costs less?`,
      choices: ["Loan A", "Loan B"],
      answer: iA < iB ? 0 : 1,
      hint: `Simple interest is the rate times the years: A is ${iA}% of the loan, B is ${iB}%.`,
    };
  },
];

export const MONEY_MAX_LEVEL = GENERATORS.length;

export const generateMoney = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
