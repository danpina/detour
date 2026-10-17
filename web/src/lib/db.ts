import Dexie, { type Table } from "dexie";
import type { Interest } from "@detour/content";
import type { SkillProgress } from "./drills";
import type { ReviewRow } from "./fsrs";

export type Settings = {
  id: "main";
  interests: Interest[];
  onboarding_done: boolean;
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

class DetourDB extends Dexie {
  settings!: Table<Settings, string>;
  events!: Table<DetourEvent, number>;
  sessions!: Table<SessionRow, number>;
  reviews!: Table<ReviewRow, string>;
  skill_progress!: Table<SkillProgress, string>;

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
  }
}

let db: DetourDB | null = null;
try {
  db = new DetourDB();
} catch (e) {
  console.warn("Storage unavailable; running without saving progress.", e);
}

// In-memory fallbacks so the app still works when IndexedDB is blocked (rule 7).
const mem = { settings: undefined as Settings | undefined, events: [] as DetourEvent[], sessions: [] as SessionRow[], reviews: new Map<string, ReviewRow>(), skills: new Map<string, SkillProgress>() };

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
  async addSession(s: SessionRow): Promise<void> {
    mem.sessions.push(s);
    await safe(() => db!.sessions.add(s).then(() => undefined), undefined);
  },
};
