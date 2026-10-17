import type { Card, Interest } from "@detour/content";

type Options = { allowSeen?: boolean; exclude?: Set<string> };

/**
 * Picks `n` content cards. Prefers unseen cards from the chosen interests (round-robin in the given order,
 * varying card types), then unseen cards from other interests, then (unless `allowSeen` is false) already-seen
 * cards, so a set is full whenever enough cards exist. `exclude` ids are never returned.
 */
export function pickSet(cards: Card[], interests: Interest[], seen: Set<string>, n = 5, opts: Options = {}): Card[] {
  const { allowSeen = true, exclude = new Set<string>() } = opts;
  const content = cards.filter((c) => c.type !== "drill" && c.type !== "recall" && !exclude.has(c.id));
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
  if (allowSeen) take(byInterest(content, [...interests, ...others]));
  return chosen;
}
