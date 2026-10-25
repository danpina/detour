import es from "../../../../content/games/spanish.json";
import fr from "../../../../content/games/french.json";
import de from "../../../../content/games/german.json";
import { LEVEL_NAMES, type Level, type Word } from "./languageLogic";

export type LanguageId = "es" | "fr" | "de";

export type Language = {
  id: LanguageId;
  name: string;
  flag: string;
  /** Where this language's progress is kept. Spanish keeps its original key so earlier progress carries over. */
  storeKey: string;
  words: Word[];
  /** A few words of the language itself for the right answer and the end screen. */
  yes: string;
  perfect: string;
  great: string;
};

/** The bundled word lists (content/games/*.json). Rows with an unknown level are skipped. */
function wordsOf(raw: unknown): Word[] {
  return (raw as { words: Word[] }).words.filter((w) => w.level === 1 || w.level === 2 || w.level === 3);
}

export const LANGUAGES: Language[] = [
  { id: "es", name: "Spanish", flag: "🇪🇸", storeKey: "detour.games.spanish", words: wordsOf(es), yes: "¡Sí!", perfect: "¡Perfecto!", great: "¡Muy bien!" },
  { id: "fr", name: "French", flag: "🇫🇷", storeKey: "detour.games.french", words: wordsOf(fr), yes: "Oui !", perfect: "Parfait !", great: "Très bien !" },
  { id: "de", name: "German", flag: "🇩🇪", storeKey: "detour.games.german", words: wordsOf(de), yes: "Ja!", perfect: "Perfekt!", great: "Sehr gut!" },
];

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
