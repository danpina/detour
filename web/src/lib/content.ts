import { cardSchema, type Card, type Interest } from "@detour/content";

/** Cards and images are bundled at build time from /content/published. */
const cardModules = import.meta.glob("../../../content/published/cards/*.json", { eager: true, import: "default" });
const imageUrls = import.meta.glob("../../../content/published/images/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export const INTEREST_INFO: Record<Interest, { name: string; blurb: string; emoji: string }> = {
  history: { name: "History", blurb: "Stories that still echo", emoji: "🏛️" },
  science: { name: "Science", blurb: "How the world works", emoji: "🔭" },
  money: { name: "Money & Markets", blurb: "Ideas behind the numbers", emoji: "🪙" },
  tech: { name: "Tech", blurb: "How we got here", emoji: "💡" },
  mind: { name: "Human Mind", blurb: "Why we think what we think", emoji: "🧠" },
  numbers: { name: "Numbers & Logic", blurb: "Patterns and puzzles", emoji: "🔢" },
  // A skill, not a card topic: choosing it adds a quick estimation round to your sets.
  estimation: { name: "Estimation", blurb: "Guess big numbers", emoji: "⚖️" },
};

function loadCards(): Card[] {
  const cards: Card[] = [];
  for (const [file, raw] of Object.entries(cardModules)) {
    const parsed = cardSchema.safeParse(raw);
    if (parsed.success) cards.push(parsed.data);
    else console.error(`Skipping invalid card ${file}`, parsed.error.issues);
  }
  return cards.sort((a, b) => a.id.localeCompare(b.id));
}

export const ALL_CARDS: Card[] = loadCards();

export function imageUrl(file: string): string | undefined {
  const key = Object.keys(imageUrls).find((k) => k.endsWith(`/${file}`));
  return key ? imageUrls[key] : undefined;
}

export const cardById = (id: string) => ALL_CARDS.find((c) => c.id === id);
