import Dexie, { type Table } from "dexie";
import type { Interest } from "@detour/content";
import type { SkillProgress } from "./drills";
import type { ReviewRow } from "./fsrs";
import type { StreakState } from "./progress";

export type Settings = {
  id: "main";
  interests: Interest[];
  onboarding_done: boolean;
  /** Cards per set (3, 5 or 8). Defaults to 5. */
  set_size?: number;
  /** Skill drills at the end of a set. Unset means: on only if Numbers & Logic is one of the chosen topics. */
  drills?: boolean;
  /** How often the extras (mental math, estimation, games) join a set: every Nth set. Defaults to 3. */
  extras_every?: number;
};

export type DetourEvent = {
  id?: number;
  card_id: string;
  event: "view" | "complete" | "skip" | "report";
  ms_spent: number;
  at: number;
  /** Fixed reason codes only (never free text). */
  reason?: string;
  /** For recall answers: which probe, and whether it was answered correctly. */
  probe_id?: string;
  correct?: boolean;
};

export type SessionRow = {
  id?: number;
  started_at: number;
  source: "guarded" | "free";
  cards_done: number;
  unlock_granted_min: number;
};

export type BackupData = {
  settings?: Settings;
  events: DetourEvent[];
  sessions: SessionRow[];
  reviews: ReviewRow[];
  skill_progress: SkillProgress[];
  streak?: StreakState;
};

class DetourDB extends Dexie {
  settings!: Table<Settings, string>;
  events!: Table<DetourEvent, number>;
  sessions!: Table<SessionRow, number>;
  reviews!: Table<ReviewRow, string>;
  skill_progress!: Table<SkillProgress, string>;
  streak!: Table<StreakState, string>;

  constructor() {
    super("detour");
    this.version(1).stores({
      settings: "id",
      events: "++id, card_id, event, at",
      sessions: "++id, started_at",
    });
    this.version(2).stores({
      reviews: "probe_id, card_id, due_at",
    });
    this.version(3).stores({
      skill_progress: "track_id",
    });
    this.version(4).stores({
      streak: "id",
    });
  }
}

let db: DetourDB | null = null;
try {
  db = new DetourDB();
} catch (e) {
  console.warn("Storage unavailable; running without saving progress.", e);
}

// In-memory fallbacks so the app still works when IndexedDB is blocked (rule 7).
const mem = { settings: undefined as Settings | undefined, events: [] as DetourEvent[], sessions: [] as SessionRow[], reviews: new Map<string, ReviewRow>(), skills: new Map<string, SkillProgress>(), streak: undefined as StreakState | undefined };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    if (!db) return fallback;
    return await fn();
  } catch (e) {
    console.warn("Storage error", e);
    return fallback;
  }
}

export const store = {
  async getSettings(): Promise<Settings | undefined> {
    return (await safe(() => db!.settings.get("main"), undefined)) ?? mem.settings;
  },
  async saveSettings(s: Settings): Promise<void> {
    mem.settings = s;
    await safe(() => db!.settings.put(s).then(() => undefined), undefined);
  },
  async addEvent(e: Omit<DetourEvent, "at"> & { at?: number }): Promise<void> {
    const row = { ...e, at: e.at ?? Date.now() };
    mem.events.push(row);
    await safe(() => db!.events.add(row).then(() => undefined), undefined);
  },
  async completedCardIds(): Promise<Set<string>> {
    const rows = await safe(() => db!.events.where("event").equals("complete").toArray(), [] as DetourEvent[]);
    return new Set([...rows, ...mem.events.filter((e) => e.event === "complete")].map((r) => r.card_id));
  },
  async getEvents(): Promise<DetourEvent[]> {
    const rows = await safe(() => db!.events.toArray(), [] as DetourEvent[]);
    return rows.length ? rows : [...mem.events];
  },
  async getReviews(): Promise<ReviewRow[]> {
    const rows = await safe(() => db!.reviews.toArray(), [] as ReviewRow[]);
    const merged = new Map(rows.map((r) => [r.probe_id, r]));
    for (const [k, v] of mem.reviews) merged.set(k, v);
    return [...merged.values()];
  },
  async getReview(probe_id: string): Promise<ReviewRow | undefined> {
    return (await safe(() => db!.reviews.get(probe_id), undefined)) ?? mem.reviews.get(probe_id);
  },
  async putReview(r: ReviewRow): Promise<void> {
    mem.reviews.set(r.probe_id, r);
    await safe(() => db!.reviews.put(r).then(() => undefined), undefined);
  },
  async getSkills(): Promise<SkillProgress[]> {
    const rows = await safe(() => db!.skill_progress.toArray(), [] as SkillProgress[]);
    const merged = new Map<string, SkillProgress>(rows.map((r) => [r.track_id, r]));
    for (const [k, v] of mem.skills) merged.set(k, v);
    return [...merged.values()];
  },
  async putSkill(p: SkillProgress): Promise<void> {
    mem.skills.set(p.track_id, p);
    await safe(() => db!.skill_progress.put(p).then(() => undefined), undefined);
  },
  async getStreak(): Promise<StreakState | undefined> {
    return (await safe(() => db!.streak.get("main"), undefined)) ?? mem.streak;
  },
  async putStreak(s: StreakState): Promise<void> {
    mem.streak = s;
    await safe(() => db!.streak.put(s).then(() => undefined), undefined);
  },
  async getSessions(): Promise<SessionRow[]> {
    const rows = await safe(() => db!.sessions.toArray(), [] as SessionRow[]);
    return rows.length ? rows : [...mem.sessions];
  },
  /** Events older than the retention window are dropped (they only feed recent stats). */
  async pruneEvents(maxAgeMs: number): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    mem.events = mem.events.filter((e) => e.at >= cutoff);
    await safe(() => db!.events.where("at").below(cutoff).delete().then(() => undefined), undefined);
  },
  async snapshot(): Promise<BackupData> {
    return {
      settings: await store.getSettings(),
      events: await store.getEvents(),
      sessions: await store.getSessions(),
      reviews: await store.getReviews(),
      skill_progress: await store.getSkills(),
      streak: await store.getStreak(),
    };
  },
  /** Replaces everything on this device (used by import). */
  async replaceAll(d: BackupData): Promise<void> {
    await store.clearAll();
    mem.settings = d.settings;
    mem.events = d.events.map(({ id: _id, ...e }) => e);
    mem.sessions = d.sessions.map(({ id: _id, ...s }) => s);
    d.reviews.forEach((r) => mem.reviews.set(r.probe_id, r));
    d.skill_progress.forEach((p) => mem.skills.set(p.track_id, p));
    mem.streak = d.streak;
    await safe(async () => {
      await db!.transaction("rw", [db!.settings, db!.events, db!.sessions, db!.reviews, db!.skill_progress, db!.streak], async () => {
        if (d.settings) await db!.settings.put(d.settings);
        await db!.events.bulkAdd(mem.events);
        await db!.sessions.bulkAdd(mem.sessions);
        await db!.reviews.bulkPut(d.reviews);
        await db!.skill_progress.bulkPut(d.skill_progress);
        if (d.streak) await db!.streak.put(d.streak);
      });
    }, undefined);
  },
  async clearAll(): Promise<void> {
    mem.settings = undefined;
    mem.events = [];
    mem.sessions = [];
    mem.reviews.clear();
    mem.skills.clear();
    mem.streak = undefined;
    await safe(async () => {
      await Promise.all([db!.settings.clear(), db!.events.clear(), db!.sessions.clear(), db!.reviews.clear(), db!.skill_progress.clear(), db!.streak.clear()]);
    }, undefined);
  },
  async addSession(s: SessionRow): Promise<void> {
    mem.sessions.push(s);
    await safe(() => db!.sessions.add(s).then(() => undefined), undefined);
  },
};
