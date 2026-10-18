import type { Interest } from "@detour/content";
import { ALL_CARDS } from "./content";
import { emptyProgress, applyResults, nextTrack, type DrillSpec, type SkillProgress, type TrackId } from "./drills";
import { buildSession, engagementFrom, DEFAULT_SET_SIZE, type SessionItem } from "./engine";
import { applyReview, newReview, ratingFor } from "./fsrs";
import { store } from "./db";
import { ALL_CARDS as CARDS } from "./content";
import { dayKey, displayStreak, emptyStreak, knowledgeMap, recallStats, recordDay, skillSummary, weeklyRecap } from "./progress";

/** Loads local history and builds the next set. Used for quick sets and for each page of the free-scroll feed. */
export async function nextSet(interests: Interest[], sizeOverride?: number): Promise<SessionItem[]> {
  const setSize = sizeOverride ?? (await store.getSettings())?.set_size ?? DEFAULT_SET_SIZE;
  const [reviews, completed, events, skills] = await Promise.all([store.getReviews(), store.completedCardIds(), store.getEvents(), store.getSkills()]);
  const track = nextTrack(skills);
  const level = skills.find((s) => s.track_id === track)?.level ?? 1;
  const drill: DrillSpec = { track, level, seed: Math.floor(Math.random() * 2 ** 31) };
  return buildSession({
    cards: ALL_CARDS,
    reviews,
    completed,
    interests,
    engagement: engagementFrom(events, ALL_CARDS),
    now: Date.now(),
    setSize,
    makeDrill: () => drill,
  });
}

/** Saves a finished drill round: updates the track\u0027s recent results and level. */
export async function recordDrillRound(track: TrackId, results: boolean[], now = Date.now()): Promise<{ progress: SkillProgress; leveledUp: boolean }> {
  const current = (await store.getSkills()).find((s) => s.track_id === track) ?? emptyProgress(track);
  const out = applyResults(current, results, now);
  await store.putSkill(out.progress);
  return out;
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

/** Marks today as active for the streak. Safe to call many times a day. */
export async function recordActivity(now = Date.now()): Promise<void> {
  const current = (await store.getStreak()) ?? emptyStreak();
  const next = recordDay(current, dayKey(now));
  if (next !== current) await store.putStreak(next);
}

/** Everything the Progress screen shows, computed from local data. */
export async function loadProgress(now = Date.now()) {
  const [events, reviews, completed, skills, streakState] = await Promise.all([
    store.getEvents(),
    store.getReviews(),
    store.completedCardIds(),
    store.getSkills(),
    store.getStreak(),
  ]);
  const streak = streakState ?? emptyStreak();
  const shown = displayStreak(streak, dayKey(now));
  return {
    streak: { current: shown.current, best: Math.max(streak.best, shown.current), freezesLeft: shown.freezes_left },
    recall: recallStats(events, now, 30),
    map: knowledgeMap(CARDS, completed, reviews),
    skills: skillSummary(skills),
    recap: weeklyRecap(events, shown.current, now),
    reviewsScheduled: reviews.length,
  };
}