import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./languageData";
import { applyAnswer, blanked, buildRound, kindFor, unlockedLevel, type Progress } from "./languageLogic";

// The rounds are checked on Spanish; the data checks below run for every language.
const WORDS = LANGUAGES[0]!.words;

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const empty: Progress = { known: {}, missed: [] };

describe("language data", () => {
  for (const lang of LANGUAGES) {
    it(lang.name + ": unique keys, every example contains its word, enough words to open each level", () => {
      expect(new Set(lang.words.map((w) => w.key)).size).toBe(lang.words.length);
      for (const w of lang.words) {
        expect(blanked(w), w.key).not.toBeNull();
        expect(w.word && w.en && w.ex && w.exEn, w.key).toBeTruthy();
      }
      for (const level of [1, 2, 3]) expect(lang.words.filter((w) => w.level === level).length, "level " + level).toBeGreaterThanOrEqual(12);
    });

    it(lang.name + ": a round can be built and every answer is among the options", () => {
      const round = buildRound(lang.words, empty, seeded(), 8);
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

  it("opens harder levels as words are learned", () => {
    expect(unlockedLevel(empty, WORDS)).toBe(1);
    const known = Object.fromEntries(WORDS.slice(0, 12).map((w) => [w.key, 2]));
    expect(unlockedLevel({ known, missed: [] }, WORDS)).toBe(2);
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
