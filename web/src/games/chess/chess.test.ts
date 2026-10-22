import { describe, expect, it } from "vitest";
import { acceptMove, buildRound, displayOrder, parseFen, squareName, type Puzzle } from "./chessLogic";
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
