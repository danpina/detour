import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, parseBackup } from "./backup";
import type { BackupData } from "./db";

const data: BackupData = {
  settings: { id: "main", interests: ["history", "science", "money"], onboarding_done: true },
  events: [{ id: 3, card_id: "sci-0001", event: "complete", ms_spent: 4200, at: 1_700_000_000_000, probe_id: "sci-0001-p1", correct: true }],
  sessions: [{ id: 1, started_at: 1_700_000_000_000, source: "free", cards_done: 5, unlock_granted_min: 0 }],
  reviews: [{ probe_id: "sci-0001-p1", card_id: "sci-0001", due_at: 1_700_100_000_000, stability: 4.2, difficulty: 5.1, elapsed_days: 1, scheduled_days: 4, learning_steps: 0, reps: 2, lapses: 0, state: 2, last_review_at: 1_700_000_000_000 }],
  skill_progress: [{ track_id: "mental-math", level: 2, recent_results: [true, false, true], attempts_total: 23, last_at: 1_700_000_000_000 }],
  streak: { id: "main", current: 3, best: 5, freezes_left: 1, freeze_week: "2026-10-12", last_active_day: "2026-10-14" },
};

describe("backup", () => {
  it("round-trips everything", () => {
    const r = parseBackup(buildBackup(data, 123));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual(data);
      expect(r.exported_at).toBe(123);
    }
  });

  it("accepts a fresh device with no settings or streak", () => {
    const r = parseBackup(buildBackup({ events: [], sessions: [], reviews: [], skill_progress: [] }));
    expect(r.ok).toBe(true);
  });

  it("rejects things that are not Detour backups, with a friendly message", () => {
    expect(parseBackup("not json").ok).toBe(false);
    const wrongApp = parseBackup(JSON.stringify({ app: "other", version: 1, exported_at: 1, data: {} }));
    expect(wrongApp.ok).toBe(false);
    const bad = JSON.parse(buildBackup(data));
    bad.data.reviews[0].stability = "lots";
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Detour backup/);
  });

  it("rejects a newer, unknown version", () => {
    const next = JSON.parse(buildBackup(data));
    next.version = 2;
    expect(parseBackup(JSON.stringify(next)).ok).toBe(false);
  });

  it("names the file by date", () => {
    expect(backupFileName(Date.UTC(2026, 9, 17))).toBe("detour-progress-2026-10-17.json");
  });
});
