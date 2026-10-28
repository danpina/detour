import { useState } from "react";
import type { GameProps } from "../registry";
import { recordRound, roundFor } from "../stats";
import { buildRound, type PatternPuzzle } from "./logic";

function endLine(score: number, total: number): string {
  if (score === total) return "Every one. Lovely.";
  if (score * 10 >= total * 7) return "Sharp eyes today.";
  if (score * 10 >= total * 4) return "Nice work. Patterns get easier the more you spot.";
  return "Good warm-up. A fresh round is always one tap away.";
}

export function PatternsGame({ onExit, embedded }: GameProps) {
  const [round, setRound] = useState<PatternPuzzle[]>(() => buildRound(undefined, Math.random, roundFor(embedded)));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isBest, setIsBest] = useState(false);

  const puzzle = round[index];

  function answer(value: number) {
    if (picked !== null || !puzzle) return;
    setPicked(value);
    if (value === puzzle.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= round.length) {
      if (embedded) {
        recordRound("patterns", score);
        embedded.onDone(score);
        return;
      }
      setIsBest(recordRound("patterns", score));
      setFinished(true);
    } else {
      setIndex(index + 1);
      setPicked(null);
    }
  }

  function again() {
    setRound(buildRound(undefined, Math.random, roundFor(embedded)));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
    setIsBest(false);
  }

  if (finished || !puzzle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-6xl font-semibold tabular-nums">{score}<span className="text-3xl text-neutral-500">/{round.length}</span></p>
        <p className="text-lg">{endLine(score, round.length)}</p>
        {isBest && score > 0 && <p className="text-sm font-medium text-teal-600 dark:text-teal-400">New best!</p>}
        <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
          <button onClick={again} className="min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">Play again</button>
          <button onClick={onExit} className="min-h-14 rounded-2xl border border-neutral-300 px-6 py-3 text-lg font-semibold dark:border-neutral-700">Back</button>
        </div>
      </div>
    );
  }

  const correct = picked === puzzle.answer;
  return (
    <div className="flex h-full flex-col px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        {embedded ? (
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">A quick pattern puzzle</span>
        ) : (
          <button onClick={onExit} aria-label="Back" className="min-h-11 min-w-11 text-left text-neutral-500 dark:text-neutral-400">← Back</button>
        )}
        <span className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">{index + 1} of {round.length}</span>
          {embedded && <button onClick={onExit} className="min-h-11 min-w-11 text-sm text-neutral-500 dark:text-neutral-400">Skip</button>}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true"><div className="h-full rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${(Math.min(index + (picked !== null ? 1 : 0), round.length) / round.length) * 100}%` }} /></div>
      <h1 className={`mt-4 font-semibold tracking-tight ${embedded ? "text-xl" : "text-2xl"}`}>What comes next?</h1>

      <div className="mt-6 flex flex-wrap justify-center gap-2" aria-label="The sequence">
        {puzzle.shown.map((n, i) => (
          <span key={i} className="flex h-14 min-w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-2 text-xl font-semibold tabular-nums dark:border-neutral-800 dark:bg-neutral-900">{n}</span>
        ))}
        <span className="flex h-14 min-w-12 items-center justify-center rounded-xl border-2 border-dashed border-teal-500 px-2 text-xl font-semibold text-teal-600 dark:text-teal-400">
          {picked === null ? "?" : puzzle.answer}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {puzzle.options.map((o) => {
          let style = "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
          if (picked !== null) {
            if (o === puzzle.answer) style = "border-teal-500 bg-teal-50 dark:bg-teal-950 game-pop";
            else if (o === picked) style = "border-amber-500 bg-amber-50 dark:bg-amber-950 game-shake";
            else style = "border-neutral-200 bg-white opacity-50 dark:border-neutral-800 dark:bg-neutral-900";
          }
          return (
            <button
              key={o}
              disabled={picked !== null}
              onClick={() => answer(o)}
              className={`min-h-20 rounded-2xl border-2 text-3xl font-semibold tabular-nums active:scale-[0.98] ${style}`}
            >
              {o}
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-24" aria-live="polite">
        {picked !== null && (
          <div className="game-rise text-center">
            <p className="text-lg font-semibold">{correct ? "Yes, that's it!" : `Close. It was ${puzzle.answer}.`}</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">{puzzle.rule}.</p>
          </div>
        )}
      </div>

      {picked !== null && (
        <button onClick={next} className="mt-auto min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">
          {index + 1 >= round.length ? (embedded ? "Continue" : "See my score") : "Next"}
        </button>
      )}
    </div>
  );
}
