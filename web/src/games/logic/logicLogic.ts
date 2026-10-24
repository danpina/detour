/** Pure logic for the Logic game: which puzzle comes next. No React, no storage. */

export type LogicKind = "syllogism" | "fallacy" | "order" | "puzzle";

export type LogicItem = {
  id: string;
  kind: LogicKind;
  level: 1 | 2 | 3;
  prompt: string;
  options: string[];
  answer: string;
  why: string;
};

export type Rng = () => number;

/** Puzzles solved (by id) and the ones missed last time. */
export type LogicProgress = { solved: Record<string, number>; missed: string[] };

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

export const KIND_TITLE: Record<LogicKind, string> = {
  syllogism: "Does the conclusion follow?",
  fallacy: "Spot the flaw",
  order: "Work it out",
  puzzle: "Think it through",
};

/** Level 2 opens after 8 puzzles solved, level 3 after 20. */
export function unlockedLevel(progress: LogicProgress): 1 | 2 | 3 {
  const n = Object.values(progress.solved).filter((v) => v > 0).length;
  if (n >= 20) return 3;
  if (n >= 8) return 2;
  return 1;
}

/**
 * A round: puzzles missed last time come back first (up to half), then ones not yet solved within your level (mixing kinds),
 * then a refresher of solved ones.
 */
export function buildRound(all: readonly LogicItem[], progress: LogicProgress, rng: Rng, length: number): LogicItem[] {
  const level = unlockedLevel(progress);
  const byId = new Map(all.map((i) => [i.id, i] as const));
  const chosen: LogicItem[] = [];
  const used = new Set<string>();
  const kindsUsed: string[] = [];
  const add = (i: LogicItem | undefined, wantNewKind = false) => {
    if (!i || used.has(i.id) || chosen.length >= length) return;
    if (wantNewKind && kindsUsed.length > 0 && kindsUsed[kindsUsed.length - 1] === i.kind) return;
    used.add(i.id);
    kindsUsed.push(i.kind);
    chosen.push(i);
  };
  const missed = shuffle(progress.missed.map((id) => byId.get(id)).filter((i): i is LogicItem => !!i), rng);
  missed.slice(0, Math.ceil(length / 2)).forEach((i) => add(i));
  const fresh = shuffle(all.filter((i) => i.level <= level && !(progress.solved[i.id] ?? 0)), rng);
  fresh.forEach((i) => add(i, true));
  fresh.forEach((i) => add(i));
  shuffle(all.filter((i) => i.level <= level), rng).forEach((i) => add(i));
  return chosen.map((i) => ({ ...i, options: shuffle(i.options, rng) }));
}

export function applyAnswer(progress: LogicProgress, id: string, right: boolean): LogicProgress {
  const solved = { ...progress.solved };
  const missed = progress.missed.filter((m) => m !== id);
  if (right) solved[id] = (solved[id] ?? 0) + 1;
  else {
    solved[id] = 0;
    missed.push(id);
  }
  return { solved, missed: missed.slice(-20) };
}
