import type { Problem } from "./mentalMath";
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
];

export const NUMBER_THEORY_MAX_LEVEL = GENERATORS.length;

export const generateNumberTheory = (level: number, r: Rng): Problem => GENERATORS[Math.min(Math.max(level, 1), GENERATORS.length) - 1]!(r);
