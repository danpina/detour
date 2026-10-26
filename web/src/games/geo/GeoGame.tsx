import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { recordRound, roundFor } from "../stats";
import { COUNTRIES } from "./geoData";
import { buildRound, type Question } from "./geoLogic";

/** Reads the round size when a round starts, not at import time. */
function newRound(embedded: unknown): Question[] {
  return buildRound(COUNTRIES, Math.random, roundFor(embedded));
}

function endLine(score: number, total: number): string {
  if (score === total) return "A perfect trip. Well travelled!";
  if (score >= total * 0.7) return "Nicely done. You know your way around.";
  if (score >= total * 0.4) return "Good run. The map is getting familiar.";
  return "Every trip teaches something. Go again?";
}

export function GeoGame({ onExit, embedded }: GameProps) {
  const [round, setRound] = useState<Question[]>(() => newRound(embedded));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [best, setBest] = useState<boolean | null>(null);
  const finishedRef = useRef(false);

  const total = round.length;
  const lastAnswered = total > 0 && index === total - 1 && picked !== null;

  function finishEmbedded() {
    if (finishedRef.current || !embedded) return;
    finishedRef.current = true;
    recordRound("geo", score);
    embedded.onDone(score);
  }

  // Embedded: after the last fact line, move on by itself after a moment (the button does it sooner).
  useEffect(() => {
    if (!embedded || !lastAnswered) return;
    const t = setTimeout(finishEmbedded, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, lastAnswered]);

  if (round.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">Geography is not available right now.</p>
        <button onClick={onExit} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">{embedded ? "Skip" : "Back"}</button>
      </div>
    );
  }

  const done = index >= round.length;

  function restart() {
    setRound(newRound(embedded));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setBest(null);
  }

  if (done && !embedded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 pb-[env(safe-area-inset-bottom)] text-center">
        <div className="text-6xl">🌍</div>
        <h1 className="text-3xl font-semibold tracking-tight">{score} / {round.length}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">{endLine(score, round.length)}</p>
        {best && <p className="text-sm font-medium text-teal-600 dark:text-teal-400">New best!</p>}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          <button onClick={restart} className="min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">Play again</button>
          <button onClick={onExit} className="min-h-14 rounded-2xl border border-neutral-300 px-6 py-3 text-lg font-semibold active:scale-[0.98] dark:border-neutral-700">Back</button>
        </div>
      </div>
    );
  }

  if (done) return null;

  const q = round[index] as Question;
  const answered = picked !== null;
  const isLast = index === round.length - 1;

  function choose(option: string) {
    if (answered) return;
    setPicked(option);
    if (option === q.answer) setScore((s) => s + 1);
  }

  function next() {
    if (isLast) {
      if (embedded) {
        finishEmbedded();
        return;
      }
      setBest(recordRound("geo", score));
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function optionClass(option: string): string {
    const base = "min-h-14 w-full rounded-2xl border px-4 py-3 text-left text-lg font-medium transition active:scale-[0.99] ";
    if (!answered) return base + "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
    if (option === q.answer) return base + "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 game-pop";
    if (option === picked) return base + "border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100 game-shake";
    return base + "border-neutral-200 bg-white opacity-50 dark:border-neutral-800 dark:bg-neutral-900";
  }

  const correct = picked === q.answer;

  return (
    <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      {embedded ? (
        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-medium">A quick geography question</span>
          <span>{index + 1} / {round.length}</span>
          <button onClick={onExit} className="-mr-2 min-h-11 px-2" aria-label="Skip">Skip</button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <button onClick={onExit} className="-ml-2 min-h-11 px-2" aria-label="Back">Back</button>
          <span>{index + 1} / {round.length}</span>
          <span>Score {score}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-neutral-500 dark:text-neutral-400">{q.title}</p>
        <p className={q.kind === "flag" ? "mt-2 text-8xl leading-tight" : "mt-2 text-4xl font-semibold tracking-tight"}>{q.prompt}{q.kind === "flag" ? "" : "?"}</p>
      </div>

      <div className="space-y-3">
        {q.options.map((o) => (
          <button key={o} onClick={() => choose(o)} disabled={answered} className={optionClass(o)}>{o}</button>
        ))}
      </div>

      <div className="mt-4 min-h-24" aria-live="polite">
        {answered && (
          <>
            <p className="game-rise font-semibold">{correct ? "Yes!" : "Not this time."}</p>
            <p className="text-neutral-600 dark:text-neutral-300">{q.fact}</p>
            <button onClick={next} className="game-rise mt-3 min-h-14 w-full rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">{isLast ? (embedded ? "Continue" : "See my score") : "Next"}</button>
          </>
        )}
      </div>
    </div>
  );
}
