import counts from "../../../../content/games/language-counts.json";
import { LEVEL_NAMES, type Level, type Word } from "./languageLogic";

export type LanguageId = "es" | "fr" | "de";

export type Language = {
  id: LanguageId;
  name: string;
  flag: string;
  /** Where this language's progress is kept. Spanish keeps its original key so earlier progress carries over. */
  storeKey: string;
  /** A few words of the language itself for the right answer and the end screen. */
  yes: string;
  perfect: string;
  great: string;
  /** Loads the word list (content/games/*.json) only when it is needed, so the lists stay out of the first download. */
  load: () => Promise<Word[]>;
};

/** Rows with an unknown level are skipped. */
function wordsOf(raw: unknown): Word[] {
  return (raw as { words: Word[] }).words.filter((w) => w.level === 1 || w.level === 2 || w.level === 3);
}

export const LANGUAGES: Language[] = [
  { id: "es", name: "Spanish", flag: "🇪🇸", storeKey: "detour.games.spanish", yes: "¡Sí!", perfect: "¡Perfecto!", great: "¡Muy bien!", load: () => import("../../../../content/games/spanish.json").then((m) => wordsOf(m.default)) },
  { id: "fr", name: "French", flag: "🇫🇷", storeKey: "detour.games.french", yes: "Oui !", perfect: "Parfait !", great: "Très bien !", load: () => import("../../../../content/games/french.json").then((m) => wordsOf(m.default)) },
  { id: "de", name: "German", flag: "🇩🇪", storeKey: "detour.games.german", yes: "Ja!", perfect: "Perfekt!", great: "Sehr gut!", load: () => import("../../../../content/games/german.json").then((m) => wordsOf(m.default)) },
];

/** How many words a language has at a level, without loading the list. */
export function wordCount(lang: Language, level: Level): number {
  const perLevel = (counts as Record<string, Record<string, number>>)[lang.id];
  return perLevel?.[String(level)] ?? 0;
}

const LANGUAGE_KEY = "detour.games.language";

export function languageById(id: string | null | undefined): Language {
  return LANGUAGES.find((l) => l.id === id) ?? (LANGUAGES[0] as Language);
}

/** The language being practised. Spanish until another is chosen. */
export function getLanguage(): Language {
  try {
    return languageById(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return languageById(null);
  }
}

export function setLanguage(id: LanguageId): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, id);
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

const LEVEL_KEY = "detour.games.language.level";

/** The level being practised in every language: Beginner until another is chosen. */
export function getLevel(): Level {
  try {
    const n = Number(localStorage.getItem(LEVEL_KEY));
    return n === 2 || n === 3 ? n : 1;
  } catch {
    return 1;
  }
}

export function setLevel(level: Level): void {
  try {
    localStorage.setItem(LEVEL_KEY, String(level));
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

export { LEVEL_NAMES };
