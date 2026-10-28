/** Pure helpers for the Chess tactics game: FEN parsing, board orientation, move acceptance, round building. */

export type Puzzle = {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /** UCI of every legal move that checkmates (for a line: at its last move). */
  mates: string[];
  rating: number;
  /**
   * Mate in two or three: your move, the opponent's reply, your next move, and so on. Your last move mates, and any move in `mates`
   * counts. Left out, the puzzle is a mate in one.
   */
  line?: string[];
};

/** `puzzles` are the easy ones (mate in one); `hard` are mates in two or three from real games. */
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

// ---------- mates in two or three ----------

/** Board index (0 = a8) of a square name like "e4". */
export function squareIndex(name: string): number {
  return (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
}

/**
 * The board after one move in UCI ("e2e4", "e7e8q"). The moves come from a puzzle's solution, so they are not checked for legality;
 * castling, en passant and promotion are handled so the board stays right.
 */
export function applyUci(squares: (string | null)[], uci: string): (string | null)[] {
  const next = [...squares];
  const from = squareIndex(uci.slice(0, 2));
  const to = squareIndex(uci.slice(2, 4));
  const piece = next[from];
  if (!piece) return next;
  const white = piece === piece.toUpperCase();
  const lower = piece.toLowerCase();
  const sameRankStart = Math.floor(from / 8) * 8;
  if (lower === "p" && from % 8 !== to % 8 && next[to] === null) next[sameRankStart + (to % 8)] = null; // en passant
  if (lower === "k" && Math.abs((to % 8) - (from % 8)) === 2) {
    const kingside = to % 8 > from % 8;
    const rookFrom = sameRankStart + (kingside ? 7 : 0);
    const rookTo = sameRankStart + (kingside ? 5 : 3);
    next[rookTo] = next[rookFrom] ?? null;
    next[rookFrom] = null;
  }
  const promo = uci[4];
  next[to] = promo ? (white ? promo.toUpperCase() : promo.toLowerCase()) : piece;
  next[from] = null;
  return next;
}

/** The board after all of `moves` have been played from the starting squares. */
export function boardAfter(squares: (string | null)[], moves: readonly string[]): (string | null)[] {
  return moves.reduce(applyUci, squares);
}

/** How many moves you play to mate: 1 for a mate in one, 2 or 3 for a line. */
export function matePlies(puzzle: Puzzle): number {
  return puzzle.line ? Math.ceil(puzzle.line.length / 2) : 1;
}

/** Whether the move at `ply` (moves played so far, including replies) is your mating move. */
export function isFinalStep(puzzle: Puzzle, ply: number): boolean {
  return !puzzle.line || ply >= puzzle.line.length - 1;
}

/**
 * The move to play for a from/to tap at `ply`, or null if it is not the right one. The last move may be any mate; earlier moves must be
 * the puzzle's own, because only they lead where the line goes. A promotion that is not named defaults to a queen.
 */
export function acceptStep(puzzle: Puzzle, ply: number, from: string, to: string): string | null {
  if (isFinalStep(puzzle, ply)) return acceptMove(puzzle, from, to);
  const expected = puzzle.line?.[ply];
  return expected !== undefined && expected.slice(0, 4) === from + to ? expected : null;
}
