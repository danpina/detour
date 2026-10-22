import { describe, expect, it } from "vitest";
import {
  buildRound,
  isCorrect,
  lettersOf,
  levelsForSize,
  loadPuzzles,
  placeTile,
  removeSlot,
  wordPoints,
} from "./logic";

const sorted = (s: string) => s.split("").sort().join("");

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

describe("words.json", () => {
  const puzzles = loadPuzzles();

  it("has plenty of puzzles at every level", () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(150);
    for (const level of [1, 2, 3]) expect(puzzles.filter((p) => p.level === level).length).toBeGreaterThanOrEqual(30);
  });

  it("scrambles use exactly the answer's letters and differ from every accepted word", () => {
    for (const p of puzzles) {
      expect(sorted(p.scramble), p.id).toBe(sorted(p.answer));
      expect(p.accept, p.id).toContain(p.answer);
      expect(p.accept.includes(p.scramble), p.id).toBe(false);
      expect(p.scramble).toMatch(/^[A-Z]+$/);
      expect(p.clue.length).toBeGreaterThan(0);
      expect(p.clue.toUpperCase().includes(p.answer), p.id).toBe(false);
    }
  });

  it("levels follow word length", () => {
    for (const p of puzzles) {
      const expected = p.answer.length <= 5 ? 1 : p.answer.length === 6 ? 2 : 3;
      expect(p.level, p.id).toBe(expected);
    }
  });

  it("accept lists are symmetric and complete", () => {
    const byAnswer = new Map(puzzles.map((p) => [p.answer, p]));
    for (const p of puzzles) {
      for (const w of p.accept) {
        const other = byAnswer.get(w);
        expect(other, `${p.id} accepts ${w} which is not a puzzle`).toBeDefined();
        expect(sorted(w)).toBe(sorted(p.answer));
        expect(other!.accept, `${w} should accept ${p.answer}`).toContain(p.answer);
      }
      const family = puzzles.filter((q) => sorted(q.answer) === sorted(p.answer)).map((q) => q.answer);
      expect([...p.accept].sort()).toEqual([...family].sort());
    }
  });
});

describe("buildRound", () => {
  const puzzles = loadPuzzles();

  it("level ramps scale with the round size", () => {
    expect(levelsForSize(2)).toEqual([1, 2]);
    expect(levelsForSize(5)).toEqual([1, 2, 2, 3, 3]);
    expect(levelsForSize(10)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
  });

  it.each([2, 5, 10])("returns %i words ramping up with no repeats", (size) => {
    for (let seed = 1; seed <= 20; seed++) {
      const round = buildRound(puzzles, seeded(seed), size);
      expect(round.length).toBe(size);
      expect(round.map((p) => p.level)).toEqual(levelsForSize(size));
      expect(new Set(round.map((p) => p.id)).size).toBe(size);
      const words = round.flatMap((p) => p.accept);
      expect(new Set(words).size, "no two words from one anagram family").toBe(words.length);
    }
  });

  it("copes with a tiny list", () => {
    expect(buildRound([], seeded(1), 5)).toEqual([]);
    expect(buildRound(puzzles.slice(0, 3), seeded(1), 10).length).toBeLessThanOrEqual(3);
  });
});

describe("tile placement", () => {
  it("fills slots in order and ignores repeats and overflow", () => {
    let placed: number[] = [];
    placed = placeTile(placed, 2, 3);
    placed = placeTile(placed, 2, 3);
    placed = placeTile(placed, 0, 3);
    placed = placeTile(placed, 1, 3);
    placed = placeTile(placed, 3, 3);
    expect(placed).toEqual([2, 0, 1]);
    expect(lettersOf("ABC", placed)).toBe("CAB");
  });

  it("taking a letter back shifts the rest left", () => {
    expect(removeSlot([2, 0, 1], 0)).toEqual([0, 1]);
    expect(removeSlot([2, 0, 1], 2)).toEqual([2, 0]);
  });
});

describe("answers and points", () => {
  const listen = { id: "x", scramble: "TENLIS", answer: "LISTEN", accept: ["LISTEN", "SILENT"], clue: "c", level: 2 } as const;
  it("accepts any anagram in the list", () => {
    expect(isCorrect({ ...listen, accept: [...listen.accept] }, "silent")).toBe(true);
    expect(isCorrect({ ...listen, accept: [...listen.accept] }, "TINSEL")).toBe(false);
  });
  it("scores 1 only for an unaided solve", () => {
    expect(wordPoints(true, false)).toBe(1);
    expect(wordPoints(true, true)).toBe(0);
    expect(wordPoints(false, false)).toBe(0);
  });
});
