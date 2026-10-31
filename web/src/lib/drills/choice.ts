import type { Rng } from "./rng";

/**
 * A multiple-choice problem: the player taps one option, and the answer is the index of the right one.
 * The right option goes in a random place among the wrong ones (one random number is drawn for that).
 */
export function choose(r: Rng, correct: string, wrong: readonly string[]): { choices: string[]; answer: number } {
  const at = r.int(0, wrong.length);
  return { choices: [...wrong.slice(0, at), correct, ...wrong.slice(at)], answer: at };
}

/** A true-or-false problem. No random number is drawn. */
export function trueFalse(isTrue: boolean): { choices: string[]; answer: number } {
  return { choices: ["True", "False"], answer: isTrue ? 0 : 1 };
}
