// `pnpm --filter tools exec tsx src/games/words-gen.ts`
// Turns the hand-written list in words-list.ts into content/games/words.json for both apps.
// Format: {"puzzles":[{"id","scramble","answer","accept":[...],"clue","level":1|2|3}]}
// - scramble: the answer's letters (UPPERCASE) shuffled with a seeded RNG, never equal to any accepted word.
// - accept:   every word in the list that is an anagram of the answer (including the answer), sorted.
// - level:    5 letters = 1, 6 letters = 2, 7-8 letters = 3.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { WORDS } from "./words-list.js";

const OUT = path.resolve(import.meta.dirname, "../../../content/games/words.json");

export type Puzzle = { id: string; scramble: string; answer: string; accept: string[]; clue: string; level: 1 | 2 | 3 };

/** Small deterministic RNG (mulberry32) so the output is stable between runs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sortLetters = (w: string) => w.split("").sort().join("");

export function levelFor(length: number): 1 | 2 | 3 {
  return length <= 5 ? 1 : length === 6 ? 2 : 3;
}

export function buildPuzzles(): Puzzle[] {
  const random = rng(20261021);
  const seen = new Set<string>();
  const groups = new Map<string, string[]>();
  for (const e of WORDS) {
    const w = e.word.toUpperCase();
    if (!/^[A-Z]{5,8}$/.test(w)) throw new Error(`bad word: ${e.word}`);
    if (seen.has(w)) throw new Error(`duplicate word: ${w}`);
    if (!e.clue.trim()) throw new Error(`missing clue: ${w}`);
    if (e.clue.toUpperCase().includes(w)) throw new Error(`clue gives the word away: ${w}`);
    seen.add(w);
    const key = sortLetters(w);
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return WORDS.map((e) => {
    const answer = e.word.toUpperCase();
    const accept = [...(groups.get(sortLetters(answer)) ?? [answer])].sort();
    const letters = answer.split("");
    let scramble = answer;
    for (let tries = 0; tries < 200 && accept.includes(scramble); tries++) {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [letters[i], letters[j]] = [letters[j]!, letters[i]!];
      }
      scramble = letters.join("");
    }
    if (accept.includes(scramble)) throw new Error(`could not scramble ${answer}`);
    return { id: `w-${answer.toLowerCase()}`, scramble, answer, accept, clue: e.clue, level: levelFor(answer.length) };
  });
}

// Only write when run directly (the module has no other side effects, so tests may import the builders).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const puzzles = buildPuzzles();
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ puzzles }, null, 1) + "\n", "utf8");
  const counts = [1, 2, 3].map((l) => `level ${l}: ${puzzles.filter((p) => p.level === l).length}`);
  console.log(`Wrote ${puzzles.length} puzzles to ${OUT} (${counts.join(", ")})`);
}
