import type { Card, Interest } from "@detour/content";
import { ALL_CARDS } from "./content";
import { buildSession, engagementFrom, DEFAULT_SET_SIZE, type SessionItem } from "./engine";
import { applyReview, newReview, ratingFor } from "./fsrs";
import { store } from "./db";

/** Loads local history and builds the next set. Used for quick sets and for each page of the free-scroll feed. */
export async function nextSet(interests: Interest[], setSize = DEFAULT_SET_SIZE, makeDrill?: () => Card | undefined): Promise<SessionItem[]> {
  const [reviews, completed, events] = await Promise.all([store.getReviews(), store.completedCardIds(), store.getEvents()]);
  return buildSession({
    cards: ALL_CARDS,
    reviews,
    completed,
    interests,
    engagement: engagementFrom(events, ALL_CARDS),
    now: Date.now(),
    setSize,
    makeDrill,
  });
}

/**
 * Persists what happened on a card.
 * - New card finished: its probes are scheduled for tomorrow ("we'll check tomorrow if they stuck").
 * - Review answered: the answer is rated automatically (right+fast Easy, right+slow Good, wrong Again) and rescheduled.
 */
export async function recordCompletion(item: SessionItem, result: { correct?: boolean; ms: number }, now = Date.now()): Promise<void> {
  if (item.kind === "new") {
    for (const probe of item.card.probes) {
      if (!(await store.getReview(probe.id))) await store.putReview(newReview(probe.id, item.card.id, now));
    }
    return;
  }
  if (item.kind === "review") {
    const current = (await store.getReview(item.probe.id)) ?? item.review;
    const rating = ratingFor(item.probe.kind, result.correct ?? false, result.ms);
    await store.putReview(applyReview(current, rating, now));
  }
}
