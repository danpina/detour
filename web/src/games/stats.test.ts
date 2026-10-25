import { describe, expect, it } from "vitest";
import { beats } from "./stats";

describe("best round", () => {
  it("the first round with a saved length always counts", () => {
    expect(beats(2, 5, { best: 0, plays: 0 })).toBe(true);
    // An older save without a round length is replaced by the next real round.
    expect(beats(1, 2, { best: 8, plays: 3 })).toBe(true);
  });

  it("compares rounds of different lengths by how much of the round was right", () => {
    const four_of_five = { best: 4, of: 5, plays: 1 };
    expect(beats(9, 10, four_of_five)).toBe(true);
    expect(beats(3, 5, four_of_five)).toBe(false);
    // 2 of 2 is a perfect round but a shorter one: a perfect long round beats it, and it does not beat a perfect long one.
    expect(beats(10, 10, { best: 2, of: 2, plays: 1 })).toBe(true);
    expect(beats(2, 2, { best: 10, of: 10, plays: 1 })).toBe(false);
  });

  it("runs (such as digits remembered in a row) compare plain scores", () => {
    expect(beats(8, 0, { best: 7, of: 0, plays: 1 })).toBe(true);
    expect(beats(6, 0, { best: 7, of: 0, plays: 1 })).toBe(false);
  });
});
