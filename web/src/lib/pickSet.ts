import type { Card, Interest } from "@detour/content";

/**
 * Picks `n` cards for a set. Prefers unseen cards from the chosen interests (round-robin, varying card types),
 * then unseen cards from other interests, then already-seen cards, so a set is full whenever enough cards exist.
 * Step 7 replaces this with the full session engine (reviews + new + drill).
 */
export function pickSet(cards: Card[], interests: Interest[], seen: Set<string>, n = 5): Card[] {
  const content = cards.filter((c) => c.type !== "drill" && c.type !== "recall");
  const chosen: Card[] = [];
  const used = new Set<string>();

  const take = (groups: Card[][]) => {
    let progress = true;
    while (chosen.length < n && progress) {
      progress = false;
      for (const g of groups) {
        if (chosen.length >= n) break;
        const usedTypes = new Set(chosen.map((c) => c.type));
        const next = g.find((c) => !used.has(c.id) && !usedTypes.has(c.type)) ?? g.find((c) => !used.has(c.id));
        if (next) {
          chosen.push(next);
          used.add(next.id);
          progress = true;
        }
      }
    }
  };

  const byInterest = (list: Card[], ints: Interest[]) => ints.map((i) => list.filter((c) => c.interest === i));
  const unseen = content.filter((c) => !seen.has(c.id));
  const others = [...new Set(content.map((c) => c.interest))].filter((i) => !interests.includes(i));

  take(byInterest(unseen, interests));
  take(byInterest(unseen, others));
  take(byInterest(content, [...interests, ...others]));
  return chosen;
}
