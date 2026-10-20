import type { Rng } from "./rng";
import type { Problem } from "./mentalMath";
import { ESTIMATION_LEVELS, ESTIMATION_TEMPLATES, type EstimationTemplate } from "./estimationTemplates";

export { ESTIMATION_LEVELS };

/**
 * Fermi-style estimation. Every question states its premises, so the exact answer is computed from them;
 * nothing relies on outside facts. The learner is scored by log distance (how many times too big or small).
 *
 * The questions are templates (content/estimation-templates.json, about a dozen per level), each a product of the
 * numbers it states. A template is chosen first, then its numbers, always in the same order, so the iOS port makes
 * identical rounds from the same seed.
 */
const BY_LEVEL: EstimationTemplate[][] = ESTIMATION_LEVELS.map((_, i) => ESTIMATION_TEMPLATES.filter((t) => t.level === i + 1));

export const ESTIMATION_MAX_LEVEL = ESTIMATION_LEVELS.length;

export const generateEstimation = (level: number, r: Rng): Problem => {
  const list = BY_LEVEL[Math.min(Math.max(level, 1), ESTIMATION_MAX_LEVEL) - 1]!;
  const t = list[r.int(0, list.length - 1)]!;
  const values: Record<string, number> = {};
  for (const p of t.params) values[p.n] = p.pick ? r.pick(p.pick) : r.int(p.lo!, p.hi!);
  const terms = t.mult.map((m) => (typeof m === "string" ? values[m]! : m));
  const answer = terms.reduce((a, b) => a * b, 1);
  const prompt = t.text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
  return { prompt, answer, hint: `${terms.join(" × ")}.` };
};

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
