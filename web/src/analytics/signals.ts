/**
 * Every anonymous signal Detour can send. This file is the complete list (CLAUDE.md rule 4).
 *
 * What is never sent: names, emails, free text, typed answers, which interests you picked, or anything that
 * identifies you. The only identifier is a random install id that stays on the device (TelemetryDeck hashes it
 * again before storing). Payload values are limited to short codes, counts, flags and card ids.
 *
 * These feed the metrics in SPEC §8: D1/D7/D30 retention (from `app.opened`), sessions per active day
 * (`session.started`), recall rate (`recall.answered`) and cards reported per 1,000 views
 * (`card.reported` / `card.viewed`). Paywall signals arrive with the paywall (iOS).
 */
export type SignalPayloads = {
  /** The app was opened. Drives retention. */
  "app.opened": Record<string, never>;
  /** Onboarding finished. `interests` is only how many were picked. */
  "onboarding.completed": { interests: number };
  /** A set of cards started. `mode`: "set" (5 cards) or "feed" (free scroll). */
  "session.started": { mode: "set" | "feed"; cards: number };
  /** A set ended. Counts of what was completed. */
  "session.completed": { completed: number; reviews: number; newCards: number; drills: number };
  /** A card was shown. `type` is the card type or "review" / "drill". */
  "card.viewed": { card: string; type: string };
  /** The user reported a problem. `reason` is one of a fixed list of codes. */
  "card.reported": { card: string; reason: string };
  /** A recall question was answered. `kind` is mcq, tf, cloze or estimate. */
  "recall.answered": { kind: string; correct: boolean };
  /** A drill round ended. */
  "drill.completed": { track: string; level: number; right: number; total: number };
  /** A skill track went up a level. */
  "drill.levelUp": { track: string; level: number };
};

export type SignalName = keyof SignalPayloads;
export type SignalValue = string | number | boolean;
