import type { GameId } from "./registry";

/**
 * Tiny local scoreboard for the games: best score and number of rounds played, per game, on this device only.
 * Every read and write is wrapped, so the games work when storage is empty or blocked.
 */
const KEY = "detour.games";

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
