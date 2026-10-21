import { describe, expect, it } from "vitest";
import { applyResult, checkAnswer, generateDigits, generateTiles, isPrefix, newRun } from "./logic";

function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe("memory logic", () => {
  it("generates digits from the injected random source", () => {
    expect(generateDigits(4, seeded([0, 0.15, 0.55, 0.999]))).toEqual([0, 1, 5, 9]);
  });

  it("clamps a random value of 1", () => {
    expect(generateDigits(1, () => 1)).toEqual([9]);
  });

  it("never repeats a tile twice in a row", () => {
    for (let n = 0; n < 50; n++) {
      const t = generateTiles(12, 9);
      expect(t).toHaveLength(12);
      for (let i = 1; i < t.length; i++) expect(t[i]).not.toBe(t[i - 1]);
      for (const v of t) expect(v >= 0 && v < 9).toBe(true);
    }
    const stuck = generateTiles(5, 9, () => 0);
    for (let i = 1; i < stuck.length; i++) expect(stuck[i]).not.toBe(stuck[i - 1]);
  });

  it("checks answers", () => {
    expect(checkAnswer([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(checkAnswer([1, 2, 3], [1, 3, 2])).toBe(false);
    expect(checkAnswer([1, 2, 3], [1, 2])).toBe(false);
    expect(isPrefix([1, 2, 3], [1, 2])).toBe(true);
    expect(isPrefix([1, 2, 3], [1, 3])).toBe(false);
  });

  it("grows by one per success and tracks the best", () => {
    let run = newRun();
    expect(run.length).toBe(3);
    run = applyResult(run, true);
    run = applyResult(run, true);
    expect(run.length).toBe(5);
    expect(run.best).toBe(4);
    expect(run.over).toBe(false);
  });

  it("ends after two misses in a row, not two in total", () => {
    let run = newRun();
    run = applyResult(run, true);
    run = applyResult(run, false);
    expect(run.over).toBe(false);
    expect(run.length).toBe(4);
    run = applyResult(run, true);
    run = applyResult(run, false);
    expect(run.over).toBe(false);
    run = applyResult(run, false);
    expect(run.over).toBe(true);
    expect(run.best).toBe(4);
  });

  it("scores zero if the first two rounds are missed", () => {
    let run = applyResult(newRun(), false);
    run = applyResult(run, false);
    expect(run.over).toBe(true);
    expect(run.best).toBe(0);
  });
});
