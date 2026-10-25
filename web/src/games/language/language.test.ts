import { describe, expect, it } from "vitest";
import { LANGUAGES, wordCount } from "./languageData";
import { applyAnswer, blanked, buildRound, kindFor, type Progress } from "./languageLogic";

// The rounds are checked on Spanish; the data checks below run for every language.
const WORDS = await LANGUAGES[0]!.load();

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const empty: Progress = { known: {}, missed: [] };

describe("language data", () => {
  for (const lang of LANGUAGES) {
    it(lang.name + ": unique keys, every example contains its word, enough words to open each level", async () => {
      const words = await lang.load();
      expect(new Set(words.map((w) => w.key)).size).toBe(words.length);
      for (const w of words) {
        expect(blanked(w), w.key).not.toBeNull();
        expect(w.word && w.en && w.ex && w.exEn, w.key).toBeTruthy();
      }
      for (const level of [1, 2, 3] as const) {
        const n = words.filter((w) => w.level === level).length;
        expect(n, "level " + level).toBeGreaterThanOrEqual(250);
        expect(wordCount(lang, level), "the counts file is up to date: run language-gen").toBe(n);
      }
    });

    it(lang.name + ": a round can be built and every answer is among the options", async () => {
      const round = buildRound(await lang.load(), empty, seeded(), 8);
      expect(round).toHaveLength(8);
      for (const q of round) expect(q.options).toContain(q.answer);
    });
  }
});

describe("language rounds (Spanish)", () => {
  it("starts with recognition at level 1 and never repeats a word", () => {
    const round = buildRound(WORDS, empty, seeded(), 5);
    expect(round).toHaveLength(5);
    expect(new Set(round.map((q) => q.key)).size).toBe(5);
    for (const q of round) {
      expect(q.kind).toBe("toEn");
      expect(WORDS.find((w) => w.key === q.key)!.level).toBe(1);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("brings missed words back first", () => {
    const round = buildRound(WORDS, { known: {}, missed: ["queso"] }, seeded(), 2);
    expect(round.map((q) => q.key)).toContain("queso");
  });

  it("moves from recognising to recalling to using in a sentence", () => {
    expect([kindFor(0), kindFor(1), kindFor(2)]).toEqual(["toEn", "toWord", "cloze"]);
    const known: Record<string, number> = { gato: 2 };
    const q = buildRound(WORDS, { known, missed: ["gato"] }, seeded(), 1)[0]!;
    expect(q.kind).toBe("cloze");
    expect(q.prompt).toContain("____");
  });

  it("asks only the chosen level, and offers only words of that level as answers", () => {
    for (const level of [1, 2] as const) {
      const round = buildRound(WORDS, empty, seeded(), 6, level);
      const pool = WORDS.filter((w) => w.level === level);
      const meanings = new Set(pool.flatMap((w) => [w.en, w.word, w.key]));
      expect(round).toHaveLength(6);
      for (const q of round) {
        expect(pool.some((w) => w.key === q.key)).toBe(true);
        for (const o of q.options) expect(meanings.has(o), o).toBe(true);
      }
    }
  });

  it("counts right answers up and queues wrong ones", () => {
    let p = applyAnswer(empty, "gato", true);
    expect(p.known.gato).toBe(1);
    p = applyAnswer(p, "gato", false);
    expect(p.known.gato).toBe(0);
    expect(p.missed).toEqual(["gato"]);
    p = applyAnswer(p, "gato", true);
    expect(p.missed).toEqual([]);
  });
});
