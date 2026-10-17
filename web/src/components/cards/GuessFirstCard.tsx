import { useState } from "react";
import type { Card } from "@detour/content";
import { CardShell } from "../CardShell";
import type { CardViewProps } from "./types";

type Guess = Extract<Card, { type: "guess_first" }>;

export function GuessFirstCard({ card, index, total, onComplete, onNext }: CardViewProps<Guess>) {
  const [picked, setPicked] = useState<number | null>(null);
  const { question, options, answer, reveal } = card.body;
  const done = picked !== null;

  return (
    <CardShell card={card} index={index} total={total} dim={done}>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-xs uppercase tracking-widest text-white/60">Take a guess</p>
        <h1 className="text-2xl font-semibold leading-snug">{question}</h1>

        <div className="mt-5 space-y-2.5">
          {options.map((opt, i) => {
            const state = !done ? "idle" : i === answer ? "right" : i === picked ? "wrong" : "muted";
            return (
              <button
                key={opt}
                disabled={done}
                onClick={() => {
                  setPicked(i);
                  onComplete({ correct: i === answer });
                }}
                className={
                  "w-full rounded-2xl border px-4 py-3.5 text-left font-medium transition " +
                  (state === "idle" ? "border-white/30 bg-white/15 backdrop-blur hover:bg-white/25 active:scale-[0.98]" : "") +
                  (state === "right" ? "border-emerald-300 bg-emerald-500/40" : "") +
                  (state === "wrong" ? "border-rose-300 bg-rose-500/30" : "") +
                  (state === "muted" ? "border-white/10 bg-white/5 text-white/50" : "")
                }
              >
                {opt}
              </button>
            );
          })}
        </div>

        {done && (
          <>
            <p className="mt-4 text-sm leading-relaxed text-white/90">
              <strong>{picked === answer ? "Nice, that's right. " : "Not quite. "}</strong>
              {reveal}
            </p>
            <button onClick={onNext} className="mt-5 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]">
              Next
            </button>
          </>
        )}
      </div>
    </CardShell>
  );
}
