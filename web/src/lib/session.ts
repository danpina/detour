import type { Interest } from "@detour/content";
import { ALL_CARDS } from "./content";
import { emptyProgress, applyResults, nextTrack, TRACK_IDS, type SkillProgress, type TrackId } from "./drills";
import { buildSession, engagementFrom, DEFAULT_SET_SIZE, type SessionItem } from "./engine";

/** When each card was last shown, from the local view events. */
export function lastShownFrom(events: { card_id: string; event: string; at: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) {
    if (e.event !== "view") continue;
    if ((out.get(e.card_id) ?? 0) < e.at) out.set(e.card_id, e.at);
  }
  return out;
}
import { applyReview, newReview, ratingFor } from "./fsrs";
import { store } from "./db";
import { GAME_IDS, type GameId } from "../games/ids";
import { ALL_CARDS as CARDS } from "./content";
import { dayKey, displayStreak, emptyStreak, knowledgeMap, recallStats, recordDay, skillSummary, weeklyRecap } from "./progress";

/** The three kinds of round on the home screen. Each has its own place: cards, math, or games. */
export type RoundKind = "learning" | "math" | "games";

/** Distinct random games, so a round never plays the same one twice. Each plays a single puzzle. */
export function pickGames(count = DEFAULT_SET_SIZE, rng: () => number = Math.random): GameId[] {
  const pool = [...GAME_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

/**
 * A math round of `size` problems: a mental-math drill, then one more skill (the one practised least recently), each at the
 * player's level. The problems are split between the two, the first getting the extra one when the size is odd.
 */
export function mathRound(skills: SkillProgress[], size = DEFAULT_SET_SIZE, seed: () => number = () => Math.floor(Math.random() * 2 ** 31)): SessionItem[] {
  const levelOf = (track: TrackId) => skills.find((s) => s.track_id === track)?.level ?? 1;
  const second = nextTrack(skills, TRACK_IDS.filter((t) => t !== "mental-math"));
  const first = Math.ceil(size / 2);
  const counts: [TrackId, number][] = [["mental-math", first], [second, size - first]];
  return counts
    .filter(([, count]) => count > 0)
    .map(([track, count]) => ({ kind: "drill" as const, drill: { track, level: levelOf(track), seed: seed(), count } }));
}

/** Loads local history and builds the next round of the given kind. Used for quick rounds and for each page of the free-scroll feed. */
export async function nextSet(interests: Interest[], kind: RoundKind = "learning", sizeOverride?: number): Promise<SessionItem[]> {
  // One setting sets the length of every round: N cards, N math problems or N games.
  const settings = await store.getSettings();
  const setSize = sizeOverride ?? settings?.set_size ?? DEFAULT_SET_SIZE;
  if (kind === "games") return pickGames(setSize).map((game) => ({ kind: "game" as const, game }));
  if (kind === "math") return mathRound(await store.getSkills(), setSize);
  const [reviews, completed, events] = await Promise.all([store.getReviews(), store.completedCardIds(), store.getEvents()]);
  // A learning round is cards only: reviews of what you learned, and new cards from your topics.
  return buildSession({
    cards: ALL_CARDS,
    reviews,
    completed,
    interests,
    engagement: engagementFrom(events, ALL_CARDS),
    lastShown: lastShownFrom(events),
    now: Date.now(),
    setSize,
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