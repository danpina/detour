import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "./content";
import { cardParagraphs, filterLearned, learnedAgo, learnedCards } from "./learned";

const DAY = 86_400_000;
const readable = ALL_CARDS.filter((c) => c.type !== "drill" && c.type !== "recall");

describe("what you've learned", () => {
  it("lists completed cards newest first, once each, and ignores everything else", () => {
    const [a, b, c] = readable;
    const events = [
      { card_id: a!.id, event: "complete" as const, at: 1_000 },
      { card_id: b!.id, event: "complete" as const, at: 5_000 },
      { card_id: a!.id, event: "complete" as const, at: 9_000 },
      { card_id: c!.id, event: "view" as const, at: 7_000 },
      { card_id: c!.id, event: "skip" as const, at: 8_000 },
    ];
    const rows = learnedCards(ALL_CARDS, events, []);
    expect(rows.map((r) => r.card.id)).toEqual([b!.id, a!.id]);
    expect(rows[1]!.learnedAt).toBe(1_000);
    expect(rows.every((r) => r.state === "seen")).toBe(true);
  });

  it("has readable text for every kind of card", () => {
    for (const card of readable) {
      const text = cardParagraphs(card);
      expect(text.length, card.id).toBeGreaterThan(0);
      expect(text.join(" "), card.id).not.toMatch(/undefined|NaN/);
    }
  });

  it("searches by every word in the title or text, and by topic", () => {
    const rows = readable.slice(0, 40).map((card, i) => ({ card, learnedAt: i, state: "seen" as const }));
    const first = rows[0]!;
    const word = first.card.title.split(/\s+/).find((w) => w.length > 4) ?? first.card.title;
    const hits = filterLearned(rows, word.toUpperCase(), "all");
    expect(hits.some((r) => r.card.id === first.card.id)).toBe(true);
    expect(filterLearned(rows, "zzzzqqqq", "all")).toEqual([]);
    expect(filterLearned(rows, "", "all")).toHaveLength(rows.length);
    const topic = first.card.interest;
    expect(filterLearned(rows, "", topic).every((r) => r.card.interest === topic)).toBe(true);
  });

  it("says how long ago in plain words", () => {
    const now = 100 * DAY;
    expect(learnedAgo(now - 3_600_000, now)).toBe("today");
    expect(learnedAgo(now - DAY, now)).toBe("yesterday");
    expect(learnedAgo(now - 5 * DAY, now)).toBe("5 days ago");
    expect(learnedAgo(now - 21 * DAY, now)).toBe("3 weeks ago");
    expect(learnedAgo(now - 95 * DAY, now)).toBe("3 months ago");
  });
});
