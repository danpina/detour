import type { Card, Interest, Probe } from "@detour/content";
import { pickSet } from "./pickSet";
import type { ReviewRow } from "./fsrs";

export type SessionItem =
  | { kind: "review"; card: Card; probe: Probe; review: ReviewRow }
  | { kind: "new"; card: Card }
  | { kind: "drill"; card: Card };

export type EngineInput = {
  cards: Card[];
  reviews: ReviewRow[];
  /** Card ids the user has already completed. */
  completed: Set<string>;
  interests: Interest[];
  /** 0..1 per interest, from completion vs skip history. Higher = shown first. */
  engagement?: Partial<Record<Interest, number>>;
  now: number;
  setSize?: number;
  /** Provides the next skill-drill card (Step 8). Without it the drill slot goes to other content. */
  makeDrill?: () => Card | undefined;
};

export const DEFAULT_SET_SIZE = 5;

/** Base mix is 2 reviews + 2 new + 1 drill; a big backlog nudges reviews toward ~50% of the set. */
export function reviewTarget(dueCount: number, setSize: number): number {
  const base = Math.round(setSize * 0.4);
  return dueCount > setSize ? Math.min(setSize - 1, base + 1) : base;
}

/** Due probes, most overdue first, at most one per card. */
export function dueReviews(cards: Card[], reviews: ReviewRow[], now: number) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out: { card: Card; probe: Probe; review: ReviewRow }[] = [];
  const seenCards = new Set<string>();
  for (const r of [...reviews].filter((r) => r.due_at <= now).sort((a, b) => a.due_at - b.due_at)) {
    const card = byId.get(r.card_id);
    const probe = card?.probes.find((p) => p.id === r.probe_id);
    if (!card || !probe || seenCards.has(card.id)) continue;
    seenCards.add(card.id);
    out.push({ card, probe, review: r });
  }
  return out;
}

/** Engagement per interest = completed / (completed + skipped), 0.5 when unknown. */
export function engagementFrom(events: { card_id: string; event: string }[], cards: Card[]): Partial<Record<Interest, number>> {
  const interestOf = new Map(cards.map((c) => [c.id, c.interest]));
  const tally: Partial<Record<Interest, { done: number; skip: number }>> = {};
  for (const e of events) {
    const i = interestOf.get(e.card_id);
    if (!i || (e.event !== "complete" && e.event !== "skip")) continue;
    const t = (tally[i] ??= { done: 0, skip: 0 });
    if (e.event === "complete") t.done++;
    else t.skip++;
  }
  const out: Partial<Record<Interest, number>> = {};
  for (const [i, t] of Object.entries(tally) as [Interest, { done: number; skip: number }][]) out[i] = t.done / (t.done + t.skip);
  return out;
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]!);
    if (b[i]) out.push(b[i]!);
  }
  return out;
}

/**
 * Builds one set. Slots: reviews (most overdue first), new cards from the user's interests, one skill drill.
 * Empty review slots fill with new cards; empty new slots fill with more due reviews, then with seen cards.
 * Reviews and new cards alternate (a review first), with the drill last.
 */
export function buildSession(input: EngineInput): SessionItem[] {
  const { cards, reviews, completed, interests, now, makeDrill } = input;
  const setSize = input.setSize ?? DEFAULT_SET_SIZE;

  const due = dueReviews(cards, reviews, now);
  const drill = makeDrill?.();
  const drillCount = drill ? 1 : 0;

  const reviewCount = Math.min(reviewTarget(due.length, setSize), due.length);
  const chosenReviews = due.slice(0, reviewCount);
  const used = new Set(chosenReviews.map((r) => r.card.id));

  // Interests the user engages with most come first.
  const eng = input.engagement ?? {};
  const ordered = [...interests].sort((a, b) => (eng[b] ?? 0.5) - (eng[a] ?? 0.5));

  const newNeeded = setSize - chosenReviews.length - drillCount;
  const seen = new Set([...completed, ...reviews.map((r) => r.card_id)]);
  let news = pickSet(cards, ordered, seen, newNeeded, { allowSeen: false, exclude: used });

  const reviewItems: SessionItem[] = chosenReviews.map((r) => ({ kind: "review", ...r }));
  const newItems: SessionItem[] = news.map((card) => ({ kind: "new", card }));

  // Not enough unseen cards: pull extra due reviews.
  let short = newNeeded - news.length;
  for (const r of due.slice(reviewCount)) {
    if (short <= 0) break;
    reviewItems.push({ kind: "review", ...r });
    used.add(r.card.id);
    short--;
  }

  // Still short: repeat seen cards rather than showing a tiny set.
  if (short > 0) {
    const taken = new Set([...used, ...news.map((c) => c.id)]);
    news = pickSet(cards, ordered, new Set(), short, { allowSeen: true, exclude: taken });
    newItems.push(...news.map((card) => ({ kind: "new" as const, card })));
  }

  const items = interleave(reviewItems, newItems);
  if (drill) items.push({ kind: "drill", card: drill });
  return items;
}
