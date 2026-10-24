import { describe, expect, it } from "vitest";
import { LOGIC_ITEMS } from "./logicData";
import { applyAnswer, buildRound, unlockedLevel, type LogicProgress } from "./logicLogic";

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const empty: LogicProgress = { solved: {}, missed: [] };

describe("logic data", () => {
  it("has unique ids and every answer is one of its options", () => {
    expect(LOGIC_ITEMS.length).toBeGreaterThan(40);
    expect(new Set(LOGIC_ITEMS.map((i) => i.id)).size).toBe(LOGIC_ITEMS.length);
    for (const i of LOGIC_ITEMS) {
      expect(i.options, i.id).toContain(i.answer);
      expect(new Set(i.options).size, i.id).toBe(i.options.length);
      expect(i.why.length, i.id).toBeGreaterThan(10);
    }
  });
});

describe("logic rounds", () => {
  it("starts at level 1 with no repeats", () => {
    const round = buildRound(LOGIC_ITEMS, empty, seeded(), 5);
    expect(round).toHaveLength(5);
    expect(new Set(round.map((i) => i.id)).size).toBe(5);
    for (const i of round) expect(i.level).toBe(1);
  });

  it("mixes kinds in a round", () => {
    const kinds = new Set(buildRound(LOGIC_ITEMS, empty, seeded(), 5).map((i) => i.kind));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("brings missed puzzles back and opens levels as you solve", () => {
    const round = buildRound(LOGIC_ITEMS, { solved: {}, missed: ["fal-1"] }, seeded(), 2);
    expect(round.map((i) => i.id)).toContain("fal-1");
    expect(unlockedLevel(empty)).toBe(1);
    const solved = Object.fromEntries(LOGIC_ITEMS.slice(0, 8).map((i) => [i.id, 1]));
    expect(unlockedLevel({ solved, missed: [] })).toBe(2);
  });

  it("tracks answers", () => {
    let p = applyAnswer(empty, "syl-1", false);
    expect(p.missed).toEqual(["syl-1"]);
    p = applyAnswer(p, "syl-1", true);
    expect(p.missed).toEqual([]);
    expect(p.solved["syl-1"]).toBe(1);
  });
});
