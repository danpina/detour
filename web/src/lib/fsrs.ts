import { createEmptyCard, default_w, fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { Probe } from "@detour/content";

/**
 * Scheduler parameters. These are written to /content/fsrs-test-vectors.json so the Swift port can match them.
 * Short-term (minute-level) learning steps are OFF: Detour reviews are daily-scale recall checks, not drills.
 * Fuzz is OFF so schedules are deterministic and identical across platforms.
 */
export const FSRS_PARAMS = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: false,
  w: [...default_w],
};

const scheduler = fsrs(generatorParameters(FSRS_PARAMS));

export type ReviewRow = {
  probe_id: string;
  card_id: string;
  /** ms since epoch */
  due_at: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: number;
  last_review_at?: number;
};

// ---------- automatic rating ----------

/** Answers at or under these times count as "fast". Slower correct answers are "Good". */
export const FAST_MS: Record<Probe["kind"], number> = {
  tf: 3_000,
  mcq: 6_000,
  cloze: 10_000,
  estimate: 8_000,
};

/** right + fast = Easy, right + slow = Good, wrong = Again. No self-rating. */
export function ratingFor(kind: Probe["kind"], correct: boolean, ms: number): Grade {
  if (!correct) return Rating.Again;
  return ms <= FAST_MS[kind] ? Rating.Easy : Rating.Good;
}

// ---------- scheduling ----------

const toFsrs = (r: ReviewRow): FsrsCard => ({
  due: new Date(r.due_at),
  stability: r.stability,
  difficulty: r.difficulty,
  elapsed_days: r.elapsed_days,
  scheduled_days: r.scheduled_days,
  learning_steps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  state: r.state as State,
  last_review: r.last_review_at === undefined ? undefined : new Date(r.last_review_at),
});

const fromFsrs = (c: FsrsCard, probe_id: string, card_id: string): ReviewRow => ({
  probe_id,
  card_id,
  due_at: c.due.getTime(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  ...(c.last_review ? { last_review_at: c.last_review.getTime() } : {}),
});

/** First recall check for a probe: due tomorrow ("we'll check tomorrow if they stuck"), state New. */
export function newReview(probe_id: string, card_id: string, now: number): ReviewRow {
  const empty = createEmptyCard(new Date(now));
  return { ...fromFsrs(empty, probe_id, card_id), due_at: tomorrowStart(now) };
}

/** Start of the next local day, pushed one more day out if that is under 6 hours away. */
export function tomorrowStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  if (d.getTime() - now < 6 * 3_600_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function applyReview(row: ReviewRow, rating: Grade, now: number): ReviewRow {
  const next = scheduler.next(toFsrs(row), new Date(now), rating).card;
  return fromFsrs(next, row.probe_id, row.card_id);
}

export { Rating };
