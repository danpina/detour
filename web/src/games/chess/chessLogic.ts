/** Pure helpers for the Chess tactics game: FEN parsing, board orientation, move acceptance, round building. */

export type Puzzle = {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /** UCI of every legal move that checkmates. */
  mates: string[];
  rating: number;
};

/** `puzzles` are the easy ones; `hard` is a separate set of busier boards with a single, quiet mating move. */
export type ChessData = { credit: string; puzzles: Puzzle[]; hard?: Puzzle[] };

export type ChessLevel = "easy" | "hard";

/** The puzzles for a level. Falls back to the easy set when there is no hard one. */
export function puzzlesFor(data: ChessData, level: ChessLevel): Puzzle[] {
  return level === "hard" && data.hard && data.hard.length > 0 ? data.hard : data.puzzles;
}

export type ParsedFen = {
  /** 64 entries, index 0 = a8, 7 = h8, 8 = a7 ... 63 = h1. A letter for a piece (uppercase = white), or null. */
  squares: (string | null)[];
  sideToMove: "w" | "b";
};

const FILES = "abcdefgh";

/** Parses the first two fields of a FEN. Returns null when the placement is not 8x8. */
export function parseFen(fen: string): ParsedFen | null {
  const parts = fen.trim().split(/\s+/);
  const rows = (parts[0] ?? "").split("/");
  if (rows.length !== 8) return null;
  const squares: (string | null)[] = [];
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const n = Number(ch);
        for (let i = 0; i < n; i++) squares.push(null);
        count += n;
      } else if ("pnbrqkPNBRQK".includes(ch)) {
        squares.push(ch);
        count += 1;
      } else {
        return null;
      }
    }
    if (count !== 8) return null;
  }
  const side = parts[1] === "b" ? "b" : "w";
  return { squares, sideToMove: side };
}

/** Square name for a board index (0 = a8). */
export function squareName(index: number): string {
  const file = index % 8;
  const rank = 8 - Math.floor(index / 8);
  return FILES[file] + String(rank);
}

/** Board indexes in the order they are drawn, row by row. The side to move is at the bottom. */
export function displayOrder(side: "w" | "b"): number[] {
  const order: number[] = [];
  for (let i = 0; i < 64; i++) order.push(side === "w" ? i : 63 - i);
  return order;
}

const GLYPHS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎",
};

export function glyph(piece: string): string {
  return GLYPHS[piece] ?? "";
}

/**
 * Returns the matching mating move (UCI) for a from/to tap, or null if it does not mate.
 * A pawn move that reaches the last rank defaults to a queen.
 */
export function acceptMove(puzzle: Puzzle, from: string, to: string): string | null {
  const base = from + to;
  if (puzzle.mates.includes(base)) return base;
  if (puzzle.mates.includes(base + "q")) return base + "q";
  return null;
}

export function isOwnPiece(piece: string | null, side: "w" | "b"): boolean {
  if (!piece) return false;
  return side === "w" ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
}

/** Share of the (easy to hard) puzzle list a round of this size may reach: short rounds stay gentle. */
export function rampShare(count: number): number {
  if (count <= 2) return 0.5;
  if (count <= 5) return 0.75;
  return 1;
}

/** Round of `count` puzzles, easy to hard: one random pick from each difficulty band. */
export function buildRound(puzzles: Puzzle[], rand: () => number = Math.random, count = 10): Puzzle[] {
  const all = [...puzzles].sort((a, b) => a.rating - b.rating);
  if (all.length <= count) return all;
  const usable = Math.max(count, Math.ceil(all.length * rampShare(count)));
  const sorted = all.slice(0, usable);
  const round: Puzzle[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * sorted.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sorted.length) / count));
    const pick = sorted[Math.min(end - 1, start + Math.floor(rand() * (end - start)))];
    if (pick) round.push(pick);
  }
  return round;
}

export function moveSquares(uci: string): { from: string; to: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}
