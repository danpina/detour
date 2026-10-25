import type { Language } from "./languageData";
import type { Progress } from "./languageLogic";

/** Language progress lives on this device only, one record per language. Every read and write is wrapped so the game works with empty or blocked storage. */
export function loadProgress(language: Pick<Language, "storeKey">): Progress {
  try {
    const raw = localStorage.getItem(language.storeKey);
    if (!raw) return { known: {}, missed: [] };
    const p = JSON.parse(raw) as Partial<Progress>;
    return { known: p.known ?? {}, missed: p.missed ?? [] };
  } catch {
    return { known: {}, missed: [] };
  }
}

export function saveProgress(language: Pick<Language, "storeKey">, p: Progress): void {
  try {
    localStorage.setItem(language.storeKey, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress lasts until the page is closed.
  }
}
