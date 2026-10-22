import type { GameId } from "./registry";

/**
 * Tiny local scoreboard for the games: best score and number of rounds played, per game, on this device only.
 * Every read and write is wrapped, so the games work when storage is empty or blocked.
 */
const KEY = "detour.games";
const ROUND_KEY = "detour.games.roundSize";

/** How many puzzles a round has. Short by default; changed on the Games screen. */
export const ROUND_SIZES = [2, 5, 10] as const;
export const DEFAULT_ROUND_SIZE = 2;

export function getRoundSize(): number {
  try {
    const n = Number(localStorage.getItem(ROUND_KEY));
    return (ROUND_SIZES as readonly number[]).includes(n) ? n : DEFAULT_ROUND_SIZE;
  } catch {
    return DEFAULT_ROUND_SIZE;
  }
}

export function setRoundSize(n: number): void {
  try {
    localStorage.setItem(ROUND_KEY, String(n));
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

type Stats = Partial<Record<GameId, { best: number; plays: number }>>;

function read(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stats) : {};
  } catch {
    return {};
  }
}

export function getStats(id: GameId): { best: number; plays: number } {
  return read()[id] ?? { best: 0, plays: 0 };
}

/** Records a finished round. Returns whether it is a new best. */
export function recordRound(id: GameId, score: number): boolean {
  const all = read();
  const current = all[id] ?? { best: 0, plays: 0 };
  const isBest = score > current.best;
  all[id] = { best: Math.max(current.best, score), plays: current.plays + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the round still counted for this session, just not saved.
  }
  return isBest;
}
