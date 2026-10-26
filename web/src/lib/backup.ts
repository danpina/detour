import { z } from "zod";
import { INTERESTS } from "@detour/content";
import type { BackupData } from "./db";

export const BACKUP_VERSION = 1;

const num = z.number().finite();
const settings = z.object({ id: z.literal("main"), interests: z.array(z.enum(INTERESTS)), onboarding_done: z.boolean(), set_size: z.number().int().min(3).max(10).optional(), drills: z.boolean().optional(), extras_every: z.number().int().min(1).max(10).optional() });
const event = z.object({
  id: z.number().optional(),
  card_id: z.string(),
  event: z.enum(["view", "complete", "skip", "report"]),
  ms_spent: num,
  at: num,
  reason: z.string().optional(),
  probe_id: z.string().optional(),
  correct: z.boolean().optional(),
});
const session = z.object({ id: z.number().optional(), started_at: num, source: z.enum(["guarded", "free"]), cards_done: num, unlock_granted_min: num });
const review = z.object({
  probe_id: z.string(), card_id: z.string(), due_at: num, stability: num, difficulty: num, elapsed_days: num, scheduled_days: num,
  learning_steps: num, reps: num, lapses: num, state: num, last_review_at: num.optional(),
});
const skill = z.object({
  track_id: z.enum(["mental-math", "estimation", "algebra"]), level: z.number().int().min(1), recent_results: z.array(z.boolean()), attempts_total: num, last_at: num,
});
const streak = z.object({ id: z.literal("main"), current: num, best: num, freezes_left: num, freeze_week: z.string(), last_active_day: z.string() });

const backupSchema = z.object({
  app: z.literal("detour"),
  version: z.literal(BACKUP_VERSION),
  exported_at: num,
  data: z.object({
    settings: settings.optional(),
    events: z.array(event),
    sessions: z.array(session),
    reviews: z.array(review),
    skill_progress: z.array(skill),
    streak: streak.optional(),
  }),
});

export function buildBackup(data: BackupData, now = Date.now()): string {
  return JSON.stringify({ app: "detour", version: BACKUP_VERSION, exported_at: now, data }, null, 2);
}

export type ParsedBackup = { ok: true; data: BackupData; exported_at: number } | { ok: false; error: string };

/** Validates a backup file's text. Never throws. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const r = backupSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `That doesn't look like a Detour backup (${i ? `${i.path.join(".") || "file"}: ${i.message}` : "unknown problem"}).` };
  }
  return { ok: true, data: r.data.data as BackupData, exported_at: r.data.exported_at };
}

export const backupFileName = (now = Date.now()) => `detour-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
