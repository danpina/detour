import { describe, expect, it } from "vitest";
import { ALL_PUZZLES, buildRound, type PatternPuzzle } from "./logic";

const PRIMES: number[] = [];
for (let x = 2; PRIMES.length < 60; x++) if (PRIMES.every((p) => x % p !== 0)) PRIMES.push(x);

/** Independent re-derivation of the term at 0-based index `i` from a puzzle's family and params. */
function termAt(family: string, p: Record<string, number>, i: number): number {
  switch (family) {
    case "arith": return p.start! + p.d! * i;
    case "geom": return p.start! * p.r! ** i;
    case "squares": return (p.k! + i) ** 2;
    case "cubes": return (p.k! + i) ** 3;
    case "triangular": return ((p.k! + i) * (p.k! + i + 1)) / 2;
    case "fibonacci": {
      let a = p.a!, b = p.b!;
      for (let j = 0; j < i; j++) [a, b] = [b, a + b];
      return a;
    }
    case "altAddSub": {
      let v = p.start!;
      for (let j = 1; j <= i; j++) v += j % 2 === 1 ? p.a! : -p.b!;
      return v;
    }
    case "growingDiff": {
      let v = p.start!;
      for (let j = 0; j < i; j++) v += p.d0! + p.step! * j;
      return v;
    }
    case "powers": return p.base! ** (p.k! + i);
    case "primes": return PRIMES[p.k! + i]!;
    case "mulAdd": {
      let v = p.start!;
      for (let j = 0; j < i; j++) v = v * p.m! + p.c!;
      return v;
    }
    case "interleaved": return i % 2 === 0 ? p.a0! + p.da! * (i / 2) : p.b0! + p.db! * ((i - 1) / 2);
    default: throw new Error(`unknown family ${family}`);
  }
}

describe("patterns data", () => {
  it("has about 300 puzzles with all three levels", () => {
    expect(ALL_PUZZLES.length).toBeGreaterThanOrEqual(250);
    for (const l of [1, 2, 3]) expect(ALL_PUZZLES.filter((p) => p.level === l).length).toBeGreaterThan(50);
  });

  it("has unique ids", () => {
    expect(new Set(ALL_PUZZLES.map((p) => p.id)).size).toBe(ALL_PUZZLES.length);
  });

  it.each(ALL_PUZZLES.map((p) => [p.id, p] as const))("%s is consistent", (_id, p: PatternPuzzle) => {
    expect(p.shown.length).toBeGreaterThanOrEqual(5);
    expect(p.shown.length).toBeLessThanOrEqual(7);
    expect(p.options).toHaveLength(4);
    expect(new Set(p.options).size).toBe(4);
    expect(p.options).toContain(p.answer);
    expect(p.options.filter((o) => o === p.answer)).toHaveLength(1);
    expect(p.rule.length).toBeGreaterThan(5);
    p.shown.forEach((v, i) => expect(termAt(p.family, p.params, i)).toBe(v));
    expect(termAt(p.family, p.params, p.shown.length)).toBe(p.answer);
  });
});

describe("buildRound", () => {
  it.each([
    [2, [1, 2]],
    [5, [1, 2, 2, 3, 3]],
    [10, [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]],
  ])("makes %i puzzles that ramp up in level", (size, levels) => {
    const round = buildRound(ALL_PUZZLES, Math.random, size);
    expect(round).toHaveLength(size);
    expect(round.map((p) => p.level)).toEqual(levels);
    expect(new Set(round.map((p) => p.id)).size).toBe(size);
  });

  it("reads the round size from settings when none is given", () => {
    expect(buildRound()).toHaveLength(2);
  });

  it("differs between rounds", () => {
    const ids = (seed: number) => {
      let s = seed;
      const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
      return buildRound(ALL_PUZZLES, rng, 10).map((p) => p.id).join();
    };
    expect(ids(1)).not.toBe(ids(2));
  });
});
