import { describe, expect, it } from "vitest";
import type { Card } from "@detour/content";
import { ALL_CARDS, imageUrl } from "./content";
import { closeness, closenessLabel, positionOf, tidy, valueAt } from "./scoring";
import { pickSet } from "./pickSet";
import { GAME_IDS } from "../games/ids";
import { generateRound } from "./drills";
import { mathRound, pickGames } from "./session";

const fake = (id: string, interest: Card["interest"], type: Card["type"]) => ({ id, interest, type }) as Card;

describe("content", () => {
  it("loads every published card and resolves its image", () => {
    expect(ALL_CARDS.length).toBeGreaterThan(0);
    for (const c of ALL_CARDS) {
      expect(c.probes.length).toBeGreaterThanOrEqual(1);
      expect(c.sources.length).toBeGreaterThanOrEqual(1);
      if ("image" in c) expect(imageUrl(c.image.file), c.id).toBeTruthy();
    }
  });
});

describe("estimate scoring", () => {
  it("is 1 for an exact guess and 0 at the far end", () => {
    expect(closeness(71, 71, 0, 100, "linear")).toBe(1);
    expect(closeness(0, 100, 0, 100, "linear")).toBe(0);
  });
  it("compares ratios on a log scale", () => {
    const a = closeness(130_000, 1_300_000, 1000, 100_000_000, "log");
    const b = closeness(13_000_000, 1_300_000, 1000, 100_000_000, "log");
    expect(a).toBeCloseTo(b, 5);
  });
  it("does not call a far-off guess close just because the slider range is wide", () => {
    // $1 at 10% for 50 years is about $117 on a 1..100,000 slider. 5,000 is ~43x too big.
    expect(closenessLabel(closeness(5000, 117, 1, 100_000, "log"))).toMatch(/Not quite/);
    expect(closenessLabel(closeness(100, 117, 1, 100_000, "log"))).toBe("Very close");
    expect(closenessLabel(closeness(200, 117, 1, 100_000, "log"))).toBe("In the ballpark");
  });
  it("labels tiers", () => {
    expect(closenessLabel(1)).toBe("Spot on");
    expect(closenessLabel(0.2)).toMatch(/Not quite/);
  });
  it("slider mapping round-trips", () => {
    for (const scale of ["linear", "log"] as const) {
      const v = valueAt(0.3, 10, 10_000, scale);
      expect(positionOf(v, 10, 10_000, scale)).toBeCloseTo(0.3, 8);
    }
    expect(tidy(1234567)).toBe(1200000);
  });
});

describe("pickSet", () => {
  const cards = [
    fake("hist-1", "history", "story"), fake("hist-2", "history", "fact_why"),
    fake("sci-1", "science", "fact_why"), fake("sci-2", "science", "estimate"), fake("sci-3", "science", "guess_first"),
    fake("money-1", "money", "story"), fake("tech-1", "tech", "story"),
  ];
  it("returns n unique cards, mixing the chosen interests", () => {
    const set = pickSet(cards, ["history", "science", "money"], new Set(), 5);
    expect(set).toHaveLength(5);
    expect(new Set(set.map((c) => c.id)).size).toBe(5);
    expect(new Set(set.slice(0, 3).map((c) => c.interest)).size).toBe(3);
  });
  it("prefers unseen cards and falls back to seen ones when short", () => {
    const seen = new Set(["hist-1", "hist-2", "sci-1"]);
    expect(pickSet(cards, ["history", "science", "money"], seen, 3).every((c) => !seen.has(c.id))).toBe(true);
    expect(pickSet(cards, ["history", "science", "money"], seen, 4)).toHaveLength(4); // the 4th is a repeat of a topic they picked
    expect(pickSet(cards.slice(0, 3), ["history"], new Set(cards.map((c) => c.id)), 5)).toHaveLength(2); // only the 2 history cards exist
  });
  it("never adds cards from topics the user did not pick", () => {
    const set = pickSet(cards, ["tech"], new Set(), 5);
    expect(set.map((c) => c.id)).toEqual(["tech-1"]);
    expect(set.every((c) => c.interest === "tech")).toBe(true);
    const chosen = pickSet(cards, ["history", "money"], new Set(["hist-1", "hist-2"]), 5);
    expect(chosen.every((c) => c.interest === "history" || c.interest === "money")).toBe(true);
  });
});
describe("the three rounds", () => {
  it("a games round has distinct games", () => {
    const games = pickGames(3, () => 0.3);
    expect(games).toHaveLength(3);
    expect(new Set(games).size).toBe(3);
    expect(pickGames(100)).toHaveLength(GAME_IDS.length);
  });

  it("a math round has exactly as many problems as the round length, split over mental math and one other skill", () => {
    const skills = [
      { track_id: "mental-math" as const, level: 4, recent_results: [], attempts_total: 0, last_at: 5 },
      { track_id: "estimation" as const, level: 2, recent_results: [], attempts_total: 0, last_at: 1 },
      { track_id: "algebra" as const, level: 3, recent_results: [], attempts_total: 0, last_at: 9 },
      ...(["geometry", "probability", "number-theory", "money", "fractions", "statistics", "sequences", "rates"] as const).map((track_id) => ({ track_id, level: 1, recent_results: [], attempts_total: 0, last_at: 50 })),
    ];
    const items = mathRound(skills, 5, () => 7);
    expect(items).toEqual([
      { kind: "drill", drill: { track: "mental-math", level: 4, seed: 7, count: 3 } },
      { kind: "drill", drill: { track: "estimation", level: 2, seed: 7, count: 2 } },
    ]);
    for (const size of [1, 2, 3, 5, 8, 12]) {
      const round = mathRound(skills, size, () => 11);
      const problems = round.flatMap((i) => (i.kind === "drill" ? generateRound(i.drill) : []));
      expect(problems.length, "size " + size).toBe(size);
    }
    // With nothing practised yet, everything starts at level 1.
    const fresh = mathRound([], 5, () => 1);
    expect(fresh.every((i) => i.kind === "drill" && i.drill.level === 1)).toBe(true);
  });
});

describe("math rounds and switched-off skills", () => {
  it("never pick a skill that is switched off, and fall back to mental math alone", () => {
    const off = ["geometry", "probability", "number-theory", "money", "fractions", "sequences", "rates", "estimation"];
    const items = mathRound([], 5, () => 1, off);
    expect(items.map((x) => (x.kind === "drill" ? x.drill.track : ""))).toEqual(["mental-math", "algebra"]);
    const everything = [...off, "algebra", "statistics"];
    expect(mathRound([], 5, () => 3, everything)).toEqual([{ kind: "drill", drill: { track: "mental-math", level: 1, seed: 3, count: 5 } }]);
  });
});
