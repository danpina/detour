import { useState } from "react";
import { GAMES, type GameDef } from "../games/registry";
import { LANGUAGES, LEVEL_NAMES, getLanguage, getLevel, setLanguage, setLevel, type LanguageId } from "../games/language/languageData";
import type { Level } from "../games/language/languageLogic";
import { MAX_ROUND_SIZE, MIN_ROUND_SIZE, bestLabel, getRoundSize, setRoundSize } from "../games/stats";

/** The Games tab: a short list of games. Opening one takes over the screen until it calls onExit. */
export function GamesScreen() {
  const [playing, setPlaying] = useState<GameDef | null>(null);
  const [roundSize, setRound] = useState(getRoundSize());
  const [languageId, setLanguageId] = useState<LanguageId>(() => getLanguage().id);
  const [level, setLevelState] = useState<Level>(getLevel);
  if (playing) {
    const Game = playing.Component;
    return (
      <div className="absolute inset-0 z-30 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <Game onExit={() => setPlaying(null)} />
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))]">
      <h1 className="text-3xl font-semibold tracking-tight">Games</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Short rounds that still teach you something.</p>
      <div className="mt-5">
        <label htmlFor="round-size" className="flex items-baseline justify-between text-sm font-medium text-neutral-500 dark:text-neutral-400">
          <span>Puzzles per round</span>
          <span className="text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{roundSize}</span>
        </label>
        <input
          id="round-size"
          type="range"
          min={MIN_ROUND_SIZE}
          max={MAX_ROUND_SIZE}
          step={1}
          value={roundSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            setRoundSize(n);
            setRound(n);
          }}
          className="mt-2 h-8 w-full accent-teal-600"
        />
      </div>
      {[
        { title: "Learn", games: GAMES.filter((g) => g.learn) },
        { title: "Just for fun", games: GAMES.filter((g) => !g.learn) },
      ].map((group) => (
        <div key={group.title} className="mt-6">
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{group.title}</h2>
          <div className="mt-2 space-y-3">
            {group.games.map((g) => {
              const best = bestLabel(g.id);
              const line = g.progress?.() ?? null;
              return (
                <div key={g.id} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  onClick={() => setPlaying(g)}
                  className="flex w-full items-center gap-4 rounded-2xl p-4 text-left active:scale-[0.99]"
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">{g.name}</span>
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">{line ?? g.blurb}</span>
                  </span>
                  {best && <span className="text-xs text-neutral-500 dark:text-neutral-400">Best {best}</span>}
                </button>
                {g.id === "languages" && (
                  <div className="flex gap-2 px-4 pb-4" role="group" aria-label="Language">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setLanguage(l.id);
                          setLanguageId(l.id);
                        }}
                        aria-pressed={languageId === l.id}
                        className={`min-h-11 flex-1 rounded-full border px-3 py-1.5 text-sm font-medium ${languageId === l.id ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200" : "border-neutral-300 dark:border-neutral-700"}`}
                      >
                        {l.flag} {l.name}
                      </button>
                    ))}
                  </div>
                )}
                {g.id === "languages" && (
                  <div className="flex gap-2 px-4 pb-4" role="group" aria-label="Level">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setLevel(n);
                          setLevelState(n);
                        }}
                        aria-pressed={level === n}
                        className={`min-h-11 flex-1 rounded-full border px-3 py-1.5 text-sm font-medium ${level === n ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200" : "border-neutral-300 dark:border-neutral-700"}`}
                      >
                        {LEVEL_NAMES[n]}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
