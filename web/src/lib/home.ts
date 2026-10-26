import { ALL_CARDS } from "./content";
import { store } from "./db";
import { dueReviews } from "./engine";
import { dayKey, displayStreak, emptyStreak, weekKey, weeklyRecap, type Recap } from "./progress";

const KEY = "detour.lastBackup";
const DAY = 86_400_000;
/** Remind about backups once there is something worth keeping, then every two weeks. */
export const BACKUP_EVERY_DAYS = 14;
export const MIN_SESSIONS_FOR_NUDGE = 3;

export function getLastBackup(): number | undefined {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export function setLastBackup(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // the nudge simply keeps showing; nothing breaks
  }
}

/** Pure rule for the nudge, so it can be tested. */
export function shouldNudgeBackup(sessions: number, lastBackup: number | undefined, now: number): boolean {
  if (sessions < MIN_SESSIONS_FOR_NUDGE) return false;
  return lastBackup === undefined || now - lastBackup >= BACKUP_EVERY_DAYS * DAY;
}

const RECAP_KEY = "detour.recapSeen";

export function markRecapSeen(now = Date.now()): void {
  try {
    localStorage.setItem(RECAP_KEY, weekKey(dayKey(now)));
  } catch {
    // the prompt may show again; harmless
  }
}

/** The recap is offered on Sundays and Mondays once there is something to show, until the user has looked at it that week. */
export function shouldShowRecap(now: number, cards: number, seenWeek: string | null): boolean {
  const dow = new Date(now).getDay();
  if (dow !== 0 && dow !== 1) return false;
  if (cards < 1) return false;
  return seenWeek !== weekKey(dayKey(now));
}

export type HomeInfo = { dueCount: number; backupNudge: boolean; sessions: number; weekRecap: Recap | null; mathLevel: number; roundSize: number };

export async function loadHomeInfo(now = Date.now()): Promise<HomeInfo> {
  const [reviews, sessions, events, streakState, skills, settings] = await Promise.all([store.getReviews(), store.getSessions(), store.getEvents(), store.getStreak(), store.getSkills(), store.getSettings()]);
  const streak = displayStreak(streakState ?? emptyStreak(), dayKey(now)).current;
  const recap = weeklyRecap(events, streak, now);
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(RECAP_KEY);
  } catch {
    // treated as not seen
  }
  return {
    dueCount: dueReviews(ALL_CARDS, reviews, now).length,
    backupNudge: shouldNudgeBackup(sessions.length, getLastBackup(), now),
    sessions: sessions.length,
    roundSize: settings?.set_size ?? 5,
    mathLevel: skills.find((s) => s.track_id === "mental-math")?.level ?? 1,
    weekRecap: shouldShowRecap(now, recap.cards, seen) ? recap : null,
  };
}
