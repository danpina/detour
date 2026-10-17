import { ALL_CARDS } from "./content";
import { store } from "./db";
import { dueReviews } from "./engine";

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

export type HomeInfo = { dueCount: number; backupNudge: boolean };

export async function loadHomeInfo(now = Date.now()): Promise<HomeInfo> {
  const [reviews, sessions] = await Promise.all([store.getReviews(), store.getSessions()]);
  return {
    dueCount: dueReviews(ALL_CARDS, reviews, now).length,
    backupNudge: shouldNudgeBackup(sessions.length, getLastBackup(), now),
  };
}
