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

/** How many puzzles a round takes from each level, easiest first. */
export const ROUND_PLAN: ReadonlyArray<{ level: 1 | 2 | 3; count: number }> = [
  { level: 1, count: 3 },
  { level: 2, count: 4 },
  { level: 3, count: 3 },
];

export const ROUND_SIZE = ROUND_PLAN.reduce((n, p) => n + p.count, 0);

function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A round: puzzles ramp from level 1 to 3; within a level the pick and order are random so rounds differ. */
export function buildRound(puzzles: readonly PatternPuzzle[] = ALL_PUZZLES, rng: () => number = Math.random): PatternPuzzle[] {
  const round: PatternPuzzle[] = [];
  for (const { level, count } of ROUND_PLAN) {
    round.push(...shuffled(puzzles.filter((p) => p.level === level), rng).slice(0, count));
  }
  return round;
}
