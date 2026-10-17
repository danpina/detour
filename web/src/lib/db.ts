import Dexie, { type Table } from "dexie";
import type { Interest } from "@detour/content";

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

  constructor() {
    super("detour");
    this.version(1).stores({
      settings: "id",
      events: "++id, card_id, event, at",
      sessions: "++id, started_at",
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
const mem = { settings: undefined as Settings | undefined, events: [] as DetourEvent[], sessions: [] as SessionRow[] };

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
  async addSession(s: SessionRow): Promise<void> {
    mem.sessions.push(s);
    await safe(() => db!.sessions.add(s).then(() => undefined), undefined);
  },
};
