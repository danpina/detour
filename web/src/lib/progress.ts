import type { Card, Interest } from "@detour/content";
import { TRACKS, TRACK_IDS, type SkillProgress } from "./drills";
import type { DetourEvent } from "./db";
import type { ReviewRow } from "./fsrs";

const DAY_MS = 86_400_000;

// ---------- days and weeks (local time) ----------

export const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const utcDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / DAY_MS;
};
export const daysBetween = (a: string, b: string) => Math.round(utcDay(b) - utcDay(a));
export const addDays = (day: string, n: number) => new Date((utcDay(day) + n) * DAY_MS).toISOString().slice(0, 10);

/** Monday of the week containing `day`, as a day string. Streak freezes refill every Monday. */
export const weekKey = (day: string): string => {
  const dow = (new Date(utcDay(day) * DAY_MS).getUTCDay() + 6) % 7;
  return addDays(day, -dow);
};

// ---------- streak with freezes ----------

export const FREEZES_PER_WEEK = 2;
const MAX_GAP_DAYS = 14;

export type StreakState = {
  id: "main";
  current: number;
  best: number;
  freezes_left: number;
  /** The week (Monday) the freezes count belongs to. */
  freeze_week: string;
  last_active_day: string;
};

export const emptyStreak = (): StreakState => ({ id: "main", current: 0, best: 0, freezes_left: FREEZES_PER_WEEK, freeze_week: "", last_active_day: "" });

function refill(s: StreakState, day: string) {
  const wk = weekKey(day);
  if (wk !== s.freeze_week) {
    s.freeze_week = wk;
    s.freezes_left = FREEZES_PER_WEEK;
  }
}

/** Walks the days missed since the last activity, spending a freeze for each one. Breaks the streak when freezes run out. */
function settleGap(s: StreakState, today: string) {
  if (!s.last_active_day) return;
  const missed = daysBetween(s.last_active_day, today) - 1;
  if (missed <= 0) return;
  if (missed > MAX_GAP_DAYS) {
    s.current = 0;
    return;
  }
  for (let k = 1; k <= missed && s.current > 0; k++) {
    refill(s, addDays(s.last_active_day, k));
    if (s.freezes_left > 0) s.freezes_left--;
    else s.current = 0;
  }
}

/** Call when the user does something on `today`. Returns the new state (the input is not mutated). */
export function recordDay(state: StreakState, today: string): StreakState {
  if (state.last_active_day === today) return state;
  const s = { ...state };
  settleGap(s, today);
  refill(s, today);
  s.current += 1;
  s.best = Math.max(s.best, s.current);
  s.last_active_day = today;
  return s;
}

/** The streak to show right now, without recording activity. A missed day shows as still alive while freezes cover it. */
export function displayStreak(state: StreakState, today: string): { current: number; freezes_left: number } {
  if (!state.last_active_day) return { current: 0, freezes_left: FREEZES_PER_WEEK };
  const s = { ...state };
  settleGap(s, today);
  refill(s, today);
  return { current: s.current, freezes_left: s.freezes_left };
}

// ---------- remembered score ----------

export function recallStats(events: DetourEvent[], now: number, days: number): { total: number; correct: number; rate: number | null } {
  const since = now - days * DAY_MS;
  const answers = events.filter((e) => e.event === "complete" && e.probe_id !== undefined && e.correct !== undefined && e.at >= since);
  const correct = answers.filter((e) => e.correct).length;
  return { total: answers.length, correct, rate: answers.length ? correct / answers.length : null };
}

// ---------- knowledge map ----------

/** A probe counts as long-term memory once its stability reaches about three weeks. */
export const LONG_TERM_DAYS = 21;
export type CardState = "new" | "seen" | "learning" | "solid";

export function cardState(card: Card, completed: Set<string>, reviews: Map<string, ReviewRow>): CardState {
  if (!completed.has(card.id)) return "new";
  const rows = card.probes.map((p) => reviews.get(p.id));
  if (rows.every((r) => r && r.reps > 0 && r.stability >= LONG_TERM_DAYS)) return "solid";
  if (rows.some((r) => r && r.reps > 0)) return "learning";
  return "seen";
}

export function knowledgeMap(cards: Card[], completed: Set<string>, reviews: ReviewRow[]) {
  const byProbe = new Map(reviews.map((r) => [r.probe_id, r]));
  const out = new Map<Interest, { id: string; state: CardState }[]>();
  for (const c of cards) {
    if (c.type === "drill" || c.type === "recall") continue;
    const list = out.get(c.interest) ?? [];
    list.push({ id: c.id, state: cardState(c, completed, byProbe) });
    out.set(c.interest, list);
  }
  return out;
}

// ---------- skills ----------

export function skillSummary(rows: SkillProgress[]) {
  return TRACK_IDS.map((id) => {
    const p = rows.find((r) => r.track_id === id);
    const t = TRACKS[id];
    return {
      id,
      name: t.name,
      level: p?.level ?? 1,
      maxLevel: t.maxLevel,
      levelName: t.levels[(p?.level ?? 1) - 1]!,
      recentRight: p?.recent_results.filter(Boolean).length ?? 0,
      recentTotal: p?.recent_results.length ?? 0,
      attempts: p?.attempts_total ?? 0,
    };
  });
}

// ---------- weekly recap ----------

export type Recap = { cards: number; recallRate: number | null; recallAnswers: number; minutes: number; streak: number; days: number };

export function weeklyRecap(events: DetourEvent[], streak: number, now: number): Recap {
  const since = now - 7 * DAY_MS;
  const done = events.filter((e) => e.event === "complete" && e.at >= since && !e.card_id.startsWith("drill:"));
  const stats = recallStats(events, now, 7);
  const days = new Set(events.filter((e) => e.event === "complete" && e.at >= since).map((e) => dayKey(e.at))).size;
  return {
    cards: done.length,
    recallRate: stats.rate,
    recallAnswers: stats.total,
    minutes: Math.round(events.filter((e) => e.event === "complete" && e.at >= since).reduce((s, e) => s + e.ms_spent, 0) / 60_000),
    streak,
    days,
  };
}

// ---------- housekeeping ----------

/** Events are only kept for about 90 days. */
export const EVENT_RETENTION_DAYS = 90;
