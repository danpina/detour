import { useEffect, useState } from "react";
import { TRACKS, generateRound, type SkillProgress, type TrackId } from "../lib/drills";
import { store } from "../lib/db";

type Props = {
  track: TrackId;
  onBack: () => void;
  /** Starts a round. With a level it is practice: it does not count toward moving up. */
  onStart: (level?: number) => void;
};

/** One skill, level by level: what each level asks, an example, and a way to practise any of them. */
export function SkillScreen({ track, onBack, onStart }: Props) {
  const [row, setRow] = useState<SkillProgress | null>(null);
  const info = TRACKS[track];

  useEffect(() => {
    void store.getSkills().then((rows) => setRow(rows.find((r) => r.track_id === track) ?? null));
  }, [track]);

  const current = row?.level ?? 1;
  const started = (row?.attempts_total ?? 0) > 0;

  return (
    <div className="flex h-full flex-col px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="min-h-11 self-start text-left text-neutral-500 dark:text-neutral-400">← Progress</button>
      <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">{info.name}</h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">{info.blurb}. {started ? `You're on level ${current} of ${info.maxLevel}.` : "Not started yet."}</p>

      <button onClick={() => onStart()} className="mt-4 min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">
        {started ? `Play level ${current}` : "Start with level 1"}
      </button>

      <ul className="mt-5 flex-1 space-y-2 overflow-auto pb-4">
        {info.levels.map((name, i) => {
          const level = i + 1;
          const example = generateRound({ track, level, seed: 1000 + level, count: 1 })[0];
          const format = example?.choices ? (example.choices.length === 2 && example.choices[0] === "True" ? "True or false" : "Pick one") : "";
          const state = level < current ? "Done" : level === current ? (started ? "You're here" : "Start") : "";
          return (
            <li key={level}>
              <button
                onClick={() => onStart(level)}
                className={`w-full rounded-2xl border p-3 text-left active:scale-[0.99] ${level === current ? "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{level}. {name}</span>
                  <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{state}{format ? (state ? " · " : "") + format : ""}</span>
                </span>
                {example && <span className="mt-1 block text-sm text-neutral-500 dark:text-neutral-400">For example: {example.prompt}</span>}
                <span className="mt-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Practise this level ›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
