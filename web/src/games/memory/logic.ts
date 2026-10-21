/** Pure logic for the Memory game: no timers, no UI. */

export type Rng = () => number;

export const START_LENGTH = 3;
export const MAX_MISSES = 2;
export const GRID_TILES = 9;

function pick(count: number, rng: Rng): number {
  const n = Math.floor(rng() * count);
  return Math.min(count - 1, Math.max(0, n));
}

/** Random digits 0-9. */
export function generateDigits(length: number, rng: Rng = Math.random): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push(pick(10, rng));
  return out;
}

/** Random tile indexes; the same tile never lights twice in a row. */
export function generateTiles(length: number, tileCount: number = GRID_TILES, rng: Rng = Math.random): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    let next = pick(tileCount, rng);
    if (tileCount > 1 && i > 0 && next === out[i - 1]) next = (next + 1 + pick(tileCount - 1, rng)) % tileCount;
    out.push(next);
  }
  return out;
}

export function checkAnswer(expected: number[], given: number[]): boolean {
  return expected.length === given.length && expected.every((v, i) => v === given[i]);
}

/** True while the player's input so far is still a prefix of the answer. */
export function isPrefix(expected: number[], given: number[]): boolean {
  return given.length <= expected.length && given.every((v, i) => v === expected[i]);
}

export type Run = {
  /** Length of the next sequence to show. */
  length: number;
  /** Misses in a row. */
  misses: number;
  /** Longest sequence recalled so far (the score). */
  best: number;
  /** Rounds played, for the counter. */
  round: number;
  over: boolean;
};

export function newRun(): Run {
  return { length: START_LENGTH, misses: 0, best: 0, round: 1, over: false };
}

/** Applies the result of one round. A success grows the sequence; two misses in a row end the run. */
export function applyResult(run: Run, success: boolean): Run {
  if (success) {
    return { length: run.length + 1, misses: 0, best: Math.max(run.best, run.length), round: run.round + 1, over: false };
  }
  const misses = run.misses + 1;
  return { ...run, misses, round: run.round + 1, over: misses >= MAX_MISSES };
}
