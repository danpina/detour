import type { Card, Interest } from "@detour/content";
import type { DetourEvent } from "./db";
import type { ReviewRow } from "./fsrs";
import { cardState, type CardState } from "./progress";

const DAY_MS = 86_400_000;

export type LearnedRow = { card: Card; learnedAt: number; state: CardState };

/** The cards the player has completed, newest first. Drills and recall prompts are not cards to read, so they are left out. */
export function learnedCards(cards: Card[], events: Pick<DetourEvent, "card_id" | "event" | "at">[], reviews: ReviewRow[]): LearnedRow[] {
  const first = new Map<string, number>();
  for (const e of events) {
    if (e.event !== "complete") continue;
    const seen = first.get(e.card_id);
    if (seen === undefined || e.at < seen) first.set(e.card_id, e.at);
  }
  const completed = new Set(first.keys());
  const byProbe = new Map(reviews.map((r) => [r.probe_id, r]));
  return cards
    .filter((c) => c.type !== "drill" && c.type !== "recall" && completed.has(c.id))
    .map((card) => ({ card, learnedAt: first.get(card.id)!, state: cardState(card, completed, byProbe) }))
    .sort((a, b) => b.learnedAt - a.learnedAt);
}

/** The text of a card, as paragraphs, for reading it again. */
export function cardParagraphs(card: Card): string[] {
  switch (card.type) {
    case "story":
      return card.body.panels.map((p) => p.text);
    case "fact_why":
      return [card.body.claim, card.body.why];
    case "guess_first":
      return [card.body.question, `Answer: ${card.body.options[card.body.answer]}`, card.body.reveal];
    case "estimate": {
      const unit = card.body.unit ? ` ${card.body.unit}` : "";
      return [card.body.question, `Answer: ${card.body.answer.toLocaleString("en")}${unit}`, card.body.reveal];
    }
    default:
      return [];
  }
}

/** Cards matching the search words (every word must appear in the title or text) and the topic, in the same order. */
export function filterLearned(rows: LearnedRow[], query: string, topic: Interest | "all"): LearnedRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(({ card }) => {
    if (topic !== "all" && card.interest !== topic) return false;
    if (words.length === 0) return true;
    const haystack = `${card.title} ${cardParagraphs(card).join(" ")}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", "3 months ago". */
export function learnedAgo(at: number, now: number): string {
  const days = Math.max(0, Math.floor((now - at) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export const STATE_LABEL: Record<CardState, string> = { new: "Not yet", seen: "Seen", learning: "Sticking", solid: "Locked in" };
