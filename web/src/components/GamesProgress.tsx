import { useEffect, useState } from "react";
import { GAMES } from "../games/registry";
import { LANGUAGES, LEVEL_NAMES, wordCount, type Language } from "../games/language/languageData";
import { LEARNED_AT, type Level } from "../games/language/languageLogic";
import { loadProgress as loadLanguageProgress } from "../games/language/progress";
import { LOGIC_ITEMS } from "../games/logic/logicData";
import { loadLogicProgress } from "../games/logic/progress";
import { bestLabel, getStats } from "../games/stats";

const card = "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";
const LEVELS: Level[] = [1, 2, 3];

type Learned = Record<string, Record<Level, number>>;

/** Words learned per language and level. The word lists load here, not with the rest of the app. */
async function learnedWords(): Promise<Learned> {
  const out: Learned = {};
  for (const lang of LANGUAGES) out[lang.id] = await learnedFor(lang);
  return out;
}

async function learnedFor(lang: Language): Promise<Record<Level, number>> {
  const known = loadLanguageProgress(lang).known;
  const counts: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
  if (Object.values(known).every((n) => n < LEARNED_AT)) return counts; // nothing learned yet: no need to load the list
  for (const w of await lang.load()) if ((known[w.key] ?? 0) >= LEARNED_AT) counts[w.level]++;
  return counts;
}

/** The Games part of Progress: how much you have played, your best rounds, and how far you are in the learning games. */
export function GamesProgress() {
  const [learned, setLearned] = useState<Learned | null>(null);

  useEffect(() => {
    let live = true;
    void learnedWords().then((l) => live && setLearned(l));
    return () => {
      live = false;
    };
  }, []);

  const plays = GAMES.reduce((n, g) => n + getStats(g.id).plays, 0);
  const solved = Object.values(loadLogicProgress().solved).filter((v) => v > 0).length;

  return (
    <>
      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Rounds played</h2>
        <div className="mt-1 text-4xl font-semibold tabular-nums">{plays}</div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{plays === 0 ? "Try a Game round from the home screen." : "Across all your games."}</p>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Languages</h2>
        <div className="mt-3 space-y-4">
          {LANGUAGES.map((lang) => (
            <div key={lang.id}>
              <div className="font-medium">{lang.flag} {lang.name}</div>
              <div className="mt-2 space-y-2">
                {LEVELS.map((level) => {
                  const done = learned?.[lang.id]?.[level] ?? 0;
                  const total = wordCount(lang, level);
                  return (
                    <div key={level}>
                      <div className="flex items-baseline justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{LEVEL_NAMES[level]}</span>
                        <span className="tabular-nums">{done} of {total} words</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Logic</h2>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{solved} <span className="text-base font-normal text-neutral-500 dark:text-neutral-400">of {LOGIC_ITEMS.length} puzzles solved</span></div>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Your games</h2>
        <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
          {GAMES.map((g) => {
            const s = getStats(g.id);
            const best = bestLabel(g.id);
            return (
              <div key={g.id} className="flex items-center gap-3 py-2.5">
                <span className="text-2xl">{g.emoji}</span>
                <span className="flex-1">
                  <span className="block font-medium">{g.name}</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">{s.plays === 0 ? "Not played yet" : `${s.plays} ${s.plays === 1 ? "round" : "rounds"}`}</span>
                </span>
                {best && <span className="text-sm text-neutral-500 dark:text-neutral-400">Best {best}</span>}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
