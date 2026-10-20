import { describe, expect, it } from "vitest";
import type { Card, Interest } from "@detour/content";
import { buildSession, dueReviews, engagementFrom, reviewTarget, type SessionItem } from "./engine";
import { newReview, type ReviewRow } from "./fsrs";

const NOW = new Date("2026-10-20T10:00:00Z").getTime();
const DAY = 86_400_000;

const card = (id: string, interest: Interest = "science", type: Card["type"] = "fact_why"): Card =>
  ({
    id,
    interest,
    type,
    title: id,
    probes: [{ id: `${id}-p1`, kind: "tf", question: "q?", answer: true }],
    sources: [{ title: "s", url: "https://example.com" }],
  }) as unknown as Card;

const review = (c: Card, dueOffsetDays: number): ReviewRow => ({ ...newReview(`${c.id}-p1`, c.id, NOW), due_at: NOW + dueOffsetDays * DAY });
const kinds = (items: SessionItem[]) => items.map((i) => i.kind);
const ids = (items: SessionItem[]) => items.map((i) => (i.kind === "drill" ? `drill:${i.drill.track}` : i.card.id));

const pool = [
  card("sci-0001"), card("sci-0002", "science", "estimate"), card("hist-0001", "history", "story"), card("hist-0002", "history", "guess_first"),
  card("money-0001", "money", "story"), card("tech-0001", "tech", "story"), card("num-0001", "numbers", "estimate"), card("mind-0001", "mind"),
];
const drill = { track: "mental-math", level: 1, seed: 1 } as const;
const base = { cards: pool, completed: new Set<string>(), interests: ["science", "history", "money"] as Interest[], now: NOW };

describe("session mix", () => {
  it("is 2 reviews + 2 new + 1 drill when everything is available", () => {
    const done = new Set(["sci-0001", "sci-0002", "hist-0001"]);
    const reviews = [review(pool[0]!, -1), review(pool[1]!, -2), review(pool[2]!, -0.5)];
    const items = buildSession({ ...base, completed: done, reviews, makeDrill: () => drill });
    expect(items).toHaveLength(5);
    expect(items.filter((i) => i.kind === "review")).toHaveLength(2);
    expect(items.filter((i) => i.kind === "new")).toHaveLength(2);
    expect(items.filter((i) => i.kind === "drill")).toHaveLength(1);
    expect(items.at(-1)!.kind).toBe("drill");
    expect(new Set(ids(items)).size).toBe(5);
  });

  it("serves the most overdue reviews first", () => {
    const reviews = [review(pool[0]!, -1), review(pool[1]!, -5), review(pool[2]!, -3)];
    const items = buildSession({ ...base, completed: new Set(["sci-0001", "sci-0002", "hist-0001"]), reviews, makeDrill: () => drill });
    const rv = ids(items.filter((i) => i.kind === "review"));
    expect(rv).toEqual(["sci-0002", "hist-0001"]);
  });

  it("alternates review and new, starting with a review", () => {
    const reviews = [review(pool[0]!, -1), review(pool[1]!, -2)];
    const items = buildSession({ ...base, completed: new Set(["sci-0001", "sci-0002"]), reviews, makeDrill: () => drill });
    expect(kinds(items)).toEqual(["review", "new", "review", "new", "drill"]);
  });
});

describe("fallbacks", () => {
  it("fills empty review slots with new cards when nothing is due", () => {
    const items = buildSession({ ...base, reviews: [], makeDrill: () => drill });
    expect(kinds(items)).toEqual(["new", "new", "new", "new", "drill"]);
  });

  it("does not serve reviews that are not due yet", () => {
    const items = buildSession({ ...base, completed: new Set(["sci-0001"]), reviews: [review(pool[0]!, +1)], makeDrill: () => drill });
    expect(items.some((i) => i.kind === "review")).toBe(false);
    expect(ids(items)).not.toContain("sci-0001");
  });

  it("gives the drill slot to other content when no drill is available", () => {
    const items = buildSession({ ...base, reviews: [] });
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.kind === "new")).toBe(true);
  });

  it("uses extra due reviews when there are not enough new cards", () => {
    const only = pool.slice(0, 5);
    const done = new Set(only.map((c) => c.id));
    const reviews = only.map((c, i) => review(c, -(i + 1)));
    const items = buildSession({ ...base, cards: only, completed: done, reviews, interests: ["science"], makeDrill: () => drill });
    expect(items.filter((i) => i.kind === "review").length).toBeGreaterThanOrEqual(2);
    expect(items).toHaveLength(5);
    expect(new Set(ids(items)).size).toBe(5);
  });

  it("repeats seen cards instead of returning a tiny set", () => {
    const only = pool.slice(0, 3);
    const items = buildSession({ ...base, cards: only, completed: new Set(only.map((c) => c.id)), reviews: [] });
    expect(items).toHaveLength(3);
  });

  it("never returns two probes of the same card", () => {
    const c = pool[0]!;
    const two = { ...c, probes: [...c.probes, { id: "sci-0001-p2", kind: "tf", question: "q2?", answer: false }] } as Card;
    const reviews = [review(two, -2), { ...review(two, -1), probe_id: "sci-0001-p2" }];
    const due = dueReviews([two], reviews, NOW);
    expect(due).toHaveLength(1);
    expect(due[0]!.probe.id).toBe("sci-0001-p1");
  });
});

describe("backlog and engagement", () => {
  it("moves toward ~50% reviews on a big backlog", () => {
    expect(reviewTarget(0, 5)).toBe(2);
    expect(reviewTarget(6, 5)).toBe(3);
    const many = Array.from({ length: 8 }, (_, i) => card(`sci-${String(i + 10).padStart(4, "0")}`));
    const reviews = many.map((c, i) => review(c, -(i + 1)));
    const items = buildSession({ ...base, cards: [...many, ...pool], completed: new Set(many.map((c) => c.id)), reviews, makeDrill: () => drill });
    expect(items.filter((i) => i.kind === "review")).toHaveLength(3);
  });

  it("shows the interest the user engages with first", () => {
    const eng = engagementFrom(
      [
        { card_id: "hist-0001", event: "complete" }, { card_id: "hist-0002", event: "complete" },
        { card_id: "sci-0001", event: "skip" }, { card_id: "sci-0002", event: "skip" },
      ],
      pool,
    );
    expect(eng).toEqual({ history: 1, science: 0 });
    const items = buildSession({ ...base, reviews: [], engagement: eng, interests: ["science", "history"] });
    const first = items[0]!;
    expect(first.kind !== "drill" && first.card.interest).toBe("history");
  });
});

describe("not showing the same card again", () => {
  it("prefers cards shown longest ago, so skipping a card does not bring it straight back", () => {
    const interests: Interest[] = ["science"];
    const first = buildSession({ ...base, interests, reviews: [], setSize: 2 });
    expect(ids(first)).toEqual(["sci-0001", "sci-0002"]);
    // Both were viewed (but not completed): the next set should not start with them again if others exist.
    const more = [...pool, card("sci-0003"), card("sci-0004", "science", "estimate")];
    const lastShown = new Map([["sci-0001", NOW - 1000], ["sci-0002", NOW - 500]]);
    const next = buildSession({ ...base, cards: more, interests, reviews: [], setSize: 2, lastShown });
    expect(ids(next)).toEqual(["sci-0003", "sci-0004"]);
  });
  it("falls back to the least recently shown when everything has been shown", () => {
    const interests: Interest[] = ["science"];
    const lastShown = new Map([["sci-0001", NOW - 5000], ["sci-0002", NOW - 1000]]);
    const next = buildSession({ ...base, interests, reviews: [], setSize: 1, lastShown, completed: new Set(["sci-0001", "sci-0002"]) });
    expect(ids(next)).toEqual(["sci-0001"]);
  });
});
