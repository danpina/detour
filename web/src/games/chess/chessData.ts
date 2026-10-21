import type { ChessData } from "./chessLogic";

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
