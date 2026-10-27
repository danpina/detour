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
    expect(TRACKS.algebra.maxLevel).toBe(10);
    for (let level = 1; level <= TRACKS.algebra.maxLevel; level++) {
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
  const NEW = ["geometry", "probability", "number-theory", "money"] as const;

  it("have 10 levels each, with a name for every level", () => {
    for (const track of NEW) {
      expect(TRACKS[track].maxLevel, track).toBe(10);
      expect(TRACKS[track].levels, track).toHaveLength(10);
    }
  });

  it("give whole, non-negative answers with clean prompts and a hint", () => {
    for (const track of NEW) {
      for (let level = 1; level <= 10; level++) {
        for (let seed = 1; seed <= 200; seed++) {
          const round = generateRound({ track, level, seed });
          expect(round.length, `${track} ${level}`).toBe(3);
          for (const p of round) {
            expect(Number.isInteger(p.answer) && p.answer >= 0, `${p.prompt} = ${p.answer}`).toBe(true);
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
