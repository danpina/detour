/** Pure logic for the Geography game: question building and the round ramp. No React, no storage. */

export const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"] as const;
export type Continent = (typeof CONTINENTS)[number];

export type Country = {
  name: string;
  capital: string;
  flag: string;
  continent: Continent;
  level: 1 | 2 | 3;
  note?: string;
};

export type QuestionKind = "flag" | "capital" | "country";

export type Question = {
  kind: QuestionKind;
  /** The big thing on screen: a flag emoji, or a country name, or a capital name. */
  prompt: string;
  /** The line above or below the prompt. */
  title: string;
  options: string[];
  /** The correct option text (always one of `options`). */
  answer: string;
  /** One line shown after answering. */
  fact: string;
  level: number;
};

export type Rng = () => number;

export const ROUND_LENGTH = 10;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/** Level for question `index` of a round: the first 4 are easy, then 3 medium, then 3 harder. */
export function levelForIndex(index: number, length: number = ROUND_LENGTH): 1 | 2 | 3 {
  const f = index / length;
  if (f < 0.4) return 1;
  if (f < 0.7) return 2;
  return 3;
}

function optionText(kind: QuestionKind, c: Country): string {
  return kind === "capital" ? c.capital : c.name;
}

/** Three wrong options: same continent when possible, never the answer, never a duplicate. */
export function pickDistractors(all: readonly Country[], answer: Country, kind: QuestionKind, rng: Rng, count = 3): Country[] {
  const answerText = optionText(kind, answer);
  const usable = all.filter((c) => c !== answer && optionText(kind, c) !== answerText);
  const same = shuffle(
    usable.filter((c) => c.continent === answer.continent),
    rng,
  );
  const other = shuffle(
    usable.filter((c) => c.continent !== answer.continent),
    rng,
  );
  const out: Country[] = [];
  const seen = new Set<string>([answerText]);
  for (const c of [...same, ...other]) {
    const t = optionText(kind, c);
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

function factFor(c: Country): string {
  if (c.note) return c.note;
  return `${c.capital} is the capital of ${c.name}.`;
}

export function buildQuestion(all: readonly Country[], answer: Country, kind: QuestionKind, rng: Rng): Question {
  const wrong = pickDistractors(all, answer, kind, rng);
  const correct = optionText(kind, answer);
  const options = shuffle([correct, ...wrong.map((c) => optionText(kind, c))], rng);
  if (kind === "flag") {
    return { kind, prompt: answer.flag, title: "Which country is this?", options, answer: correct, fact: `${answer.flag} ${answer.name}. ${factFor(answer)}`, level: answer.level };
  }
  if (kind === "capital") {
    return { kind, prompt: answer.name, title: "What is the capital of", options, answer: correct, fact: factFor(answer), level: answer.level };
  }
  return { kind, prompt: answer.capital, title: "Which country has the capital", options, answer: correct, fact: factFor(answer), level: answer.level };
}

/** A round: easy questions first, a mix of the three kinds, no country twice. */
export function buildRound(all: readonly Country[], rng: Rng, length: number = ROUND_LENGTH): Question[] {
  const kinds: QuestionKind[] = ["flag", "capital", "country"];
  const used = new Set<Country>();
  const kindOrder = shuffle(kinds, rng);
  const questions: Question[] = [];
  for (let i = 0; i < length; i++) {
    const level = levelForIndex(i, length);
    let pool = all.filter((c) => c.level === level && !used.has(c));
    // Fall back to the nearest levels if one level runs dry.
    if (pool.length === 0) pool = all.filter((c) => !used.has(c));
    if (pool.length === 0) break;
    const answer = shuffle(pool, rng)[0] as Country;
    used.add(answer);
    // Cycle through the kinds, reshuffling every lap so neighbours differ but the mix stays even.
    if (i > 0 && i % kinds.length === 0) {
      const last = kindOrder[kindOrder.length - 1];
      let next = shuffle(kinds, rng);
      if (next[0] === last) next = [...next.slice(1), next[0] as QuestionKind];
      kindOrder.splice(0, kindOrder.length, ...next);
    }
    const kind = kindOrder[i % kinds.length] as QuestionKind;
    questions.push(buildQuestion(all, answer, kind, rng));
  }
  return questions;
}
