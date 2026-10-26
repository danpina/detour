import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { recordRound, roundFor } from "../stats";
import { buildRound, isCorrect, lettersOf, loadPuzzles, placeTile, removeSlot, wordPoints, type Puzzle } from "./logic";

type Status = "playing" | "wrong" | "correct" | "skipped";

const STYLE = `
@keyframes words-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-9px) } 40% { transform: translateX(9px) } 60% { transform: translateX(-6px) } 80% { transform: translateX(6px) } }
@keyframes words-pop { 0% { transform: scale(1) } 50% { transform: scale(1.12) } 100% { transform: scale(1) } }
.words-shake { animation: words-shake 0.4s ease-in-out; }
.words-pop { animation: words-pop 0.35s ease-out; }
@media (prefers-reduced-motion: reduce) { .words-shake, .words-pop { animation: none; } }
`;

/** Reads the round size when a round starts, not at import time. */
function newRound(embedded: unknown): Puzzle[] {
  return buildRound(loadPuzzles(), Math.random, roundFor(embedded));
}

export function WordsGame({ onExit, embedded }: GameProps) {
  const [round, setRound] = useState<Puzzle[]>(() => newRound(embedded));
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("playing");
  const [hinted, setHinted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isBest, setIsBest] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    if (status !== "wrong") return;
    const t = setTimeout(() => setStatus("playing"), 1400);
    return () => clearTimeout(t);
  }, [status, shakeKey]);

  // Embedded: after the last word is solved or skipped, report the score once and hand control back.
  const lastDone = round.length > 0 && index + 1 >= round.length && (status === "correct" || status === "skipped");
  useEffect(() => {
    if (!embedded || !lastDone) return;
    const t = setTimeout(() => {
      if (recorded.current) return;
      recorded.current = true;
      recordRound("words", score);
      embedded.onDone(score);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDone, embedded ? 1 : 0]);

  if (round.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-2xl font-semibold">Word scramble</h1>
        <p className="text-neutral-500 dark:text-neutral-400">The words are not available right now.</p>
        <button onClick={onExit} className="min-h-12 rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">{embedded ? "Skip" : "Back"}</button>
      </div>
    );
  }

  const puzzle = round[index]!;
  const slots = puzzle.answer.length;
  const locked = status === "correct" || status === "skipped";

  function reset(nextIndex: number) {
    setIndex(nextIndex);
    setPlaced([]);
    setStatus("playing");
    setHinted(false);
  }

  function tapTile(tile: number) {
    if (locked) return;
    const next = placeTile(placed, tile, slots);
    setPlaced(next);
    if (status === "wrong") setStatus("playing");
    if (next.length === slots) {
      if (isCorrect(puzzle, lettersOf(puzzle.scramble, next))) {
        setScore((s) => s + wordPoints(true, hinted));
        setStatus("correct");
      } else {
        setShakeKey((k) => k + 1);
        setStatus("wrong");
      }
    }
  }

  function tapSlot(slot: number) {
    if (locked || slot >= placed.length) return;
    setPlaced(removeSlot(placed, slot));
    if (status === "wrong") setStatus("playing");
  }

  function skip() {
    setPlaced([]);
    setStatus("skipped");
  }

  function next() {
    if (index + 1 < round.length) {
      reset(index + 1);
      return;
    }
    if (!recorded.current) {
      recorded.current = true;
      setIsBest(recordRound("words", score));
    }
    setFinished(true);
  }

  function playAgain() {
    recorded.current = false;
    setRound(newRound(embedded));
    setScore(0);
    setFinished(false);
    setIsBest(false);
    reset(0);
  }

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-6xl">{score >= round.length - 1 ? "🌟" : "🔤"}</div>
        <h1 className="text-2xl font-semibold">Nice round!</h1>
        <p className="text-5xl font-bold tabular-nums">
          {score}
          <span className="text-2xl font-medium text-neutral-500 dark:text-neutral-400"> / {round.length}</span>
        </p>
        <p className="text-neutral-500 dark:text-neutral-400">{isBest ? "That's a new best for you." : "Every word is practice."}</p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <button onClick={playAgain} className="min-h-12 rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white active:scale-[0.98]">Play again</button>
          <button onClick={onExit} className="min-h-12 rounded-2xl border border-neutral-300 px-6 py-3 font-semibold active:scale-[0.98] dark:border-neutral-700">Back</button>
        </div>
      </div>
    );
  }

  const shownClue = hinted || locked;
  const slotClass =
    status === "correct"
      ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300"
      : status === "skipped"
        ? "border-neutral-400 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800"
        : status === "wrong"
          ? "border-rose-400 bg-rose-500/10"
          : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="flex h-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <style>{STYLE}</style>
      {embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">A quick word puzzle</p>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Word {index + 1} of {round.length} · {score} pts
            </p>
          </div>
          <button onClick={onExit} className="min-h-11 rounded-full px-4 text-sm font-semibold text-neutral-500 active:bg-neutral-200 dark:text-neutral-400 dark:active:bg-neutral-800">Skip</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button onClick={onExit} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-xl active:bg-neutral-200 dark:active:bg-neutral-800">←</button>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Word {index + 1} of {round.length}</p>
          <p className="min-w-11 text-right text-sm font-semibold tabular-nums">{score} pts</p>
        </div>
      )}

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true"><div className="h-full rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${((index + (locked ? 1 : 0)) / round.length) * 100}%` }} /></div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <p className="min-h-12 max-w-xs text-center text-base text-neutral-600 dark:text-neutral-300" aria-live="polite">
          {shownClue ? puzzle.clue : "Tap the letters in order to spell the word."}
        </p>

        <div key={shakeKey} className={`flex w-full justify-center gap-1.5 ${status === "wrong" ? "words-shake" : ""}`}>
          {Array.from({ length: slots }, (_, slot) => {
            const letter =
              status === "skipped" ? puzzle.answer[slot] : slot < placed.length ? puzzle.scramble[placed[slot]!] : "";
            return (
              <button
                key={slot}
                onClick={() => tapSlot(slot)}
                disabled={locked || slot >= placed.length}
                aria-label={letter ? `Letter ${slot + 1}: ${letter}. Tap to take back.` : `Empty slot ${slot + 1}`}
                className={`flex h-14 min-w-0 max-w-12 flex-1 items-center justify-center rounded-xl border-2 text-2xl font-bold ${slotClass} ${status === "correct" ? "words-pop" : ""}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div className="flex w-full justify-center gap-1.5" aria-label="Letters">
          {puzzle.scramble.split("").map((ch, tile) => {
            const used = placed.includes(tile);
            return (
              <button
                key={tile}
                onClick={() => tapTile(tile)}
                disabled={used || locked}
                className={`flex h-14 min-w-0 max-w-12 flex-1 items-center justify-center rounded-xl text-2xl font-bold shadow-sm transition active:scale-95 ${
                  used
                    ? "bg-neutral-200/60 text-transparent dark:bg-neutral-800/60"
                    : "bg-teal-600 text-white"
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>

        <p className="min-h-6 text-center text-sm font-medium" aria-live="polite">
          {status === "wrong" && <span className="text-rose-600 dark:text-rose-400">Not quite. Tap a letter to swap it.</span>}
          {status === "correct" && (
            <span className="text-teal-700 dark:text-teal-300">{hinted ? "Got it! No point this time, but you got there." : "Got it! +1"}</span>
          )}
          {status === "skipped" && <span className="text-neutral-500 dark:text-neutral-400">That one was {puzzle.answer}. On to the next.</span>}
        </p>
      </div>

      <div className="flex gap-3">
        {locked && embedded && index + 1 >= round.length ? (
          <p className="min-h-12 flex-1 py-3 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">All done!</p>
        ) : locked ? (
          <button onClick={next} className="min-h-12 flex-1 rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white active:scale-[0.98]">
            {index + 1 < round.length ? "Next word" : "See my score"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setHinted(true)}
              disabled={hinted}
              className="min-h-12 flex-1 rounded-2xl border border-neutral-300 px-4 py-3 font-semibold active:scale-[0.98] disabled:opacity-40 dark:border-neutral-700"
            >
              Hint (-1)
            </button>
            <button
              onClick={skip}
              className="min-h-12 flex-1 rounded-2xl border border-neutral-300 px-4 py-3 font-semibold active:scale-[0.98] dark:border-neutral-700"
            >
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
