import type { ComponentType } from "react";
import { ChessGame } from "./chess/ChessGame";
import { GeoGame } from "./geo/GeoGame";
import { MemoryGame } from "./memory/MemoryGame";
import { PatternsGame } from "./patterns/PatternsGame";
import { WordsGame } from "./words/WordsGame";

/** What every game receives. A game fills the whole screen and calls `onExit` to go back to the Games list. */
export type GameProps = { onExit: () => void };

export type GameId = "chess" | "patterns" | "words" | "geo" | "memory";

export type GameDef = {
  id: GameId;
  name: string;
  blurb: string;
  emoji: string;
  Component: ComponentType<GameProps>;
};

export const GAMES: GameDef[] = [
  { id: "chess", name: "Chess tactics", blurb: "Find the checkmate in one", emoji: "♟️", Component: ChessGame },
  { id: "patterns", name: "What comes next?", blurb: "Spot the pattern in a sequence", emoji: "🔢", Component: PatternsGame },
  { id: "words", name: "Word scramble", blurb: "Unscramble the word", emoji: "🔤", Component: WordsGame },
  { id: "geo", name: "Geography", blurb: "Flags, capitals and more", emoji: "🌍", Component: GeoGame },
  { id: "memory", name: "Memory", blurb: "Remember digits and patterns", emoji: "🧠", Component: MemoryGame },
];
