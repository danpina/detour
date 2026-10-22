import { getRoundSize } from "../stats";
import data from "../../../../content/games/patterns.json";

export type PatternPuzzle = {
  id: string;
  level: 1 | 2 | 3;
  family: string;
  params: Record<string, number>;
  shown: number[];
  answer: number;
  options: number[];
  rule: string;
};

export const ALL_PUZZLES = (data as unknown as { puzzles: PatternPuzzle[] }).puzzles;

type Plan = ReadonlyArray<{ level: 1 | 2 | 3; count: number }>;

/** How many puzzles a round of `size` takes from each level, easiest first (2: easy, medium; 5: 1/2/2; 10: 3/4/3). */
export function roundPlan(size: number): Plan {
  if (size <= 2) return [{ level: 1, count: 1 }, { level: 2, count: 1 }];
  if (size <= 5) return [{ level: 1, count: 1 }, { level: 2, count: 2 }, { level: 3, count: 2 }];
  return [{ level: 1, count: 3 }, { level: 2, count: 4 }, { level: 3, count: 3 }];
}

function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A round: puzzles ramp from level 1 to 3; within a level the pick and order are random so rounds differ. */
export function buildRound(puzzles: readonly PatternPuzzle[] = ALL_PUZZLES, rng: () => number = Math.random, size: number = getRoundSize()): PatternPuzzle[] {
  const round: PatternPuzzle[] = [];
  for (const { level, count } of roundPlan(size)) {
    round.push(...shuffled(puzzles.filter((p) => p.level === level), rng).slice(0, count));
  }
  return round;
}
