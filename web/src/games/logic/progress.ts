import type { LogicProgress } from "./logicLogic";

const KEY = "detour.games.logic";

/** Logic progress lives on this device only. Every read and write is wrapped so the game works with empty or blocked storage. */
export function loadLogicProgress(): LogicProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { solved: {}, missed: [] };
    const p = JSON.parse(raw) as Partial<LogicProgress>;
    return { solved: p.solved ?? {}, missed: p.missed ?? [] };
  } catch {
    return { solved: {}, missed: [] };
  }
}

export function saveLogicProgress(p: LogicProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress lasts until the page is closed.
  }
}
