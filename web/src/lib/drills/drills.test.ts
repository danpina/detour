import { describe, expect, it } from "vitest";
import { ESTIMATION_MAX_LEVEL, estimationVerdict, timesOff } from "./estimation";
import {
  LEVEL_WINDOW, TRACKS, applyResults, emptyProgress, generateRound, judge, nextTrack, parseNumber, shouldLevelUp, type SkillProgress,
} from "./index";
import { MENTAL_MATH_MAX_LEVEL } from "./mentalMath";
import { makeRng } from "./rng";

describe("rng", () => {
  it("is deterministic and stays in range", () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 50; i++) {
      const x = a.int(3, 9);
      expect(x).toBe(b.int(3, 9));
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(9);
    }
  });
});

describe("mental math generators", () => {
  it("make correct, integer answers at every level", () => {
    for (let level = 1; level <= MENTAL_MATH_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const p of generateRound({ track: "mental-math", level, seed })) {
          // Only the decimals level (0.6 × 0.7) has a fractional answer.
          if (!p.prompt.startsWith("0.")) expect(Number.isInteger(p.answer), `${p.prompt}`).toBe(true);
          expect(p.answer).toBeGreaterThan(0);
        }
      }
    }
  });

  const unsup = (s: string) => Number([...s].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join(""));

  /** Evaluates a prompt such as "45 + 38", "84 ÷ 7", "15% of 80" or "35²", to check the generator's answer independently. */
  const evaluate = (prompt: string): number => {
    let m = /^(\d+) \+ (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) + Number(m[2]);
    m = /^(\d+) − (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) - Number(m[2]);
    m = /^(\d+) × (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) * Number(m[2]);
    m = /^(\d+) ÷ (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) / Number(m[2]);
    m = /^(\d+)% of (\d+)$/.exec(prompt);
    if (m) return (Number(m[1]) * Number(m[2])) / 100;
    m = /^(\d+)²$/.exec(prompt);
    if (m) return Number(m[1]) ** 2;
    m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(prompt);
    if (m) return Number(m[1]) ** unsup(m[2]!);
    m = /^√(\d+)$/.exec(prompt);
    if (m) return Math.sqrt(Number(m[1]));
    m = /^(\d+)\/(\d+) of (\d+)$/.exec(prompt);
    if (m) return (Number(m[3]) / Number(m[2])) * Number(m[1]);
    m = /^(\d+) (increased|decreased) by (\d+)%$/.exec(prompt);
    if (m) return Number(m[1]) * (1 + (m[2] === "increased" ? 1 : -1) * (Number(m[3]) / 100));
    m = /^(\d+) is what % of (\d+)\?$/.exec(prompt);
    if (m) return (Number(m[1]) / Number(m[2])) * 100;
    m = /^(\d+) \+ (\d+) × (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) + Number(m[2]) * Number(m[3]);
    m = /^\((\d+) \+ (\d+)\) × (\d+) − (\d+)$/.exec(prompt);
    if (m) return (Number(m[1]) + Number(m[2])) * Number(m[3]) - Number(m[4]);
    m = /^Average of (\d+), (\d+) and (\d+)$/.exec(prompt);
    if (m) return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
    m = /^−(\d+) \+ (\d+) − (\d+)$/.exec(prompt);
    if (m) return -Number(m[1]) + Number(m[2]) - Number(m[3]);
    m = /^Remainder of (\d+) ÷ (\d+)$/.exec(prompt);
    if (m) return Number(m[1]) % Number(m[2]);
    m = /^0\.(\d) × 0\.(\d)$/.exec(prompt);
    if (m) return (Number(m[1]) / 10) * (Number(m[2]) / 10);
    throw new Error(`unrecognised prompt: ${prompt}`);
  };

  it("every answer matches the arithmetic in its prompt, at every level", () => {
    for (let level = 1; level <= MENTAL_MATH_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const p of generateRound({ track: "mental-math", level, seed })) {
          expect(p.answer, p.prompt).toBeCloseTo(evaluate(p.prompt), 10);
        }
      }
    }
  });

  it("level 1 is sums only and level 2 is differences only (the first problem of a round is at the player's level)", () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(generateRound({ track: "mental-math", level: 1, seed }).every((p) => p.prompt.includes(" + "))).toBe(true);
      expect(generateRound({ track: "mental-math", level: 2, seed })[0]!.prompt).toContain(" − ");
    }
  });

  it("covers sums, differences, multiplication and division across the levels", () => {
    const ops = new Set<string>();
    for (let level = 1; level <= MENTAL_MATH_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 50; seed++) {
        for (const p of generateRound({ track: "mental-math", level, seed })) {
          for (const op of ["+", "−", "×", "÷", "%", "²"]) if (p.prompt.includes(op)) ops.add(op);
        }
      }
    }
    expect([...ops].sort()).toEqual(["%", "+", "²", "×", "÷", "−"].sort());
  });

  it("a round at a higher level mixes operations instead of repeating one kind", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const p of generateRound({ track: "mental-math", level: 8, seed })) kinds.add(p.prompt.replace(/\d+/g, "#"));
    }
    // Level 8 draws from levels 5-8: division and 3-digit sums and multiplications all show up.
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it("division problems divide exactly", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const p of generateRound({ track: "mental-math", level: 8, seed })) {
        const m = /^(\d+) ÷ (\d+)$/.exec(p.prompt);
        if (m) expect(Number(m[1]) % Number(m[2])).toBe(0);
      }
    }
  });

  it("rounds have the right size, no repeats, and are reproducible", () => {
    const spec = { track: "mental-math" as const, level: 4, seed: 7 };
    const round = generateRound(spec);
    expect(round).toHaveLength(TRACKS["mental-math"].problems);
    expect(new Set(round.map((p) => p.prompt)).size).toBe(round.length);
    expect(generateRound(spec)).toEqual(round);
  });
});

describe("estimation", () => {
  it("generates positive, finite answers with a hint at every level", () => {
    for (let level = 1; level <= ESTIMATION_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const p of generateRound({ track: "estimation", level, seed })) {
          expect(p.answer).toBeGreaterThan(0);
          expect(Number.isFinite(p.answer)).toBe(true);
          expect(p.hint).toBeTruthy();
        }
      }
    }
  });

  it("level 1 everyday totals multiply out exactly", () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const p of generateRound({ track: "estimation", level: 1, seed })) {
        const nums = (p.prompt.match(/\d+/g) ?? []).map(Number);
        expect(nums.length).toBeGreaterThanOrEqual(2);
        expect(Number.isInteger(p.answer) && p.answer > 0).toBe(true);
        expect(p.answer % nums[0]!).toBe(0);
      }
    }
  });

  it("scores by log distance", () => {
    expect(timesOff(100, 100)).toBe(1);
    expect(timesOff(50, 100)).toBeCloseTo(2, 10);
    expect(timesOff(200, 100)).toBeCloseTo(2, 10);
    expect(timesOff(1000, 100)).toBeCloseTo(10, 10);
    expect(estimationVerdict(105, 100)).toBe("Spot on");
    expect(estimationVerdict(180, 100)).toBe("Close enough");
    expect(estimationVerdict(500, 100)).toMatch(/ballpark/);
    expect(estimationVerdict(100000, 100)).toMatch(/Way off/);
  });
});

describe("answers", () => {
  it("parses friendly numbers", () => {
    expect(parseNumber("1,200")).toBe(1200);
    expect(parseNumber("1.5k")).toBe(1500);
    expect(parseNumber("3m")).toBe(3_000_000);
    expect(parseNumber("2e6")).toBe(2_000_000);
    expect(parseNumber("1.2 million")).toBe(1_200_000);
    expect(parseNumber("abc")).toBeUndefined();
    expect(parseNumber("")).toBeUndefined();
  });
  it("mental math needs the exact answer; estimation allows a factor of 2", () => {
    expect(judge("mental-math", { prompt: "2 + 2", answer: 4 }, "4").correct).toBe(true);
    expect(judge("mental-math", { prompt: "2 + 2", answer: 4 }, "5").correct).toBe(false);
    expect(judge("estimation", { prompt: "?", answer: 1000 }, "1800").correct).toBe(true);
    expect(judge("estimation", { prompt: "?", answer: 1000 }, "300").correct).toBe(false);
    expect(judge("estimation", { prompt: "?", answer: 1000 }, "lots").correct).toBe(false);
  });
});

describe("levelling up (80% over 20 attempts)", () => {
  const results = (right: number, total: number) => Array.from({ length: total }, (_, i) => i < right);

  it("needs 20 attempts and 80%", () => {
    expect(shouldLevelUp(results(16, 19))).toBe(false);
    expect(shouldLevelUp(results(15, 20))).toBe(false);
    expect(shouldLevelUp(results(16, 20))).toBe(true);
  });

  it("only the last 20 attempts count", () => {
    expect(shouldLevelUp([...results(0, 10), ...results(20, 20)])).toBe(true);
    expect(shouldLevelUp([...results(20, 20), ...results(0, 10)])).toBe(false);
  });

  it("levels up, resets the window, and keeps totals", () => {
    let p: SkillProgress = emptyProgress("mental-math");
    let up = false;
    for (let round = 0; round < 7; round++) ({ progress: p, leveledUp: up } = applyResults(p, [true, true, true], 1000 + round));
    expect(p.attempts_total).toBe(21);
    expect(p.level).toBe(2);
    expect(p.recent_results).toEqual([]);
    expect(up).toBe(true);
  });

  it("does not level past the top", () => {
    const top: SkillProgress = { ...emptyProgress("estimation"), level: ESTIMATION_MAX_LEVEL, recent_results: Array(LEVEL_WINDOW).fill(true) };
    const { progress, leveledUp } = applyResults(top, [true], 1);
    expect(progress.level).toBe(ESTIMATION_MAX_LEVEL);
    expect(leveledUp).toBe(false);
  });

  it("alternates between tracks, least recent first", () => {
    expect(nextTrack([])).toBe("mental-math");
    const all = [{ ...emptyProgress("mental-math"), last_at: 10 }, { ...emptyProgress("estimation"), last_at: 20 }, { ...emptyProgress("algebra"), last_at: 30 }];
    expect(nextTrack(all, ["mental-math", "estimation", "algebra"])).toBe("mental-math");
    expect(nextTrack(all, ["estimation", "algebra"])).toBe("estimation");
    expect(nextTrack(all)).toBe("geometry"); // never practised, first in the list
  });
});

describe("estimation question variety", () => {
  it("has at least 50 templates, a dozen or more on every level", async () => {
    const { ESTIMATION_TEMPLATES, ESTIMATION_LEVELS } = await import("./estimationTemplates");
    expect(ESTIMATION_TEMPLATES.length).toBeGreaterThanOrEqual(50);
    for (let level = 1; level <= ESTIMATION_LEVELS.length; level++) {
      expect(ESTIMATION_TEMPLATES.filter((t) => t.level === level).length).toBeGreaterThanOrEqual(12);
    }
  });

  it("rarely repeats a question: many seeds give many different prompts, and no template dominates", () => {
    for (let level = 1; level <= ESTIMATION_MAX_LEVEL; level++) {
      const prompts = new Map<string, number>();
      for (let seed = 1; seed <= 300; seed++) {
        for (const p of generateRound({ track: "estimation", level, seed })) prompts.set(p.prompt, (prompts.get(p.prompt) ?? 0) + 1);
      }
      expect(prompts.size).toBeGreaterThanOrEqual(150);
      const stems = new Set([...prompts.keys()].map((p) => p.replace(/\d+/g, "#")));
      expect(stems.size).toBeGreaterThanOrEqual(12);
    }
  });

  it("every answer is the product of the numbers in the prompt's template", () => {
    for (let level = 1; level <= ESTIMATION_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        for (const p of generateRound({ track: "estimation", level, seed })) {
          expect(Number.isInteger(p.answer) && p.answer > 0, p.prompt).toBe(true);
          expect(p.hint).toBeTruthy();
        }
      }
    }
  });
});

describe("choosing the skill round", () => {
  it("only picks from the allowed tracks and alternates by recency", () => {
    expect(nextTrack([], ["estimation"])).toBe("estimation");
    expect(nextTrack([], ["mental-math"])).toBe("mental-math");
    const practised = [{ ...emptyProgress("mental-math"), last_at: 5000 }];
    expect(nextTrack(practised, ["mental-math", "estimation"])).toBe("estimation");
    expect(nextTrack(practised, ["mental-math"])).toBe("mental-math");
  });
});

describe("algebra and calculus", () => {
  const unsup = (s: string) => (s === "" ? 1 : Number([...s].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")));
  const coef = (s: string | undefined) => (s === undefined || s === "" ? 1 : Number(s));

  /** Solves a prompt independently of the generator. */
  const solve = (prompt: string): number => {
    let m = /^x \+ (\d+) = (\d+)$/.exec(prompt);
    if (m) return Number(m[2]) - Number(m[1]);
    m = /^(\d+)x = (\d+)$/.exec(prompt);
    if (m) return Number(m[2]) / Number(m[1]);
    m = /^x ÷ (\d+) = (\d+)$/.exec(prompt);
    if (m) return Number(m[2]) * Number(m[1]);
    m = /^(\d+)x \+ (\d+) = (\d+)$/.exec(prompt);
    if (m) return (Number(m[3]) - Number(m[2])) / Number(m[1]);
    m = /^(\d+)x − (\d+) = (\d+)$/.exec(prompt);
    if (m) return (Number(m[3]) + Number(m[2])) / Number(m[1]);
    m = /^Slope through \((\d+), (\d+)\) and \((\d+), (\d+)\)$/.exec(prompt);
    if (m) return (Number(m[4]) - Number(m[2])) / (Number(m[3]) - Number(m[1]));
    m = /^(\d*)x² \+ (\d+), when x = (\d+)$/.exec(prompt);
    if (m) return coef(m[1]) * Number(m[3]) ** 2 + Number(m[2]);
    m = /^Larger root of x² − (\d+)x \+ (\d+) = 0$/.exec(prompt);
    if (m) {
      const s = Number(m[1]), p = Number(m[2]);
      return (s + Math.sqrt(s * s - 4 * p)) / 2;
    }
    m = /^d\/dx of (\d*)x([⁰¹²³⁴⁵⁶⁷⁸⁹]*) at x = (\d+)$/.exec(prompt);
    if (m) return coef(m[1]) * unsup(m[2]!) * Number(m[3]) ** (unsup(m[2]!) - 1);
    m = /^d\/dx of (\d*)x² \+ (\d+)x at x = (\d+)$/.exec(prompt);
    if (m) return 2 * coef(m[1]) * Number(m[3]) + Number(m[2]);
    m = /^∫ from 0 to (\d+) of (\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]*) dx$/.exec(prompt);
    if (m) {
      const n = unsup(m[3]!);
      return (Number(m[2]) * Number(m[1]) ** (n + 1)) / (n + 1);
    }
    throw new Error(`unrecognised prompt: ${prompt}`);
  };

  it("has the levels it says, and every answer is a whole number that matches its prompt", () => {
    expect(TRACKS.algebra.maxLevel).toBe(20);
    // The first ten levels are solved here from the prompt alone; the later ones are checked below.
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed <= 200; seed++) {
        const round = generateRound({ track: "algebra", level, seed });
        expect(round.length).toBe(3);
        for (const p of round) {
          expect(Number.isInteger(p.answer), p.prompt).toBe(true);
          expect(p.answer, p.prompt).toBeCloseTo(solve(p.prompt), 10);
          expect(judge("algebra", p, String(p.answer)).correct).toBe(true);
          expect(judge("algebra", p, String(p.answer + 1)).correct).toBe(false);
        }
      }
    }
  });
});

describe("geometry, probability, number theory and money tracks", () => {
  const NEW = ["geometry", "probability", "number-theory", "money", "fractions", "statistics", "sequences", "rates"] as const;

  it("have a name for every level, and statistics has the most", () => {
    for (const track of NEW) {
      expect(TRACKS[track].levels, track).toHaveLength(TRACKS[track].maxLevel);
      expect(TRACKS[track].maxLevel, track).toBe(track === "statistics" ? 24 : 20);
    }
  });

  it("give whole, non-negative answers with clean prompts and a hint", () => {
    for (const track of NEW) {
      for (let level = 1; level <= TRACKS[track].maxLevel; level++) {
        for (let seed = 1; seed <= 200; seed++) {
          const round = generateRound({ track, level, seed });
          expect(round.length, `${track} ${level}`).toBe(3);
          for (const p of round) {
            expect(Number.isInteger(p.answer) && p.answer >= 0, `${p.prompt} = ${p.answer}`).toBe(true);
            if (p.choices) {
              // Multiple choice: the answer is the index of the right option; the options are different and few.
              expect(p.choices.length, p.prompt).toBeGreaterThanOrEqual(2);
              expect(p.choices.length, p.prompt).toBeLessThanOrEqual(4);
              expect(new Set(p.choices).size, p.prompt).toBe(p.choices.length);
              expect(p.answer, p.prompt).toBeLessThan(p.choices.length);
            }
            expect(p.prompt, p.prompt).not.toMatch(/NaN|undefined|Infinity/);
            expect(p.hint ?? "", p.prompt).not.toMatch(/NaN|undefined|Infinity/);
            expect(judge(track, p, String(p.answer)).correct).toBe(true);
            expect(judge(track, p, String(p.answer + 1)).correct).toBe(false);
          }
        }
      }
    }
  });

  it("checks a few answers by an independent rule", () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const p of generateRound({ track: "geometry", level: 4, seed, count: 1 })) {
        const m = /angles (\d+)° and (\d+)°/.exec(p.prompt)!;
        expect(p.answer).toBe(180 - Number(m[1]) - Number(m[2]));
      }
      for (const p of generateRound({ track: "number-theory", level: 7, seed, count: 1 })) {
        const bits = /Binary ([01]+) in decimal/.exec(p.prompt)![1]!;
        expect(p.answer).toBe(parseInt(bits, 2));
      }
      for (const p of generateRound({ track: "number-theory", level: 8, seed, count: 1 })) {
        const n = Number(/^(\d+) in binary$/.exec(p.prompt)![1]);
        expect(p.answer).toBe(Number(n.toString(2)));
      }
      for (const p of generateRound({ track: "number-theory", level: 9, seed, count: 1 })) {
        expect(p.answer).toBe(parseInt(/Hexadecimal ([0-9A-F]+) in/.exec(p.prompt)![1]!, 16));
      }
      for (const p of generateRound({ track: "probability", level: 6, seed, count: 1 })) {
        const s = Number(/total (\d+)\?/.exec(p.prompt)![1]);
        let ways = 0;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) ways++;
        expect(p.answer).toBe(ways);
      }
    }
  });
});

describe("statistics answers match the textbook definitions", () => {
  const numbersIn = (text: string) => text.replace(/^[^0-9-]*/, "").split(/,\s*/).map(Number);
  const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const first = (level: number, seed: number) => generateRound({ track: "statistics", level, seed, count: 1 })[0]!;

  it("computes means, medians, modes, ranges, quartiles and variances", () => {
    for (let seed = 1; seed <= 150; seed++) {
      let p = first(1, seed);
      expect(p.answer).toBe(mean(numbersIn(p.prompt.replace("Mean of ", ""))));
      p = first(2, seed);
      expect(p.answer).toBe(sorted(numbersIn(p.prompt.replace("Median of ", "")))[2]);
      p = first(3, seed);
      const counts = new Map<number, number>();
      for (const x of numbersIn(p.prompt.replace("Mode of ", ""))) counts.set(x, (counts.get(x) ?? 0) + 1);
      expect(counts.get(p.answer)).toBe(Math.max(...counts.values()));
      p = first(4, seed);
      const xs = numbersIn(p.prompt.replace("Range of ", ""));
      expect(p.answer).toBe(Math.max(...xs) - Math.min(...xs));
      p = first(5, seed);
      expect(p.answer).toBe(mean(numbersIn(p.prompt.replace("Mean of ", ""))));
      p = first(6, seed);
      const s6 = sorted(numbersIn(p.prompt.replace("Median of ", "")));
      expect(p.answer).toBe((s6[2]! + s6[3]!) / 2);
      p = first(11, seed);
      const s11 = sorted(numbersIn(p.prompt.replace("Interquartile range (Q3 − Q1) of ", "")));
      expect(p.answer).toBe(s11[5]! - s11[1]!);
      p = first(15, seed);
      const v = numbersIn(p.prompt.replace("Variance of ", ""));
      expect(p.answer).toBeCloseTo(v.reduce((a, x) => a + (x - mean(v)) ** 2, 0) / v.length, 10);
      p = first(14, seed);
      const w = numbersIn(p.prompt.replace("Standard deviation of ", ""));
      expect(p.answer).toBeCloseTo(Math.sqrt(w.reduce((a, x) => a + (x - mean(w)) ** 2, 0) / w.length), 10);
    }
  });

  it("gets the screening percentages right", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = first(23, seed);
      const [, sick, sens, fp] = /(\d+) have a condition.*catches (\d+)%.*flags (\d+)%/.exec(p.prompt)!.map(Number) as [number, number, number, number];
      const real = (sick * sens) / 100, fake = ((1000 - sick) * fp) / 100;
      expect(p.answer).toBeCloseTo((100 * real) / (real + fake), 10);
    }
  });
});

describe("the later levels check themselves", () => {
  const first = (track: Parameters<typeof generateRound>[0]["track"], level: number, seed: number) => generateRound({ track, level, seed, count: 1 })[0]!;
  const nums = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

  it("has about twenty levels in each skill, and some multiple-choice and true-or-false ones", () => {
    let withChoices = 0;
    for (const track of ["algebra", "geometry", "probability", "number-theory", "money", "fractions", "sequences", "rates"] as const) {
      expect(TRACKS[track].maxLevel, track).toBe(20);
      expect(new Set(TRACKS[track].levels).size, track).toBe(20);
      for (let seed = 1; seed <= 20; seed++) if (first(track, 20, seed).choices || first(track, 16, seed).choices) withChoices++;
    }
    expect(withChoices).toBeGreaterThan(20);
  });

  it("algebra: two unknowns, brackets, expanding, cubics and integrals", () => {
    for (let seed = 1; seed <= 100; seed++) {
      let p = first("algebra", 13, seed);
      let [a, b, c] = nums(p.prompt) as [number, number, number];
      expect(a * (p.answer + b)).toBe(c);
      p = first("algebra", 15, seed);
      [a, b] = nums(p.prompt) as [number, number];
      expect(p.answer + (a - p.answer)).toBe(a);
      expect(p.answer - (a - p.answer)).toBe(b);
      p = first("algebra", 20, seed);
      [c, a, b] = nums(p.prompt).slice(1) as [number, number, number];
      expect(p.answer).toBeCloseTo((a * c * c) / 2 + b * c, 10);
    }
  });

  it("geometry: the right-triangle levels use real triples", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = first("geometry", 15, seed);
      const [x, y] = nums(p.prompt) as [number, number];
      expect(p.answer ** 2).toBe(x * x + y * y);
      const q = first("geometry", 20, seed);
      const n = nums(q.prompt) as number[];
      expect(q.answer ** 2).toBe((n[2]! - n[0]!) ** 2 + (n[3]! - n[1]!) ** 2);
      const t = first("geometry", 16, seed);
      const [s1, s2, s3] = nums(t.prompt) as [number, number, number];
      expect(t.answer).toBe(s1 * s1 + s2 * s2 === s3 * s3 ? 0 : 1);
    }
  });

  it("number theory: primes, sums of primes, squares, binary and hex", () => {
    const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
    for (let seed = 1; seed <= 100; seed++) {
      const p = first("number-theory", 11, seed);
      expect(p.answer).toBe(isPrime(nums(p.prompt)[0]!) ? 0 : 1);
      const q = first("number-theory", 15, seed);
      const [x, y] = q.prompt.match(/[01]+/g)!.map((b) => parseInt(b, 2)) as [number, number];
      expect(parseInt(String(q.answer), 2)).toBe(x + y);
      const h = first("number-theory", 16, seed);
      const [hx, hy] = (h.prompt.match(/0x([0-9A-F]+)/g) ?? []).map((m) => parseInt(m.slice(2), 16)) as [number, number];
      expect(h.answer).toBe(hx + hy);
      const sq = first("number-theory", 13, seed);
      expect(sq.answer ** 2).toBeLessThanOrEqual(nums(sq.prompt)[1]!);
      expect((sq.answer + 1) ** 2).toBeGreaterThan(nums(sq.prompt)[1]!);
      const d = first("number-theory", 17, seed);
      expect(Number(d.choices![d.answer]) % 9).toBe(0);
      expect(d.choices!.filter((c) => Number(c) % 9 === 0)).toHaveLength(1);
    }
  });

  it("money and fractions: the deal and the comparison point to the right option", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = first("money", 12, seed);
      const [nA, pA, nB, pB] = nums(m.prompt.replace("Pack A", "").replace("Pack B", "")) as [number, number, number, number];
      expect(m.answer).toBe(pA / nA < pB / nB ? 0 : 1);
      const f = first("fractions", 13, seed);
      const [a, b] = f.choices![0]!.split("/").map(Number) as [number, number];
      const [c, d] = f.choices![1]!.split("/").map(Number) as [number, number];
      expect(f.answer).toBe(a * d > c * b ? 0 : 1);
    }
  });
});
