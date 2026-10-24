import type { Progress } from "./spanishLogic";

const KEY = "detour.games.spanish";

/** Spanish progress lives on this device only. Every read and write is wrapped so the game works with empty or blocked storage. */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { known: {}, missed: [] };
    const p = JSON.parse(raw) as Partial<Progress>;
    return { known: p.known ?? {}, missed: p.missed ?? [] };
  } catch {
    return { known: {}, missed: [] };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress lasts until the page is closed.
  }
}
