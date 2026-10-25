/**
 * Builds content/games/spanish.json, french.json and german.json from the word lists in ./language-words.
 * One or more files per language and level (es-1.txt, es-1b.txt, ... = Spanish, beginner; 1 beginner, 2 medium, 3 advanced). One word per line, fields separated by " | ":
 *   word | meaning | category | example sentence | its English | key (optional)
 * The key is what gets blanked out in the example sentence; by default it is the word without its article.
 * Lines starting with # and empty lines are ignored. Run: pnpm --filter tools exec tsx src/games/language-gen.ts
 * Stops with a list of problems instead of writing, so a typo never reaches the apps.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LANGUAGES = [
  { code: "es", file: "spanish", name: "spanish" },
  { code: "fr", file: "french", name: "french" },
  { code: "de", file: "german", name: "german" },
] as const;

const ARTICLE = /^(el |la |los |las |le |les |der |die |das |l')/i;
const LETTER = /[\p{L}\p{M}]/u;

type Word = { word: string; en: string; level: 1 | 2 | 3; cat: string; ex: string; exEn: string; key: string };

/** How many words each language has at each level, so the apps can show "of N" without loading the lists. */
const levelCounts: Record<string, Record<number, number>> = {};
let failed = false;
const problem = (msg: string) => {
  failed = true;
  console.error("  ! " + msg);
};

for (const lang of LANGUAGES) {
  const words: Word[] = [];
  for (const level of [1, 2, 3] as const) {
    const dir = resolve(import.meta.dirname, "language-words");
    const parts = readdirSync(dir).filter((f) => f.startsWith(lang.code + "-" + level) && f.endsWith(".txt")).sort();
    for (const part of parts) {
    readFileSync(resolve(dir, part), "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (!line.trim() || line.startsWith("#")) return;
        const where = part + ":" + (i + 1);
        const parts = line.split(" | ").map((p) => p.trim());
        if (parts.length < 5 || parts.length > 6) return problem(`${where}: expected 5 or 6 fields, got ${parts.length}: ${line.slice(0, 60)}`);
        const [word, en, cat, ex, exEn, explicitKey] = parts as [string, string, string, string, string, string?];
        if (!word || !en || !cat || !ex || !exEn) return problem(`${where}: an empty field: ${line.slice(0, 60)}`);
        const key = explicitKey || word.replace(ARTICLE, "");
        const at = ex.toLowerCase().indexOf(key.toLowerCase());
        if (at < 0) return problem(`${where}: "${key}" is not in its example: ${ex}`);
        if (LETTER.test(ex[at - 1] ?? " ") || LETTER.test(ex[at + key.length] ?? " ")) problem(`${where}: "${key}" is only part of a longer word in: ${ex}`);
        words.push({ word, en, level, cat, ex, exEn, key });
      });
    }
  }
  const seenKeys = new Map<string, number>();
  for (const w of words) {
    if (seenKeys.has(w.key)) problem(`${lang.code}: key "${w.key}" is used twice (levels ${seenKeys.get(w.key)} and ${w.level})`);
    seenKeys.set(w.key, w.level);
  }
  for (const level of [1, 2, 3]) {
    const meanings = new Map<string, string>();
    for (const w of words.filter((x) => x.level === level)) {
      const prev = meanings.get(w.en);
      if (prev) problem(`${lang.code}-${level}: "${w.en}" means both "${prev}" and "${w.word}", which would make two right answers`);
      meanings.set(w.en, w.word);
    }
  }
  const counts = [1, 2, 3].map((l) => words.filter((w) => w.level === l).length);
  console.log(`${lang.name}: ${words.length} words (beginner ${counts[0]}, medium ${counts[1]}, advanced ${counts[2]})`);
  levelCounts[lang.code] = Object.fromEntries([1, 2, 3].map((l) => [l, words.filter((w) => w.level === l).length]));
  // One word per line: small files, and a readable diff.
  const body = words.map((w) => "  " + JSON.stringify(w)).join(",\n");
  if (!failed) writeFileSync(resolve(import.meta.dirname, `../../../content/games/${lang.file}.json`), `{"language":"${lang.name}","words":[\n${body}\n]}\n`);
}

if (!failed) writeFileSync(resolve(import.meta.dirname, "../../../content/games/language-counts.json"), JSON.stringify(levelCounts) + "\n");

if (failed) {
  console.error("Nothing written: fix the lines above.");
  process.exit(1);
}
