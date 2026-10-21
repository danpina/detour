import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./geoData";
import { buildQuestion, buildRound, CONTINENTS, levelForIndex, ROUND_LENGTH, type QuestionKind } from "./geoLogic";

/** Small deterministic generator so failures are reproducible. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("geo data", () => {
  it("has roughly 140 countries", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(130);
  });

  it("has two regional indicator characters for every flag", () => {
    for (const c of COUNTRIES) {
      const points = [...c.flag].map((ch) => ch.codePointAt(0) as number);
      expect(points.length, c.name).toBe(2);
      for (const p of points) {
        expect(p, c.name).toBeGreaterThanOrEqual(0x1f1e6);
        expect(p, c.name).toBeLessThanOrEqual(0x1f1ff);
      }
    }
  });

  it("has unique names, capitals and flags", () => {
    for (const key of ["name", "capital", "flag"] as const) {
      const values = COUNTRIES.map((c) => c[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("has valid continents and levels, and enough countries per continent for distractors", () => {
    for (const c of COUNTRIES) {
      expect(CONTINENTS as readonly string[], c.name).toContain(c.continent);
      expect([1, 2, 3], c.name).toContain(c.level);
    }
    for (const continent of CONTINENTS) {
      expect(COUNTRIES.filter((c) => c.continent === continent).length, continent).toBeGreaterThanOrEqual(4);
    }
    for (const level of [1, 2, 3]) {
      expect(COUNTRIES.filter((c) => c.level === level).length, `level ${level}`).toBeGreaterThanOrEqual(ROUND_LENGTH);
    }
  });
});

describe("geo questions", () => {
  const kinds: QuestionKind[] = ["flag", "capital", "country"];

  it("always has 4 distinct options that include the answer exactly once", () => {
    const rng = seeded(7);
    for (const answer of COUNTRIES) {
      for (const kind of kinds) {
        const q = buildQuestion(COUNTRIES, answer, kind, rng);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
      }
    }
  });

  it("uses same-continent distractors when the continent is big enough", () => {
    const rng = seeded(11);
    for (const answer of COUNTRIES) {
      const q = buildQuestion(COUNTRIES, answer, "country", rng);
      for (const o of q.options) {
        const c = COUNTRIES.find((x) => x.name === o)!;
        expect(c.continent, answer.name).toBe(answer.continent);
      }
    }
  });

  it("has a non-empty fact", () => {
    const q = buildQuestion(COUNTRIES, COUNTRIES[0]!, "capital", seeded(1));
    expect(q.fact.length).toBeGreaterThan(0);
  });
});

describe("geo rounds", () => {
  it("has 10 questions, no repeated country, and ramps through the levels", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const round = buildRound(COUNTRIES, seeded(seed));
      expect(round).toHaveLength(ROUND_LENGTH);
      round.forEach((q, i) => expect(q.level).toBe(levelForIndex(i)));
      const levels = round.map((q) => q.level);
      expect(levels).toEqual([...levels].sort());
      const prompts = round.map((q) => q.fact);
      expect(new Set(prompts).size).toBe(ROUND_LENGTH);
    }
  });

  it("mixes all three question kinds", () => {
    const round = buildRound(COUNTRIES, seeded(5));
    expect(new Set(round.map((q) => q.kind)).size).toBe(3);
  });
});
