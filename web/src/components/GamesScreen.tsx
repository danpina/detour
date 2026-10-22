import { useState } from "react";
import { GAMES, type GameDef } from "../games/registry";
import { ROUND_SIZES, getRoundSize, getStats, setRoundSize } from "../games/stats";

/** The Games tab: a short list of games. Opening one takes over the screen until it calls onExit. */
export function GamesScreen() {
  const [playing, setPlaying] = useState<GameDef | null>(null);
  const [roundSize, setRound] = useState(getRoundSize());
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
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Puzzles per round</p>
        <div className="mt-2 flex gap-2" role="group" aria-label="Puzzles per round">
          {ROUND_SIZES.map((n) => (
            <button
              key={n}
              onClick={() => {
                setRoundSize(n);
                setRound(n);
              }}
              aria-pressed={roundSize === n}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${roundSize === n ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200" : "border-neutral-300 dark:border-neutral-700"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {GAMES.map((g) => {
          const s = getStats(g.id);
          return (
            <button
              key={g.id}
              onClick={() => setPlaying(g)}
              className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold">{g.name}</span>
                <span className="block text-sm text-neutral-500 dark:text-neutral-400">{g.blurb}</span>
              </span>
              {s.plays > 0 && <span className="text-xs text-neutral-500 dark:text-neutral-400">Best {s.best}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
