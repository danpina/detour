import type { Problem } from "./mentalMath";
import { choose } from "./choice";
import type { Rng } from "./rng";

export const NUMBER_THEORY_LEVELS = [
  "Counting factors",
  "Smallest prime factor",
  "The next prime",
  "Greatest common divisor",
  "Least common multiple",
  "Remainders by 3 and 9: digit sums",
  "Binary to decimal",
  "Decimal to binary",
  "Hexadecimal to decimal",
  "Last digits of powers",
  "Prime or not?",
  "Prime factors added up",
  "Counting perfect squares",
  "Remainders of products",
  "Adding in binary",
  "Adding in hexadecimal",
  "Which is divisible by 9?",
  "Greatest common divisor of three",
  "Least common multiple of three",
  "Digital roots",
] as const;

type Gen = (r: Rng) => Problem;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};

const HEX = "0123456789ABCDEF";

const GENERATORS: Gen[] = [
  // 1
  (r) => {
    const n = r.int(6, 40);
    let count = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0) count++;
    return { prompt: `How many numbers divide ${n} exactly? (1 and ${n} count)`, answer: count, hint: `Go through the pairs that multiply to ${n}. Each pair gives two numbers.` };
  },
  // 2
  (r) => {
    const p = r.pick([2, 3, 5, 7] as const), q = r.pick([11, 13, 17, 19, 23] as const);
    return { prompt: `Smallest prime factor of ${p * q}`, answer: p, hint: `${p * q} = ${p} × ${q}, and ${p} is the smaller prime.` };
  },
  // 3
  (r) => {
    const n = r.int(10, 90);
    let next = n + 1;
    while (!isPrime(next)) next++;
    return { prompt: `The first prime after ${n}`, answer: next, hint: `Skip even numbers and multiples of 3, 5 and 7. ${next} has no divisor but 1 and itself.` };
  },
  // 4
  (r) => {
    const g = r.int(2, 12), x = r.int(2, 6), y = r.int(2, 6);
    const a = g * x, b = g * y;
    return { prompt: `Greatest common divisor of ${a} and ${b}`, answer: gcd(a, b), hint: `The biggest number that goes into both ${a} and ${b}.` };
  },
  // 5
  (r) => {
    const a = r.int(2, 12), b = r.int(2, 12);
    return { prompt: `Least common multiple of ${a} and ${b}`, answer: (a * b) / gcd(a, b), hint: `The first number both ${a} and ${b} divide into. ${a} × ${b} divided by their GCD, ${gcd(a, b)}.` };
  },
  // 6
  (r) => {
    const d = r.pick([3, 9] as const);
    const n = r.int(100, 9999);
    return { prompt: `Remainder of ${n} ÷ ${d}`, answer: n % d, hint: `Add up the digits of ${n}, then take the remainder of that by ${d}. It matches.` };
  },
  // 7
  (r) => {
    const bits = r.int(4, 6);
    let value = 1, text = "1";
    for (let i = 1; i < bits; i++) {
      const bit = r.int(0, 1);
      value = value * 2 + bit;
      text += String(bit);
    }
    return { prompt: `Binary ${text} in decimal`, answer: value, hint: `From the right the places are 1, 2, 4, 8, 16... Add the places that have a 1.` };
  },
  // 8
  (r) => {
    const n = r.int(5, 63);
    return { prompt: `${n} in binary`, answer: Number(n.toString(2)), hint: `Take away the biggest power of 2 you can (32, 16, 8, 4, 2, 1), write a 1 for it and a 0 when you skip.` };
  },
  // 9
  (r) => {
    const hi = r.int(1, 15), lo = r.int(0, 15);
    return { prompt: `Hexadecimal ${HEX[hi]}${HEX[lo]} in decimal`, answer: hi * 16 + lo, hint: `The first digit counts 16s: ${hi} × 16 = ${hi * 16}. Then add ${lo}. (A = 10 ... F = 15.)` };
  },
  // 10
  (r) => {
    const a = r.int(2, 9), b = r.int(2, 6);
    let power = 1;
    for (let i = 0; i < b; i++) power *= a;
    return { prompt: `Last digit of ${a}^${b}`, answer: power % 10, hint: `Only the last digit matters: multiply ${b} times, keeping just the last digit each time.` };
  },

  // 11
  (r) => {
    const prime = r.next() < 0.5;
    let n = r.int(20, 120);
    if (prime) while (!isPrime(n)) n++;
    else while (isPrime(n)) n++;
    return { prompt: `Is ${n} prime?`, choices: ["Prime", "Not prime"], answer: prime ? 0 : 1, hint: prime ? `Nothing but 1 and ${n} divides it.` : `It has a smaller factor besides 1.` };
  },
  // 12
  (r) => {
    const p = r.pick([2, 3, 5] as const), q = r.pick([2, 3, 5, 7] as const), s = r.pick([2, 3, 5, 7, 11] as const);
    return { prompt: `Write ${p * q * s} as a product of primes. What do those primes add up to?`, answer: p + q + s, hint: `${p * q * s} = ${p} × ${q} × ${s}, so ${p} + ${q} + ${s}.` };
  },
  // 13
  (r) => {
    const n = r.int(30, 200);
    let k = 0;
    while ((k + 1) * (k + 1) <= n) k++;
    return { prompt: `How many perfect squares are there from 1 up to ${n}?`, answer: k, hint: `1², 2², 3²... The last one that fits is ${k}² = ${k * k}.` };
  },
  // 14
  (r) => {
    const a = r.int(12, 49), b = r.int(12, 49), m = r.int(5, 9);
    return { prompt: `Remainder of ${a} × ${b} ÷ ${m}`, answer: (a * b) % m, hint: `Multiply the remainders instead: ${a % m} × ${b % m}, then take the remainder again.` };
  },
  // 15
  (r) => {
    const x = r.int(3, 15), y = r.int(3, 15);
    return { prompt: `Add in binary: ${x.toString(2)} + ${y.toString(2)}`, answer: Number((x + y).toString(2)), hint: `In decimal that is ${x} + ${y} = ${x + y}. Write ${x + y} in binary.` };
  },
  // 16
  (r) => {
    const x = r.int(16, 120), y = r.int(16, 120);
    return {
      prompt: `0x${x.toString(16).toUpperCase()} + 0x${y.toString(16).toUpperCase()}, as a decimal number`,
      answer: x + y,
      hint: `Change each to decimal: ${x} + ${y}.`,
    };
  },
  // 17
  (r) => {
    const n = 9 * r.int(12, 110);
    return {
      prompt: `Which of these is divisible by 9?`,
      ...choose(r, String(n), [String(n + 1), String(n + 2), String(n + 4)]),
      hint: `A number is divisible by 9 when its digits add up to a multiple of 9.`,
    };
  },
  // 18
  (r) => {
    const g = r.int(2, 9), a = g * r.int(2, 6), b = g * r.int(2, 6), c = g * r.int(2, 6);
    return { prompt: `Greatest common divisor of ${a}, ${b} and ${c}`, answer: gcd(gcd(a, b), c), hint: `The biggest number that goes into all three.` };
  },
  // 19
  (r) => {
    const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9);
    const lcm2 = (a * b) / gcd(a, b);
    return { prompt: `Least common multiple of ${a}, ${b} and ${c}`, answer: (lcm2 * c) / gcd(lcm2, c), hint: `The first number all three divide into.` };
  },
  // 20
  (r) => {
    const n = r.int(100, 99999);
    let root = n;
    while (root >= 10) {
      let sum = 0;
      for (const d of String(root)) sum += Number(d);
      root = sum;
    }
    return { prompt: `Add the digits of ${n}, then the digits of that, until one digit is left. Which digit?`, answer: root, hint: `The result is also the remainder when dividing by 9 (with 9 for a multiple of 9).` };
  },
];

export const NUMBER_THEORY_MAX_LEVEL = GENERATORS.length;

export const generateNumberTheory = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
