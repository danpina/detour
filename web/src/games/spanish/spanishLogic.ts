/** Pure logic for the Spanish game: what to ask, in what form, and what comes back. No React, no storage. */

export type Word = { es: string; en: string; level: 1 | 2 | 3; cat: string; ex: string; exEn: string; key: string };

export type Rng = () => number;

/** How many times each word (by key) was answered right, and which ones were missed last time. */
export type Progress = { known: Record<string, number>; missed: string[] };

export type QuestionKind = "toEn" | "toEs" | "cloze";

export type Question = {
  kind: QuestionKind;
  key: string;
  title: string;
  /** The big thing on screen. */
  prompt: string;
  /** A small line under the prompt (the sentence's English for a fill-in-the-blank). */
  hint?: string;
  options: string[];
  answer: string;
  /** Shown after answering. */
  fact: string;
};

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

/** Words you've answered right at least this many times count as learned. */
export const LEARNED_AT = 2;

/** The highest level in play: level 2 opens once 12 words are learned, level 3 once 30 are. */
export function unlockedLevel(progress: Progress, words: readonly Word[]): 1 | 2 | 3 {
  const learned = words.filter((w) => (progress.known[w.key] ?? 0) >= LEARNED_AT).length;
  if (learned >= 30) return 3;
  if (learned >= 12) return 2;
  return 1;
}

/** The first time a word shows it's recognising Spanish; then recalling it; then using it in a sentence. */
export function kindFor(timesRight: number): QuestionKind {
  if (timesRight <= 0) return "toEn";
  if (timesRight === 1) return "toEs";
  return "cloze";
}

/** The sentence with the word replaced by a blank, or null when the word can't be found in it. */
export function blanked(w: Word): string | null {
  const at = w.ex.toLowerCase().indexOf(w.key.toLowerCase());
  if (at < 0) return null;
  return w.ex.slice(0, at) + "____" + w.ex.slice(at + w.key.length);
}

function distractors(all: readonly Word[], answer: Word, text: (w: Word) => string, rng: Rng, count = 3): string[] {
  const correct = text(answer);
  const usable = all.filter((w) => w !== answer && text(w) !== correct);
  const same = shuffle(usable.filter((w) => w.cat === answer.cat), rng);
  const other = shuffle(usable.filter((w) => w.cat !== answer.cat), rng);
  const out: string[] = [];
  const seen = new Set<string>([correct]);
  for (const w of [...same, ...other]) {
    const t = text(w);
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length === count) break;
  }
  return out;
}

export function buildQuestion(all: readonly Word[], word: Word, kind: QuestionKind, rng: Rng): Question {
  const fact = `${word.es} = ${word.en}. "${word.ex}" ${word.exEn}`;
  if (kind === "cloze") {
    const sentence = blanked(word);
    if (sentence) {
      const options = shuffle([word.key, ...distractors(all, word, (w) => w.key, rng)], rng);
      return { kind, key: word.key, title: "Fill the gap", prompt: sentence, hint: word.exEn, options, answer: word.key, fact };
    }
    return buildQuestion(all, word, "toEs", rng);
  }
  if (kind === "toEs") {
    const options = shuffle([word.es, ...distractors(all, word, (w) => w.es, rng)], rng);
    return { kind, key: word.key, title: "How do you say", prompt: word.en, options, answer: word.es, fact };
  }
  const options = shuffle([word.en, ...distractors(all, word, (w) => w.en, rng)], rng);
  return { kind, key: word.key, title: "What does this mean?", prompt: word.es, options, answer: word.en, fact };
}

/**
 * A round: words you missed last time come back first (up to half), then words you haven't learned yet within your level,
 * then a refresher of learned ones. Each word is asked in the form that matches how well you know it.
 */
export function buildRound(all: readonly Word[], progress: Progress, rng: Rng, length: number): Question[] {
  const level = unlockedLevel(progress, all);
  const byKey = new Map(all.map((w) => [w.key, w] as const));
  const chosen: Word[] = [];
  const used = new Set<string>();
  const add = (w: Word | undefined) => {
    if (!w || used.has(w.key) || chosen.length >= length) return;
    used.add(w.key);
    chosen.push(w);
  };
  const missedWords = shuffle(progress.missed.map((k) => byKey.get(k)).filter((w): w is Word => !!w), rng);
  missedWords.slice(0, Math.ceil(length / 2)).forEach(add);
  const learning = shuffle(all.filter((w) => w.level <= level && (progress.known[w.key] ?? 0) < LEARNED_AT), rng);
  learning.forEach(add);
  shuffle(all.filter((w) => w.level <= level), rng).forEach(add);
  return chosen.map((w) => buildQuestion(all, w, kindFor(progress.known[w.key] ?? 0), rng));
}

/** Updates progress after a question: a right answer counts up, a wrong one sets the word back and queues it for next time. */
export function applyAnswer(progress: Progress, key: string, right: boolean): Progress {
  const known = { ...progress.known };
  const missed = progress.missed.filter((k) => k !== key);
  if (right) {
    known[key] = (known[key] ?? 0) + 1;
  } else {
    known[key] = Math.max(0, (known[key] ?? 0) - 1);
    missed.push(key);
  }
  return { known, missed: missed.slice(-20) };
}
