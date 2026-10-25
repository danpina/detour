import type { ComponentType } from "react";
import type { GameId } from "./ids";
import { ChessGame } from "./chess/ChessGame";
import { GeoGame } from "./geo/GeoGame";
import { LogicGame } from "./logic/LogicGame";
import { MemoryGame } from "./memory/MemoryGame";
import { PatternsGame } from "./patterns/PatternsGame";
import { LanguageGame } from "./language/LanguageGame";
import { LOGIC_ITEMS } from "./logic/logicData";
import { loadLogicProgress } from "./logic/progress";
import { getLanguage, getLevel, LEVEL_NAMES } from "./language/languageData";
import { LEARNED_AT } from "./language/languageLogic";
import { loadProgress as loadLanguageProgress } from "./language/progress";
import { WordsGame } from "./words/WordsGame";

/**
 * What every game receives. A game fills the whole screen and calls `onExit` to go back to the Games list.
 *
 * `embedded` is set when the game is played inside a set of cards: the game plays `getRoundSize()` puzzles, skips its own
 * end screen and calls `embedded.onDone(score)` when finished. `onExit` then means "skip this game".
 */
export type GameProps = { onExit: () => void; embedded?: { onDone: (score: number) => void } };

export type { GameId };

export type GameDef = {
  id: GameId;
  name: string;
  blurb: string;
  emoji: string;
  Component: ComponentType<GameProps>;
  /** Learning games build real skill over time and show how far you are; the rest are just for fun. */
  learn?: boolean;
  /** A short line about how far you are, or null before you start. */
  progress?: () => string | null;
};

function languageProgress(): string | null {
  const lang = getLanguage();
  const p = loadLanguageProgress(lang);
  const level = getLevel();
  const inLevel = lang.words.filter((w) => w.level === level);
  const learned = inLevel.filter((w) => (p.known[w.key] ?? 0) >= LEARNED_AT).length;
  return learned > 0 ? lang.name + " · " + LEVEL_NAMES[level] + ": " + learned + " of " + inLevel.length + " learned" : null;
}

function logicProgress(): string | null {
  const n = Object.values(loadLogicProgress().solved).filter((v) => v > 0).length;
  return n > 0 ? `${n} of ${LOGIC_ITEMS.length} puzzles solved` : null;
}

export const GAMES: GameDef[] = [
  { id: "chess", name: "Chess tactics", blurb: "Find the checkmate in one", emoji: "♟️", Component: ChessGame },
  { id: "patterns", name: "What comes next?", blurb: "Spot the pattern in a sequence", emoji: "🔢", Component: PatternsGame },
  { id: "words", name: "Word scramble", blurb: "Unscramble the word", emoji: "🔤", Component: WordsGame },
  { id: "geo", name: "Geography", blurb: "Flags, capitals and more", emoji: "🌍", Component: GeoGame, learn: true },
  { id: "memory", name: "Memory", blurb: "Remember digits and patterns", emoji: "🧠", Component: MemoryGame },
  { id: "languages", name: "Languages", blurb: "Spanish, French or German, words that stick", emoji: "🗣️", Component: LanguageGame, learn: true, progress: languageProgress },
  { id: "logic", name: "Logic", blurb: "Reason it out and spot the flaw", emoji: "🧩", Component: LogicGame, learn: true, progress: logicProgress },
];
