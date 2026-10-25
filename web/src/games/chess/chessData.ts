import type { ChessData, ChessLevel } from "./chessLogic";

// Bundled at build time. A glob (instead of a plain import) keeps the app working if the file is ever absent.
const modules = import.meta.glob("../../../../content/games/chess.json", { eager: true, import: "default" });

export function loadChessData(): ChessData | null {
  try {
    const raw = Object.values(modules)[0] as ChessData | undefined;
    if (!raw || !Array.isArray(raw.puzzles) || raw.puzzles.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

const LEVEL_KEY = "detour.games.chess.level";

/** Easy until the player picks hard on the Games screen. */
export function getChessLevel(): ChessLevel {
  try {
    return localStorage.getItem(LEVEL_KEY) === "hard" ? "hard" : "easy";
  } catch {
    return "easy";
  }
}

export function setChessLevel(level: ChessLevel): void {
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}
