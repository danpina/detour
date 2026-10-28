import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { recordRound, roundFor } from "../stats";
import { getChessLevel, loadChessData } from "./chessData";
import {
  acceptStep, boardAfter, buildRound, displayOrder, glyph, isFinalStep, isOwnPiece, matePlies, moveSquares, parseFen, puzzlesFor, squareName, type Puzzle,
} from "./chessLogic";

const MAX_TRIES = 2;
/** How long the last result stays visible before an embedded game hands over. */
const EMBEDDED_DONE_MS = 1200;
/** The pause before the opponent answers in a mate in two or three. */
const REPLY_MS = 700;

type Status = "playing" | "correct" | "revealed";

const MATE_WORD = ["", "one", "two", "three", "four"];

/** Chess tactics: find the checkmate, in one move or (hard) in two or three. A round has `getRoundSize()` puzzles, easy to hard. */
export function ChessGame({ onExit, embedded }: GameProps) {
  const data = useMemo(() => loadChessData(), []);
  const [round, setRound] = useState<Puzzle[]>(() => (data ? buildRound(puzzlesFor(data, getChessLevel()), Math.random, roundFor(embedded)) : []));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [selected, setSelected] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  /** Every move played so far in this puzzle: yours and the opponent's replies. */
  const [moves, setMoves] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const [isBest, setIsBest] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  if (!data || round.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-2xl font-semibold">Chess tactics</h1>
        <p className="text-neutral-500 dark:text-neutral-400">The puzzles didn't load this time. Try again a little later.</p>
        <button onClick={onExit} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">Back</button>
      </div>
    );
  }

  function resetPuzzle() {
    setWrong(0);
    setStatus("playing");
    setSelected(null);
    setAnswer(null);
    setMoves([]);
    setWaiting(false);
  }

  function finish(finalScore: number) {
    const best = recordRound("chess", finalScore);
    if (embedded) {
      embedded.onDone(finalScore);
      return;
    }
    setIsBest(best);
    setDone(true);
  }

  function next(finalScore: number) {
    if (index + 1 >= round.length) {
      finish(finalScore);
      return;
    }
    setIndex(index + 1);
    resetPuzzle();
  }

  function playAgain() {
    if (!data) return;
    setRound(buildRound(puzzlesFor(data, getChessLevel()), Math.random, roundFor(embedded)));
    setIndex(0);
    setScore(0);
    resetPuzzle();
    setDone(false);
  }

  if (done) {
    const share = round.length > 0 ? score / round.length : 0;
    const msg = share >= 0.9 ? "Sharp eyes." : share >= 0.6 ? "Nicely done." : share >= 0.3 ? "Good practice." : "Every board teaches something.";
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <div aria-hidden="true" className="text-5xl">♟️</div>
        <h1 className="text-3xl font-semibold">{score} of {round.length}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          solved on the first try. {msg}
          {isBest && score > 0 ? " That's a new best!" : ""}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button onClick={playAgain} className="rounded-2xl bg-teal-600 px-6 py-4 text-lg font-semibold text-white active:scale-[0.99]">Play again</button>
          <button onClick={onExit} className="rounded-2xl border border-neutral-300 px-6 py-4 text-lg font-semibold active:scale-[0.99] dark:border-neutral-700">Back</button>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{data.credit}</p>
      </div>
    );
  }

  const puzzle = round[index];
  const parsed = puzzle ? parseFen(puzzle.fen) : null;
  if (!puzzle || !parsed) {
    // A broken puzzle should never trap the player: skip it.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p>That one got lost.</p>
        <button onClick={() => next(score)} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">Next</button>
      </div>
    );
  }
  const side = puzzle.sideToMove;
  const order = displayOrder(side);
  const squares = boardAfter(parsed.squares, moves);
  const hint = answer ? moveSquares(answer) : null;
  const last = moves.length > 0 ? moveSquares(moves[moves.length - 1]!) : null;
  const isLastPuzzle = index + 1 >= round.length;
  const ply = moves.length;
  const total = matePlies(puzzle);

  const tap = (sq: string, piece: string | null) => {
    if (status !== "playing" || waiting) return;
    if (selected === null) {
      if (isOwnPiece(piece, side)) setSelected(sq);
      return;
    }
    if (sq === selected) {
      setSelected(null);
      return;
    }
    if (isOwnPiece(piece, side)) {
      setSelected(sq);
      return;
    }
    const step = acceptStep(puzzle, ply, selected, sq);
    if (step && isFinalStep(puzzle, ply)) {
      const newScore = wrong === 0 ? score + 1 : score;
      setScore(newScore);
      setAnswer(step);
      setMoves([...moves, step]);
      setStatus("correct");
      setSelected(null);
      timer.current = window.setTimeout(() => next(newScore), isLastPuzzle && embedded ? EMBEDDED_DONE_MS : 1100);
      return;
    }
    if (step) {
      // Right, but not the mate yet: play it, then the opponent answers and it is your turn again.
      const played = [...moves, step];
      const reply = puzzle.line?.[ply + 1];
      setMoves(played);
      setSelected(null);
      if (reply) {
        setWaiting(true);
        timer.current = window.setTimeout(() => {
          setMoves([...played, reply]);
          setWaiting(false);
        }, REPLY_MS);
      }
      return;
    }
    const w = wrong + 1;
    setWrong(w);
    setSelected(null);
    setShake((n) => n + 1);
    if (w >= MAX_TRIES) {
      setAnswer(puzzle.line && !isFinalStep(puzzle, ply) ? (puzzle.line[ply] ?? null) : (puzzle.mates[0] ?? null));
      setStatus("revealed");
      if (isLastPuzzle && embedded) timer.current = window.setTimeout(() => next(score), EMBEDDED_DONE_MS);
    }
  };

  const sideName = side === "w" ? "White" : "Black";
  const mateWord = MATE_WORD[total] ?? String(total);
  let message = `${sideName} to move. Find checkmate in ${mateWord}.`;
  if (ply > 0 && status === "playing") {
    message = waiting ? "Good move. Watching the reply…" : total - ply / 2 === 1 ? "Good. Now find the mating move." : "Good. Now find your next move.";
  }
  if (status === "correct") message = "Checkmate! Lovely.";
  else if (status === "revealed") message = puzzle.line ? "Here's the move. On to the next one." : "Here's the mate. On to the next one.";
  else if (wrong > 0) message = "Not that one, try again";

  return (
    <div className="flex h-full flex-col px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <style>{`@keyframes detour-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}@media (prefers-reduced-motion: reduce){.detour-board{animation:none !important}}`}</style>
      <div className="flex items-center justify-between">
        {embedded ? (
          <span className="text-sm font-semibold">A quick board puzzle</span>
        ) : (
          <button onClick={onExit} className="min-h-11 rounded-xl px-2 text-sm text-neutral-500 dark:text-neutral-400">Close</button>
        )}
        <span className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          {index + 1} of {round.length}
          {embedded && (
            <button onClick={onExit} className="min-h-11 rounded-xl px-2 text-sm text-neutral-500 dark:text-neutral-400">Skip</button>
          )}
        </span>
      </div>
      <p aria-live="polite" className="mt-3 min-h-12 text-center text-lg font-semibold">{message}</p>
      <div
        key={shake}
        className="detour-board mx-auto mt-3 grid aspect-square w-full max-w-[390px] grid-cols-8 overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700"
        style={shake > 0 ? { animation: "detour-shake 0.35s" } : undefined}
      >
        {order.map((i) => {
          const sq = squareName(i);
          const piece = squares[i] ?? null;
          const file = i % 8;
          const rank = Math.floor(i / 8);
          const light = (file + rank) % 2 === 0;
          const isSel = selected === sq;
          const isHint = hint !== null && (hint.from === sq || hint.to === sq);
          const isLastMove = last !== null && status === "playing" && (last.from === sq || last.to === sq);
          let bg = light ? "bg-amber-100 dark:bg-amber-200/80" : "bg-teal-700 dark:bg-teal-800";
          if (isLastMove) bg = light ? "bg-lime-200 dark:bg-lime-300/80" : "bg-lime-700 dark:bg-lime-800";
          if (isHint) bg = "bg-emerald-400";
          if (isSel) bg = "bg-yellow-300";
          const white = piece !== null && piece === piece.toUpperCase();
          return (
            <button
              key={sq}
              onClick={() => tap(sq, piece)}
              aria-label={sq + (piece ? " " + piece : "")}
              className={`flex aspect-square items-center justify-center text-[clamp(1.6rem,9vw,2.6rem)] leading-none ${bg} ${isSel ? "ring-4 ring-inset ring-rose-600" : ""}`}
            >
              {piece && (
                <span className={`transition-transform duration-150 ${isSel ? "scale-125" : ""} ` + (white ? "text-white [text-shadow:0_0_2px_#000,0_0_2px_#000,0_0_2px_#000]" : "text-neutral-900")}>
                  {glyph(white ? piece.toLowerCase() : piece)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-center">
        {status === "revealed" && !(embedded && isLastPuzzle) && (
          <button onClick={() => next(score)} className="rounded-2xl bg-teal-600 px-8 py-3 text-lg font-semibold text-white active:scale-[0.99]">Next</button>
        )}
      </div>
    </div>
  );
}
