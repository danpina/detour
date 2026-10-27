import { describe, expect, it } from "vitest";
import type { Card } from "@detour/content";
import type { DetourEvent } from "./db";
import type { ReviewRow } from "./fsrs";
import {
  addDays, cardState, dayKey, daysBetween, displayStreak, emptyStreak, knowledgeMap, recallStats, recordDay, skillSummary, weekKey, weeklyRecap, type StreakState,
} from "./progress";

const DAY = 86_400_000;
// 2026-10-12 is a Monday.
const MON = "2026-10-12";
const run = (days: string[], start: StreakState = emptyStreak()) => days.reduce(recordDay, start);

describe("day helpers", () => {
  it("handles weeks that start on Monday", () => {
    expect(weekKey("2026-10-12")).toBe("2026-10-12");
    expect(weekKey("2026-10-18")).toBe("2026-10-12");
    expect(weekKey("2026-10-19")).toBe("2026-10-19");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayKey(new Date(2026, 9, 12, 23, 30).getTime())).toBe("2026-10-12");
  });
});

describe("streak with freezes", () => {
  it("starts at 1 and ignores repeats on the same day", () => {
    const s = run([MON, MON]);
    expect(s.current).toBe(1);
    expect(s.freezes_left).toBe(2);
  });

  it("counts consecutive days", () => {
    const s = run([MON, addDays(MON, 1), addDays(MON, 2)]);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it("a missed day spends a freeze and the streak survives", () => {
    const s = run([MON, addDays(MON, 2)]); // missed Tuesday
    expect(s.current).toBe(2);
    expect(s.freezes_left).toBe(1);
  });

  it("two missed days in one week use both freezes", () => {
    const s = run([MON, addDays(MON, 3)]); // missed Tue, Wed
    expect(s.current).toBe(2);
    expect(s.freezes_left).toBe(0);
  });

  it("a third missed day in the same week breaks the streak", () => {
    const s = run([MON, addDays(MON, 4)]); // missed Tue, Wed, Thu
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });

  it("freezes refill on Monday", () => {
    // Active Mon-Sat, miss Sunday (a freeze from that week covers it), active the next Monday with a fresh set of 2.
    const s = run([0, 1, 2, 3, 4, 5, 7].map((n) => addDays(MON, n)));
    expect(s.current).toBe(7);
    expect(s.freezes_left).toBe(2);
  });

  it("a long break resets the streak but keeps the best", () => {
    const s = run([MON, addDays(MON, 1), addDays(MON, 2), addDays(MON, 40)]);
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });

  it("does not mutate its input", () => {
    const a = run([MON]);
    const copy = { ...a };
    recordDay(a, addDays(MON, 1));
    expect(a).toEqual(copy);
  });

  it("displayStreak keeps a covered gap alive and shows 0 for a broken one", () => {
    const s = run([MON, addDays(MON, 1)]);
    expect(displayStreak(s, addDays(MON, 1)).current).toBe(2);
    expect(displayStreak(s, addDays(MON, 2)).current).toBe(2); // yesterday active -> still going
    expect(displayStreak(s, addDays(MON, 3)).current).toBe(2); // one missed day, freeze covers it
    expect(displayStreak(s, addDays(MON, 6)).current).toBe(0); // too many missed days
    expect(displayStreak(emptyStreak(), MON).current).toBe(0);
  });
});

describe("remembered score", () => {
  const now = Date.UTC(2026, 9, 20);
  const ev = (daysAgo: number, correct: boolean | undefined, probe = true): DetourEvent => ({
    card_id: "sci-0001", event: "complete", ms_spent: 5000, at: now - daysAgo * DAY, ...(probe ? { probe_id: "sci-0001-p1", correct } : {}),
  });

  it("is the share of correct recall answers in the window", () => {
    const events = [ev(1, true), ev(2, true), ev(3, true), ev(4, false), ev(40, false)];
    expect(recallStats(events, now, 30)).toEqual({ total: 4, correct: 3, rate: 0.75 });
  });

  it("ignores new-card completions and reports null with no answers", () => {
    expect(recallStats([ev(1, undefined, false)], now, 30)).toEqual({ total: 0, correct: 0, rate: null });
  });
});

describe("knowledge map", () => {
  const card = (id: string, probes = 1): Card =>
    ({ id, interest: "science", type: "fact_why", probes: Array.from({ length: probes }, (_, i) => ({ id: `${id}-p${i + 1}` })) }) as unknown as Card;
  const row = (probe_id: string, stability: number, reps = 1): ReviewRow =>
    ({ probe_id, card_id: probe_id.slice(0, -3), due_at: 0, stability, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps, lapses: 0, state: 2 });

  it("walks a card from new to solid", () => {
    const c = card("sci-0001");
    const none = new Map<string, ReviewRow>();
    expect(cardState(c, new Set(), none)).toBe("new");
    expect(cardState(c, new Set(["sci-0001"]), new Map([["sci-0001-p1", row("sci-0001-p1", 0, 0)]]))).toBe("seen");
    expect(cardState(c, new Set(["sci-0001"]), new Map([["sci-0001-p1", row("sci-0001-p1", 5)]]))).toBe("learning");
    expect(cardState(c, new Set(["sci-0001"]), new Map([["sci-0001-p1", row("sci-0001-p1", 30)]]))).toBe("solid");
  });

  it("needs every probe to be long-term for solid", () => {
    const c = card("sci-0002", 2);
    const m = new Map([["sci-0002-p1", row("sci-0002-p1", 40)], ["sci-0002-p2", row("sci-0002-p2", 3)]]);
    expect(cardState(c, new Set(["sci-0002"]), m)).toBe("learning");
  });

  it("groups cards by interest", () => {
    const map = knowledgeMap([card("sci-0001"), card("sci-0002")], new Set(["sci-0001"]), []);
    expect(map.get("science")!.map((c) => c.state)).toEqual(["seen", "new"]);
  });
});

describe("skills and recap", () => {
  it("summarises every track with defaults", () => {
    const s = skillSummary([{ track_id: "estimation", level: 2, recent_results: [true, false, true], attempts_total: 3, last_at: 1 }]);
    expect(s.map((x) => x.id)).toEqual(["mental-math", "algebra", "geometry", "probability", "number-theory", "money", "estimation"]);
    expect(s[0]!.level).toBe(1);
    expect(s[6]).toMatchObject({ level: 2, recentRight: 2, recentTotal: 3 });
  });

  it("builds the weekly recap from the last 7 days", () => {
    const now = new Date(2026, 9, 20, 18).getTime();
    const e = (daysAgo: number, extra: Partial<DetourEvent> = {}): DetourEvent => ({ card_id: "sci-0001", event: "complete", ms_spent: 60_000, at: now - daysAgo * DAY, ...extra });
    const events = [
      e(0), e(1), e(2, { probe_id: "p", correct: true }), e(2, { probe_id: "p", correct: false }), e(3, { card_id: "drill:mental-math" }), e(20),
    ];
    const r = weeklyRecap(events, 4, now);
    expect(r.cards).toBe(4); // drills and old events excluded
    expect(r.recallRate).toBe(0.5);
    expect(r.minutes).toBe(5); // 5 events in the window, 1 min each (drill counts toward time)
    expect(r.streak).toBe(4);
    expect(r.days).toBe(4);
  });
});
