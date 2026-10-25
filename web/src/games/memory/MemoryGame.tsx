import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { getRoundSize, getStats, recordRound } from "../stats";
import {
  GRID_TILES,
  applyResult,
  applyShortResult,
  checkAnswer,
  generateDigits,
  generateTiles,
  isPrefix,
  newRun,
  newShortRound,
  shortScore,
  type Run,
  type ShortRound,
} from "./logic";

type Mode = "digits" | "grid";
type Phase = "menu" | "watch" | "turn" | "result" | "over";

const DIGIT_MS = 800;
const TILE_MS = 600;
const GAP_MS = 250;
const INTRO_MS = 900;
const RESULT_MS = 1100;
const EMBEDDED_DONE_MS = 1200;

const MODE_TITLE: Record<Mode, string> = { digits: "Digit span", grid: "Pattern grid" };

function embeddedStart(): { mode: Mode; short: ShortRound; seq: number[] } {
  const mode: Mode = Math.random() < 0.5 ? "digits" : "grid";
  const short = newShortRound(getRoundSize());
  const seq = mode === "digits" ? generateDigits(short.run.length) : generateTiles(short.run.length, GRID_TILES);
  return { mode, short, seq };
}

export function MemoryGame({ onExit, embedded }: GameProps) {
  const [init] = useState(() => (embedded ? embeddedStart() : null));
  const [mode, setMode] = useState<Mode>(init?.mode ?? "digits");
  const [phase, setPhase] = useState<Phase>(init ? "watch" : "menu");
  const [run, setRun] = useState<Run>(init?.short.run ?? newRun());
  const [short, setShort] = useState<ShortRound | null>(init?.short ?? null);
  const recorded = useRef(false);
  const [seq, setSeq] = useState<number[]>(init?.seq ?? []);
  const [shown, setShown] = useState<number | null>(null); // digit or tile currently shown
  const [input, setInput] = useState<number[]>([]);
  const [ok, setOk] = useState(true);
  const [isBest, setIsBest] = useState(false);
  const [round, setRound] = useState(0); // bumps to restart the watch timeline

  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Everything timed is cleared on unmount.
  useEffect(() => clearTimers, []);

  // The "watch" timeline: a short pause, then each item in turn.
  useEffect(() => {
    if (phase !== "watch") return;
    const on = mode === "digits" ? DIGIT_MS : TILE_MS;
    let t = INTRO_MS;
    seq.forEach((v) => {
      later(() => setShown(v), t);
      t += on;
      later(() => setShown(null), t);
      t += GAP_MS;
    });
    later(() => {
      setInput([]);
      setPhase("turn");
    }, t);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  function startRound(m: Mode, r: Run) {
    setSeq(m === "digits" ? generateDigits(r.length) : generateTiles(r.length, GRID_TILES));
    setInput([]);
    setShown(null);
    setRound((n) => n + 1);
    setPhase("watch");
  }

  function start(m: Mode) {
    clearTimers();
    const r = newRun();
    setMode(m);
    setRun(r);
    setIsBest(false);
    startRound(m, r);
  }

  function finishRound(success: boolean, given: number[]) {
    void given;
    if (embedded && short) {
      const ns = applyShortResult(short, success);
      setShort(ns);
      setRun(ns.run);
      setOk(success);
      setPhase("result");
      if (ns.done) {
        later(() => {
          if (recorded.current) return;
          recorded.current = true;
          const score = shortScore(ns);
          embedded.onDone(score);
        }, EMBEDDED_DONE_MS);
      } else {
        later(() => startRound(mode, ns.run), RESULT_MS);
      }
      return;
    }
    const next = applyResult(run, success);
    setRun(next);
    setOk(success);
    setPhase("result");
    later(() => {
      if (next.over) {
        setIsBest(recordRound("memory", next.best, 0));
        setPhase("over");
      } else {
        startRound(mode, next);
      }
    }, RESULT_MS);
  }

  function press(v: number) {
    if (phase !== "turn") return;
    const next = [...input, v];
    if (mode === "grid" && !isPrefix(seq, next)) {
      setInput(next);
      finishRound(false, next);
      return;
    }
    setInput(next);
    if (next.length === seq.length) finishRound(checkAnswer(seq, next), next);
  }

  function backspace() {
    if (phase === "turn" && mode === "digits") setInput((i) => i.slice(0, -1));
  }

  function backToModes() {
    clearTimers();
    setPhase("menu");
  }

  function skip() {
    clearTimers();
    onExit();
  }

  const header = embedded ? (
    <div className="flex items-center justify-between px-4 pt-4">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">A quick memory check</span>
      <div className="flex items-center gap-3">
        {short && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {Math.min(short.played + 1, short.target)} of {short.target}
          </span>
        )}
        <button onClick={skip} className="h-11 rounded-xl px-3 text-neutral-500 dark:text-neutral-400">
          Skip
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between px-4 pt-4">
      <button onClick={phase === "menu" ? onExit : backToModes} aria-label="Back" className="h-11 rounded-xl px-3 text-neutral-600 dark:text-neutral-300">
        ← Back
      </button>
      {phase !== "menu" && phase !== "over" && (
        <span className="text-sm text-neutral-500 dark:text-neutral-400">Round {run.round} · {seq.length} to remember</span>
      )}
    </div>
  );

  if (phase === "menu") {
    const d = getStats("memory");
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex flex-1 flex-col justify-center gap-4 px-6">
          <h1 className="text-center text-2xl font-semibold">Memory</h1>
          <p className="text-center text-neutral-500 dark:text-neutral-400">Pick one. Take your time.</p>
          <button onClick={() => start("digits")} className="rounded-2xl bg-teal-600 px-6 py-5 text-left text-white">
            <div className="text-lg font-semibold">🔢 Digit span</div>
            <div className="text-sm opacity-90">Watch the digits, then type them back</div>
          </button>
          <button onClick={() => start("grid")} className="rounded-2xl bg-teal-600 px-6 py-5 text-left text-white">
            <div className="text-lg font-semibold">🟦 Pattern grid</div>
            <div className="text-sm opacity-90">Watch the tiles light up, then tap them in order</div>
          </button>
          {d.plays > 0 && <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">Your best: {d.best}</p>}
        </div>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">{MODE_TITLE[mode]}</p>
          <div className="text-7xl font-bold">{run.best}</div>
          <p className="text-lg">{run.best > 0 ? "in a row remembered" : "Nice try. Warm up and go again."}</p>
          {isBest && run.best > 0 && <p className="font-semibold text-teal-600 dark:text-teal-400">New best!</p>}
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <button onClick={() => start(mode)} className="h-14 rounded-2xl bg-teal-600 font-semibold text-white">Play again</button>
            <button onClick={backToModes} className="h-14 rounded-2xl bg-neutral-200 font-semibold dark:bg-neutral-800">Back to modes</button>
            <button onClick={onExit} className="h-12 text-neutral-500 dark:text-neutral-400">Done for now</button>
          </div>
        </div>
      </div>
    );
  }

  const status =
    phase === "watch" ? "Watch…" : phase === "turn" ? "Your turn" : ok ? "Nice!" : run.misses >= 1 ? "Not quite. One more try." : "Not quite.";
  const canType = phase === "turn";

  return (
    <div className="flex h-full flex-col">
      {header}
      <p className="mt-4 text-center text-lg font-medium" aria-live="polite">{status}</p>
      {mode === "digits" ? (
        <>
          <div className="flex h-48 items-center justify-center text-8xl font-bold tabular-nums">
            {phase === "watch" && (shown === null ? "" : shown)}
            {phase !== "watch" && <span className="text-5xl tracking-widest">{input.map(() => "•").join("") || " "}</span>}
          </div>
          <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3 px-4 pb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <PadKey key={n} label={String(n)} disabled={!canType} onClick={() => press(n)} />
            ))}
            <span />
            <PadKey label="0" disabled={!canType} onClick={() => press(0)} />
            <PadKey label="⌫" disabled={!canType} onClick={backspace} />
          </div>
        </>
      ) : (
        <div className="mx-auto mt-8 grid w-full max-w-xs grid-cols-3 gap-3 px-4">
          {Array.from({ length: GRID_TILES }, (_, i) => {
            const lit = phase === "watch" && shown === i;
            const tapped = phase !== "watch" && input[input.length - 1] === i && phase === "result";
            return (
              <button
                key={i}
                disabled={!canType}
                onClick={() => press(i)}
                aria-label={`Tile ${i + 1}`}
                className={`aspect-square rounded-2xl transition-colors duration-150 ${
                  lit ? "bg-teal-400" : tapped ? (ok ? "bg-teal-500" : "bg-rose-400") : "bg-neutral-200 dark:bg-neutral-800"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PadKey({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-16 rounded-2xl bg-neutral-200 text-2xl font-semibold disabled:opacity-40 dark:bg-neutral-800"
    >
      {label}
    </button>
  );
}
