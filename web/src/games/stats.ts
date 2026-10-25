import type { GameId } from "./registry";

/**
 * Tiny local scoreboard for the games: best round and number of rounds played, per game, on this device only.
 * A best is kept together with the length of the round it came from ("4/5"), so rounds of different lengths never get
 * mixed up. Every read and write is wrapped, so the games work when storage is empty or blocked.
 */
const KEY = "detour.games";
const ROUND_KEY = "detour.games.roundSize";

/** How many puzzles a round has: 1 to 20, short by default; changed on the Games screen. */
export const MIN_ROUND_SIZE = 1;
export const MAX_ROUND_SIZE = 20;
export const DEFAULT_ROUND_SIZE = 2;

export function getRoundSize(): number {
  try {
    const n = Number(localStorage.getItem(ROUND_KEY));
    return Number.isInteger(n) && n >= MIN_ROUND_SIZE && n <= MAX_ROUND_SIZE ? n : DEFAULT_ROUND_SIZE;
  } catch {
    return DEFAULT_ROUND_SIZE;
  }
}

export function setRoundSize(n: number): void {
  try {
    localStorage.setItem(ROUND_KEY, String(Math.min(MAX_ROUND_SIZE, Math.max(MIN_ROUND_SIZE, Math.round(n)))));
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

/** `of` is the round length the best came from, or 0 for a game scored as a run ("7 in a row"). Missing in older saves. */
type Entry = { best: number; plays: number; of?: number };
type Stats = Partial<Record<GameId, Entry>>;

function read(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stats) : {};
  } catch {
    return {};
  }
}

export function getStats(id: GameId): Entry {
  return read()[id] ?? { best: 0, plays: 0 };
}

/** Whether a round of `score` out of `of` beats the saved best. Runs (of = 0) compare plain scores. */
export function beats(score: number, of: number, current: Entry): boolean {
  if (current.of === undefined) return true;
  if (of === 0 || current.of === 0) return score > current.best;
  const mine = score * current.of;
  const theirs = current.best * of;
  return mine > theirs || (mine === theirs && of > current.of);
}

/** Records a finished round of `score` out of `of` puzzles (0 for a run). Returns whether it is a new best. */
export function recordRound(id: GameId, score: number, of: number = getRoundSize()): boolean {
  const all = read();
  const current = all[id] ?? { best: 0, plays: 0 };
  const isBest = score > 0 && beats(score, of, current);
  all[id] = isBest ? { best: score, of, plays: current.plays + 1 } : { ...current, plays: current.plays + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the round still counted for this session, just not saved.
  }
  return isBest;
}

/** "4/5", "7 in a row", or null when there is no best yet. */
export function bestLabel(id: GameId): string | null {
  const s = getStats(id);
  if (s.of === undefined || s.best <= 0) return null;
  return s.of === 0 ? `${s.best} in a row` : `${s.best}/${s.of}`;
}
