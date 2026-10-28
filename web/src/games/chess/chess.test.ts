import { describe, expect, it } from "vitest";
import { acceptMove, acceptStep, applyUci, boardAfter, buildRound, displayOrder, isFinalStep, matePlies, parseFen, puzzlesFor, squareIndex, squareName, type Puzzle } from "./chessLogic";
import { loadChessData } from "./chessData";

const SCHOLAR = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";

describe("parseFen", () => {
  it("parses placement and side", () => {
    const p = parseFen(SCHOLAR);
    expect(p).not.toBeNull();
    expect(p!.squares).toHaveLength(64);
    expect(p!.sideToMove).toBe("w");
    expect(p!.squares[0]).toBe("r"); // a8
    expect(p!.squares[63]).toBe("R"); // h1
  });
  it("rejects garbage", () => {
    expect(parseFen("nonsense")).toBeNull();
    expect(parseFen("8/8/8/8/8/8/8 w")).toBeNull();
    expect(parseFen("9/8/8/8/8/8/8/8 w")).toBeNull();
  });
  it("reads black to move", () => {
    expect(parseFen("4k3/8/8/8/8/8/8/4K3 b - - 0 1")!.sideToMove).toBe("b");
  });
});

describe("orientation", () => {
  it("puts the side to move at the bottom", () => {
    const w = displayOrder("w");
    const b = displayOrder("b");
    expect(squareName(w[0]!)).toBe("a8");
    expect(squareName(w[63]!)).toBe("h1");
    expect(squareName(b[0]!)).toBe("h1");
    expect(squareName(b[63]!)).toBe("a8");
  });
});

describe("acceptMove", () => {
  const puzzle: Puzzle = { id: "t", fen: SCHOLAR, sideToMove: "w", mates: ["h5f7", "a7a8q"], rating: 600 };
  it("accepts any mating move", () => {
    expect(acceptMove(puzzle, "h5", "f7")).toBe("h5f7");
  });
  it("defaults promotion to a queen", () => {
    expect(acceptMove(puzzle, "a7", "a8")).toBe("a7a8q");
  });
  it("rejects others", () => {
    expect(acceptMove(puzzle, "h5", "e5")).toBeNull();
  });
});

describe("buildRound", () => {
  const puzzles: Puzzle[] = Array.from({ length: 100 }, (_, i) => ({ id: String(i), fen: SCHOLAR, sideToMove: "w", mates: ["h5f7"], rating: 500 + i * 10 }));
  for (const size of [2, 5, 10]) {
    it(`returns ${size} puzzles, easy to hard`, () => {
      const round = buildRound(puzzles, Math.random, size);
      expect(round).toHaveLength(size);
      for (let i = 1; i < round.length; i++) expect(round[i]!.rating).toBeGreaterThanOrEqual(round[i - 1]!.rating);
    });
  }
  it("a 2 puzzle round is one easy, one a bit harder, and stays gentle", () => {
    const round = buildRound(puzzles, () => 0.99, 2);
    expect(round[0]!.rating).toBeLessThan(round[1]!.rating);
    expect(round[1]!.rating).toBeLessThanOrEqual(500 + 50 * 10);
    const easy = buildRound(puzzles, () => 0, 2);
    expect(easy[0]!.rating).toBe(500);
  });
  it("a 10 puzzle round reaches the hardest band", () => {
    const round = buildRound(puzzles, () => 0.99, 10);
    expect(round[9]!.rating).toBe(500 + 99 * 10);
  });
  it("returns what it has when there are fewer puzzles than the size", () => {
    expect(buildRound(puzzles.slice(0, 3), Math.random, 5)).toHaveLength(3);
  });
});

describe("chess.json", () => {
  const data = loadChessData();
  it("loads with a credit", () => {
    expect(data).not.toBeNull();
    expect(data!.credit.length).toBeGreaterThan(0);
    expect(data!.puzzles.length).toBeGreaterThanOrEqual(50);
  });
  it("every puzzle is sane", () => {
    const ids = new Set<string>();
    for (const p of data!.puzzles) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      const parsed = parseFen(p.fen);
      expect(parsed, p.id).not.toBeNull();
      expect(parsed!.sideToMove).toBe(p.sideToMove);
      expect(p.mates.length, p.id).toBeGreaterThan(0);
      for (const m of p.mates) {
        expect(m).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        const from = parsed!.squares[displayOrder("w").find((i) => squareName(i) === m.slice(0, 2))!];
        expect(from, `${p.id} ${m} has a piece on its from square`).not.toBeNull();
        const own = p.sideToMove === "w" ? from === from!.toUpperCase() : from === from!.toLowerCase();
        expect(own, `${p.id} ${m} moves own piece`).toBe(true);
      }
    }
  });
  it("is sorted easy to hard", () => {
    const r = data!.puzzles.map((p) => p.rating);
    expect([...r].sort((a, b) => a - b)).toEqual(r);
  });
});

describe("easy and hard", () => {
  const data = loadChessData()!;

  it("has a hard set of mates in two and three, clearly harder than the easy one", () => {
    expect(data.puzzles.length).toBeGreaterThanOrEqual(100);
    expect(data.hard!.length).toBeGreaterThanOrEqual(60);
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    expect(median(data.hard!.map((p) => p.rating))).toBeGreaterThan(median(data.puzzles.map((p) => p.rating)) + 400);
    expect(new Set(data.hard!.map((p) => p.id)).size).toBe(data.hard!.length);
    const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
    for (const p of data.hard!) {
      const parsed = parseFen(p.fen);
      expect(parsed, p.id).not.toBeNull();
      expect(p.mates.length, p.id).toBeGreaterThan(0);
      for (const m of p.mates) expect(uci.test(m), p.id + " " + m).toBe(true);
      // A line: your move, their reply, your move... ending on a mate of yours.
      expect(p.line, p.id).toBeDefined();
      expect([3, 5], p.id).toContain(p.line!.length);
      expect(p.mates, p.id).toContain(p.line![p.line!.length - 1]);
      // Replaying it, every move starts on a piece of the right colour.
      let squares = parsed!.squares;
      p.line!.forEach((m, i) => {
        expect(uci.test(m), p.id + " " + m).toBe(true);
        const piece = squares[squareIndex(m.slice(0, 2))];
        expect(piece, `${p.id} move ${i + 1}: ${m}`).toBeTruthy();
        const white = piece === piece!.toUpperCase();
        expect(white, `${p.id} move ${i + 1} colour`).toBe((i % 2 === 0) === (p.sideToMove === "w"));
        squares = applyUci(squares, m);
      });
    }
  });

  it("picks the set for the level, and falls back to easy when there is no hard set", () => {
    expect(puzzlesFor(data, "easy")).toBe(data.puzzles);
    expect(puzzlesFor(data, "hard")).toBe(data.hard);
    expect(puzzlesFor({ credit: "", puzzles: data.puzzles }, "hard")).toBe(data.puzzles);
  });
});

describe("playing a line", () => {
  it("applies ordinary moves, captures and promotions", () => {
    const start = parseFen("4k3/P7/8/8/8/8/8/R3K2R w KQ - 0 1")!.squares;
    const promoted = applyUci(start, "a7a8q");
    expect(promoted[squareIndex("a8")]).toBe("Q");
    expect(promoted[squareIndex("a7")]).toBeNull();
    const rookTakes = applyUci(parseFen("4k3/8/8/8/8/8/p7/R3K3 w - - 0 1")!.squares, "a1a2");
    expect(rookTakes[squareIndex("a2")]).toBe("R");
  });

  it("moves the rook when castling and removes the pawn en passant", () => {
    const board = parseFen("4k3/8/8/3pP3/8/8/8/R3K2R w KQ d6 0 1")!.squares;
    const kingside = applyUci(board, "e1g1");
    expect(kingside[squareIndex("g1")]).toBe("K");
    expect(kingside[squareIndex("f1")]).toBe("R");
    expect(kingside[squareIndex("h1")]).toBeNull();
    const queenside = applyUci(board, "e1c1");
    expect(queenside[squareIndex("d1")]).toBe("R");
    expect(queenside[squareIndex("a1")]).toBeNull();
    const enPassant = applyUci(board, "e5d6");
    expect(enPassant[squareIndex("d6")]).toBe("P");
    expect(enPassant[squareIndex("d5")]).toBeNull();
    expect(boardAfter(board, ["e1g1", "e8d8"])[squareIndex("d8")]).toBe("k");
  });

  const line: Puzzle = { id: "t", fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", sideToMove: "w", mates: ["a1a8"], rating: 1500, line: ["e1d1", "e8d7", "a1a8"] };

  it("counts the moves you play and knows the last one", () => {
    expect(matePlies(line)).toBe(2);
    expect(matePlies({ ...line, line: undefined })).toBe(1);
    expect(isFinalStep(line, 0)).toBe(false);
    expect(isFinalStep(line, 2)).toBe(true);
    expect(isFinalStep({ ...line, line: undefined }, 0)).toBe(true);
  });

  it("accepts only the line before the last move, and any mate on the last", () => {
    expect(acceptStep(line, 0, "e1", "d1")).toBe("e1d1");
    expect(acceptStep(line, 0, "a1", "a8")).toBeNull();
    expect(acceptStep(line, 2, "a1", "a8")).toBe("a1a8");
    expect(acceptStep(line, 2, "d1", "d2")).toBeNull();
    const promote: Puzzle = { ...line, line: ["h2h4", "a7a6", "g7g8q"], mates: ["g7g8q"] };
    expect(acceptStep(promote, 0, "h2", "h4")).toBe("h2h4");
    expect(acceptStep(promote, 2, "g7", "g8")).toBe("g7g8q");
  });
});
