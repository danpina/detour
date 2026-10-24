import raw from "../../../../content/games/spanish.json";
import type { Word } from "./spanishLogic";

/** The bundled word list (content/games/spanish.json). Rows with an unknown level are skipped. */
export const WORDS: Word[] = (raw as { words: Word[] }).words.filter((w) => w.level === 1 || w.level === 2 || w.level === 3);
